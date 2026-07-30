#!/usr/bin/env bash
# VPS wrapper: OddsPortal oranlari (3. kaynak, oran karsilastirma).
# Headful Chromium + Xvfb; OddsPortal proxy GEREKTIRMEZ (Cloudflare yok, VPS IP'si
# yeter, GB harcamaz). /opt/oddskeeper/run_oddsportal.sh olarak kopyala.
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

xvfb-run -a "$VENV" "$PIPELINE/src/common/fetch_oddsportal.py" \
  --chromium-path /usr/bin/chromium \
  >> "$LOG/oddsportal.log" 2>&1
