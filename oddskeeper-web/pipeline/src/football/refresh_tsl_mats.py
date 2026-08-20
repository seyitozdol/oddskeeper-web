# -*- coding: utf-8 -*-
"""Super Lig (tsl_ss*) materialized view'larini bagimlilik sirasiyla tazeler.

A-1: mat listesi + sira + CONCURRENTLY bilgisi artik refresh_orchestrator.py'de
(TSL_CHAIN_MATS). Bu dosya yan yollarin (04:00 run_fs_player_map.sh zinciri,
elle kosu) giris noktasi olarak duruyor; mac-sonrasi wrapper (run_match_scrape.sh)
artik bunu degil, kirli-kaynak bazli refresh_orchestrator.py'yi cagirir.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\refresh_tsl_mats.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_orchestrator as orch  # noqa: E402


def main():
    failed = orch.refresh_list(orch.TSL_CHAIN_MATS)
    if failed:
        raise SystemExit(f"tazelenemeyen mat: {failed}")


if __name__ == "__main__":
    main()
