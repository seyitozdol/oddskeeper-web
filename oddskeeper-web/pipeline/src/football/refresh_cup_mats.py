# -*- coding: utf-8 -*-
"""Avrupa kupasi (ucl/uel/uecl) oyuncu-sezon matview'larini tazeler.

H3 (ARCHITECTURE_REVIEW): {prefix}_player_season_stats_v1 view'lari canli aggregate
iken her kupa oyuncu profili render'inda ~1.4-4.3s suruyordu; matview'e alindi ve
view ince "select * from mat"a cevrildi (sql/2026-08-19_eurocup_player_season_mats.sql).
Bu script mac-sonrasi zincirde (run_match_scrape.sh) SADECE kupa maci islenen turda
cagrilir; her mat unique index'li oldugu icin CONCURRENTLY tazelenir (okuyucu kilidi
yok, canli kupa yuzeyleri bloklanmaz).

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\refresh_cup_mats.py
"""
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")

MATS = [
    "ucl_player_season_stats_mat",
    "uel_player_season_stats_mat",
    "uecl_player_season_stats_mat",
]


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    conn.autocommit = True  # CONCURRENTLY transaction icinde kosamaz
    cur = conn.cursor()
    failed = []
    for mat in MATS:
        try:
            cur.execute(f"refresh materialized view concurrently analytics.{mat}")
            print(f"  refreshed analytics.{mat}")
        except Exception as exc:  # bir mat patlarsa digerleri yine tazelensin
            failed.append(mat)
            print(f"  HATA analytics.{mat}: {exc}")
    conn.close()
    if failed:
        raise SystemExit(f"tazelenemeyen kupa mat: {failed}")


if __name__ == "__main__":
    main()
