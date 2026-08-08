# -*- coding: utf-8 -*-
"""Gecmis SofaScore maclari icin hakem backfill'i.

football.matches (source='sofascore', referee IS NULL) satirlarini hedef lig+sezonlar
icin dolasir, SofaScore /event/{id} detay endpoint'inden referee.name ceker ve
football.matches.referee alanini gunceller. curl_cffi + proxy (fetcher ile ayni yol).

Kullanim:
  .venv\\Scripts\\python.exe src\\football\\backfill_sofascore_referee.py
  SEASONS="2025/2026,2024/2025" COMPS="Super Lig,Trendyol 1. Lig" ile ezilebilir.
"""
import os
import sys
import time
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
DB_URL = (ENV.get("DATABASE_URL") or "").strip().strip('"')
PROXY = (ENV.get("PROXY_URL") or os.environ.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
API = "https://api.sofascore.com/api/v1"
SLEEP = float(os.environ.get("SOFA_SLEEP", "0.5"))

SEASONS = [s.strip() for s in os.environ.get(
    "SEASONS", "2026/2027,2025/2026,2024/2025").split(",") if s.strip()]
# competition ilike desenleri (Turkce 'ü' -> ilike '%per Lig%' guvenli)
COMP_PATTERNS = ["%per Lig%", "%1. Lig%"]


def get(url, tries=4):
    last = None
    for _ in range(tries):
        try:
            r = cr.get(url, headers={"Accept": "application/json"},
                       proxies=PROXIES, impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa
            last = repr(e)[:100]
        time.sleep(1.5)
    raise RuntimeError(f"{url} -> {last}")


def main():
    if not DB_URL:
        raise SystemExit("Eksik DATABASE_URL (.env)")
    print("proxy:" + (PROXY[:20] + "..." if PROXY else "YOK (direkt)"), flush=True)
    c = psycopg2.connect(DB_URL)
    cur = c.cursor()
    ids = []
    for patt in COMP_PATTERNS:
        cur.execute(
            """select source_match_id from football.matches
               where source='sofascore' and referee is null
                 and competition ilike %s and season_label = any(%s)
               order by match_datetime""",
            (patt, SEASONS),
        )
        ids.extend(r[0] for r in cur.fetchall())
    ids = list(dict.fromkeys(ids))  # tekille, sirayi koru
    print(f"backfill adayi: {len(ids)} mac (sezonlar={SEASONS})", flush=True)

    done = miss = fail = 0
    batch = []
    for i, mid in enumerate(ids, 1):
        try:
            det = get(f"{API}/event/{mid}")["event"]
            ref = det.get("referee")
            name = ref.get("name") if isinstance(ref, dict) else None
            if name:
                batch.append((name, mid))
                done += 1
            else:
                miss += 1
        except Exception as e:  # noqa
            fail += 1
            print(f"  FAIL {mid}: {repr(e)[:80]}", flush=True)
        # her 50'de bir yaz
        if len(batch) >= 50:
            cur.executemany(
                "update football.matches set referee=%s where source='sofascore' and source_match_id=%s",
                batch)
            c.commit()
            batch.clear()
        if i % 100 == 0:
            print(f"  {i}/{len(ids)} (ok={done} bos={miss} hata={fail})", flush=True)
        time.sleep(SLEEP)
    if batch:
        cur.executemany(
            "update football.matches set referee=%s where source='sofascore' and source_match_id=%s",
            batch)
        c.commit()
    print(f"BITTI: guncellenen={done} hakem-bos={miss} hata={fail}", flush=True)
    c.close()


if __name__ == "__main__":
    main()
