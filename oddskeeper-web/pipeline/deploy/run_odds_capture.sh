#!/usr/bin/env bash
# VPS wrapper: Bets10 oran yakalama (headful Chromium + Xvfb + TR-geo proxy).
# /opt/oddskeeper/run_odds_capture.sh olarak kopyala. Detay: deploy/DEPLOY.md
# NOT (spike asamasi): capture_odds_vps.py su an yalnizca AGI KAYDEDER (parser yok).
# Dump incelenip parser yazilinca buraya "--load" eklenecek.
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

xvfb-run -a "$VENV" "$PIPELINE/src/common/capture_odds_vps.py" bets10 \
  >> "$LOG/odds_capture.log" 2>&1
