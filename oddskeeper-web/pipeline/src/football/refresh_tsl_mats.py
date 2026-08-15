# -*- coding: utf-8 -*-
"""Super Lig (tsl_ss*) materialized view'larini bagimlilik sirasiyla tazeler.

Mac-sonrasi job (run_match_scrape.sh) TSL maci isledigi turda cagirir; oyuncu/takim
metrikleri, sirlamalar ve benchmark'lar yeni macla birlikte guncellensin diye.
Sira onemli: benchmark ve overview mat'lari detay mat'ini okur.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\refresh_tsl_mats.py
"""
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")

# Bagimlilik sirasi: once temel detay mat'lari, sonra onlari okuyanlar.
MATS = [
    "tsl_ss_player_detailed_metrics_global_mat",
    "tsl_ss_player_metric_leaderboard_mat",
    "tsl_ss_player_metric_benchmarks_mat",
    "tsl_ss_player_overview_advanced_mat",
    "tsl_ss_team_detailed_metrics_mat",
    "tsl_ss_team_metric_benchmarks_mat",
    "tsl_ss_team_overview_advanced_mat",
    "tsl_ss_squad_mat",
    "tsl_player_advanced_season_mat",
    "tsl_player_flashscore_season_mat",
    # SofaScore profil koprusu (sql/2026-08-15_player_*_sofascore_bridge.sql):
    # profil ONCE (digerleri slug'i ondan okur), sonra mac logu + kimlik/bio.
    "player_profile_bridged_mat",
    "player_match_log_sofascore_mat",
    "player_current_info_bridged_mat",
]


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    conn.autocommit = True
    cur = conn.cursor()
    failed = []
    for mat in MATS:
        try:
            cur.execute(f"refresh materialized view analytics.{mat}")
            print(f"  refreshed analytics.{mat}")
        except Exception as exc:  # bir mat patlarsa digerleri yine tazelensin
            failed.append(mat)
            print(f"  HATA analytics.{mat}: {exc}")
    conn.close()
    if failed:
        raise SystemExit(f"tazelenemeyen mat: {failed}")


if __name__ == "__main__":
    main()
