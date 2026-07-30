#!/usr/bin/env bash
# VPS wrapper: Bets10 oran yakalama (headful Chromium + Xvfb + TR proxy) + yukleme.
# /opt/oddskeeper/run_odds_capture.sh olarak kopyala. Detay: deploy/DEPLOY.md
# Bets10 TR-geo residential proxy gerektirir (--cc tr); GB ucretli, sik degil (6s).
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

# 1) Yakala (tum competition sayfalari; futbol dolu, basketbol/milli sezonda)
xvfb-run -a "$VENV" "$PIPELINE/src/common/capture_odds_vps.py" bets10 \
  --proxy --cc tr --chromium-path /usr/bin/chromium \
  >> "$LOG/odds_capture.log" 2>&1

# 2) En yeni netcap dump'ini yukle (Bets10 -> tracker.site_event_odds)
DUMP=$(ls -t "$PIPELINE"/data/odds/netcap_bets10_*.json 2>/dev/null | head -1)
if [ -n "$DUMP" ]; then
  "$VENV" "$PIPELINE/src/common/load_site_odds.py" "$DUMP" \
    >> "$LOG/odds_capture.log" 2>&1
fi
