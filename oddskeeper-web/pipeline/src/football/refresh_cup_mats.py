# -*- coding: utf-8 -*-
"""Avrupa kupasi (ucl/uel/uecl) oyuncu-sezon matview'larini tazeler.

H3 (ARCHITECTURE_REVIEW): {prefix}_player_season_stats_v1 view'lari canli aggregate
iken her kupa oyuncu profili render'inda ~1.4-4.3s suruyordu; matview'e alindi ve
view ince "select * from mat"a cevrildi (sql/2026-08-19_eurocup_player_season_mats.sql).
Her mat unique index'li oldugu icin CONCURRENTLY tazelenir (okuyucu kilidi yok).

A-1: liste + CONCURRENTLY bilgisi refresh_orchestrator.py'de (CUP_CHAIN_MATS).
Mac-sonrasi wrapper artik dogrudan refresh_orchestrator.py'yi cagirir; bu dosya
elle kosu / yan yol giris noktasi olarak duruyor.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\refresh_cup_mats.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_orchestrator as orch  # noqa: E402


def main():
    failed = orch.refresh_list(orch.CUP_CHAIN_MATS)
    if failed:
        raise SystemExit(f"tazelenemeyen kupa mat: {failed}")


if __name__ == "__main__":
    main()
