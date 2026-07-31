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

# Sirayla calistirilacak wrapper'lar. Once maclar (upcoming), sonra hafif oran
# kaynaklari, en son agir Bets10 (kendi kilidi var).
WRAPPERS = [
    "/opt/oddskeeper/run_upcoming_events.sh",
    "/opt/oddskeeper/run_bet365_odds.sh",
    "/opt/oddskeeper/run_oddsportal.sh",
    "/opt/oddskeeper/run_odds_capture.sh",
]
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
        returning id, requested_by
        """
    )
    row = cur.fetchone()
    if not row:
        return  # bekleyen tetik yok
    tid, by = row
    print(f"[trigger {tid}] claimed (by {by})", flush=True)

    notes, any_ok = [], False
    for w in WRAPPERS:
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
