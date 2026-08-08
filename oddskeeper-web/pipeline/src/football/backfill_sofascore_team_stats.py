# -*- coding: utf-8 -*-
"""Gecmis SofaScore maclari icin takim-mac stat backfill'i (match_team_stats, source='sofascore').

football.matches (source='sofascore') satirlarindan match_team_stats'i OLMAYANLARI hedef
lig+sezonlar icin dolasir; /event + /statistics + /incidents cekip
load_sofascore_team_stats.build_team_rows ile match_team_stats'e upsert eder.
Referees sekmesi + MSM hakem lookup icin faul/tackle/kart/penalti stat katmanini kurar.

Varsayilan hedef: SADECE 1. Lig (SL zaten opta/apifootball ile dolu).
  COMPS="Trendyol 1. Lig" SEASONS="2025/2026,2024/2025" ile ezilebilir.

Kullanim:
  .venv\\Scripts\\python.exe src\\football\\backfill_sofascore_team_stats.py
"""
import importlib
import os
import sys
import time
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DB_URL = (ENV.get("DATABASE_URL") or "").strip().strip('"')
PROXY = (ENV.get("PROXY_URL") or os.environ.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
API = "https://api.sofascore.com/api/v1"
SLEEP = float(os.environ.get("SOFA_SLEEP", "0.5"))

sys.path.insert(0, str(Path(__file__).resolve().parent))
teamload = importlib.import_module("load_sofascore_team_stats")

SEASONS = [s.strip() for s in os.environ.get(
    "SEASONS", "2026/2027,2025/2026,2024/2025").split(",") if s.strip()]
# competition ilike deseni -> DB'deki competition etiketi (build_team_rows'a gecer)
COMP_TARGETS = [("%1. Lig%", "Trendyol 1. Lig")]
_env_comps = os.environ.get("COMPS", "").strip()
if _env_comps:
    COMP_TARGETS = [("%" + c.strip() + "%", c.strip()) for c in _env_comps.split(",")]


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
    tasks = []  # (source_match_id, competition_label)
    for patt, comp in COMP_TARGETS:
        cur.execute(
            """select m.source_match_id from football.matches m
               where m.source='sofascore' and m.competition ilike %s
                 and m.season_label = any(%s)
                 and not exists (
                   select 1 from football.match_team_stats t
                   where t.source='sofascore' and t.source_match_id = m.source_match_id)
               order by m.match_datetime""",
            (patt, SEASONS),
        )
        for (mid,) in cur.fetchall():
            tasks.append((mid, comp))
    print(f"team-stat backfill adayi: {len(tasks)} mac (sezonlar={SEASONS})", flush=True)

    done = fail = 0
    for i, (mid, comp) in enumerate(tasks, 1):
        try:
            ev = get(f"{API}/event/{mid}")["event"]
            st = get(f"{API}/event/{mid}/statistics")
            inc = get(f"{API}/event/{mid}/incidents")
            rows = teamload.build_team_rows(ev, st, inc, comp)
            teamload.upsert(rows)
            done += 1
        except Exception as e:  # noqa
            fail += 1
            print(f"  FAIL {mid}: {repr(e)[:80]}", flush=True)
        if i % 50 == 0:
            print(f"  {i}/{len(tasks)} (ok={done} hata={fail})", flush=True)
        time.sleep(SLEEP)
    print(f"BITTI: upsert={done} hata={fail}", flush=True)
    c.close()


if __name__ == "__main__":
    main()
