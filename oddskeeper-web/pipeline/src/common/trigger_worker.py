# -*- coding: utf-8 -*-
"""Manuel tetik islemcisi (VPS'te dakikada bir cron ile).

public.pipeline_triggers'ta 'pending' tetik varsa ATOMIK olarak claim eder
(FOR UPDATE SKIP LOCKED), pipeline wrapper'larini SIRAYLA calistirir, sonucu
'done'/'error' olarak isaretler. Bekleyen yoksa hemen cikar (hafif poll).

Scheduled cron'lar KENDI sabit saatlerinde bagimsiz calisir; bu yalnizca admin
butonunun tetikledigi ek out-of-band kosu. Agir Bets10 yakalamasi kendi
flock'una sahip (run_odds_capture.sh), boylece scheduled kosuyla cakismaz.
"""
import os
import subprocess
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
load_dotenv(ROOT / ".env")

# kind -> sirayla calistirilacak wrapper'lar.
#  'all'            = futbol/oran zinciri (maclar, hafif oran kaynaklari, agir Bets10 son).
#  'bets10_odds'    = YALNIZ Bets10 oran yakalama + fixture<->bets10 resolver
#                     (run_odds_capture.sh). MSM Fixture sekmesindeki "oranlari simdi
#                     yenile" butonu icin: sofascore/365/oddsportal'i atlar, hizli.
#                     run_odds_capture.sh kendi flock'una sahip; scheduled cron ile
#                     cakismaz. Bilinmeyen kind 'all'a duser (asagida .get fallback).
#  'tbf_basketball' = yalniz TBF basketbol scraper'i (headful+xvfb+TR proxy).
KIND_WRAPPERS = {
    "all": [
        "/opt/oddskeeper/run_upcoming_events.sh",
        "/opt/oddskeeper/run_bet365_odds.sh",
        "/opt/oddskeeper/run_oddsportal.sh",
        "/opt/oddskeeper/run_odds_capture.sh",
    ],
    "bets10_odds": [
        "/opt/oddskeeper/run_odds_capture.sh",
    ],
    "tbf_basketball": [
        "/opt/oddskeeper/run_tbf_basketball.sh",
    ],
}
PER_JOB_TIMEOUT = 1500  # sn (agir Bets10 dahil)


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        """
        update public.pipeline_triggers set status='running', started_at=now()
        where id = (
            select id from public.pipeline_triggers
            where status='pending' order by requested_at
            limit 1 for update skip locked
        )
        returning id, requested_by, kind
        """
    )
    row = cur.fetchone()
    if not row:
        return  # bekleyen tetik yok
    tid, by, kind = row
    wrappers = KIND_WRAPPERS.get(kind or "all", KIND_WRAPPERS["all"])
    print(f"[trigger {tid}] claimed (by {by}, kind={kind})", flush=True)

    notes, any_ok = [], False
    for w in wrappers:
        name = os.path.basename(w)
        if not os.path.exists(w):
            notes.append(f"{name}:yok")
            continue
        try:
            r = subprocess.run(["bash", w], timeout=PER_JOB_TIMEOUT)
            notes.append(f"{name}:{r.returncode}")
            any_ok = any_ok or r.returncode == 0
        except subprocess.TimeoutExpired:
            notes.append(f"{name}:timeout")
        except Exception as e:  # noqa
            notes.append(f"{name}:err")
        print(f"[trigger {tid}] {name} -> {notes[-1]}", flush=True)

    status = "done" if any_ok else "error"
    cur.execute(
        "update public.pipeline_triggers set status=%s, finished_at=now(), note=%s where id=%s",
        (status, " ".join(notes)[:400], tid),
    )
    print(f"[trigger {tid}] {status}: {notes}", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
