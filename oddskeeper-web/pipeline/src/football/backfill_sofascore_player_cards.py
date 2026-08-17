# -*- coding: utf-8 -*-
"""Gecmis SofaScore maclari icin oyuncu-bazli kart olayi backfill'i
(football.match_player_cards, source='sofascore').

football.matches (source='sofascore') satirlarindan match_player_cards'i OLMAYANLARI
hedef lig+sezonlar icin dolasir; /event/<id>/lineups + /incidents cekip
load_sofascore_team_stats.build_card_rows ile match_player_cards'e upsert eder.
on_pitch (sahada gorulen kart mi) her satirda hesaplanir; boylece bench/oyun-disi
kartlar oyuncu istatistigine girmez.

Varsayilan hedef: Super Lig + 1. Lig, son 3 sezon. COMPS / SEASONS ile ezilebilir:
  COMPS="Süper Lig" SEASONS="2025/2026" .venv\\Scripts\\python.exe src\\football\\backfill_sofascore_player_cards.py

Not: karti olmayan mac satir uretmez; tekrar kosuda yeniden islenir (bir kerelik
backfill icin zararsiz). Canli akista fetch_sofascore_matches.py ayni satirlari yazar.
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
# competition ilike deseni (build_card_rows competition kullanmaz; sadece secim filtresi)
COMP_TARGETS = [("%per Lig%", "Süper Lig"), ("%1. Lig%", "Trendyol 1. Lig")]
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
    tasks = []  # source_match_id
    for patt, _comp in COMP_TARGETS:
        cur.execute(
            """select m.source_match_id from football.matches m
               where m.source='sofascore' and m.competition ilike %s
                 and m.season_label = any(%s)
                 and not exists (
                   select 1 from football.match_player_cards pc
                   where pc.source='sofascore' and pc.source_match_id = m.source_match_id)
               order by m.match_datetime""",
            (patt, SEASONS),
        )
        for (mid,) in cur.fetchall():
            tasks.append(mid)
    print(f"kart backfill adayi: {len(tasks)} mac (sezonlar={SEASONS})", flush=True)

    done = fail = zero = cards = 0
    for i, mid in enumerate(tasks, 1):
        try:
            ev = get(f"{API}/event/{mid}")["event"]
            lineup = get(f"{API}/event/{mid}/lineups")
            inc = get(f"{API}/event/{mid}/incidents")
            rows = teamload.build_card_rows(ev, inc, lineup)
            if rows:
                teamload.upsert_cards(rows)
                cards += len(rows)
                done += 1
            else:
                zero += 1
        except Exception as e:  # noqa
            fail += 1
            print(f"  FAIL {mid}: {repr(e)[:80]}", flush=True)
        if i % 50 == 0:
            print(f"  {i}/{len(tasks)} (kartli={done} kartsiz={zero} hata={fail} kart={cards})", flush=True)
        time.sleep(SLEEP)
    print(f"BITTI: kartli mac={done} kartsiz={zero} hata={fail} toplam kart={cards}", flush=True)
    c.close()


if __name__ == "__main__":
    main()
