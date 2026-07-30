#!/usr/bin/env bash
# Bahis sitesi oran yakalama - Linux/sunucu sarmalayicisi.
# Windows'taki run_odds_capture.bat ile ayni isi yapar.
#
# KURULUM (Debian/Ubuntu, bir kez):
#   cd <repo>/oddskeeper-web/pipeline
#   python3 -m venv .venv
#   .venv/bin/pip install -r requirements.txt
#   .venv/bin/playwright install --with-deps chromium   # sistem paketleri icin sudo ister
#   cp .env.example .env   # ve DATABASE_URL'i doldur
#
# CRON (6 saatte bir, sunucu saati UTC ise TSI ile karistirma):
#   30 3,9,15,21 * * *  /path/to/pipeline/run_odds_capture.sh
#
# Not: Python tarafi calisma dizininden bagimsiz (yollar dosya konumuna gore
# cozuluyor), yani cron'dan cagrilirken cd gerekmiyor.

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$DIR/.venv/bin/python"
LOG_DIR="$DIR/data/logs"
mkdir -p "$LOG_DIR"

export PYTHONUTF8=1

"$PY" "$DIR/src/common/capture_odds_headless.py" bets10 --load \
  >> "$LOG_DIR/odds_capture.log" 2>&1
