#!/usr/bin/env bash
# VPS wrapper: BMBets oranlari (4. kaynak, oran karsilastirma).
# Saf HTTP (curl_cffi); tarayici/Xvfb/proxy GEREKTIRMEZ (Cloudflare yok,
# VPS IP'si yeter, GB harcamaz). /opt/oddskeeper/run_bmbets.sh olarak kopyala.
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

"$VENV" "$PIPELINE/src/common/fetch_bmbets.py" >> "$LOG/bmbets.log" 2>&1
