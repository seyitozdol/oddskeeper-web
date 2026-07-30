#!/usr/bin/env bash
# VPS wrapper: bet365 oranlari (API-Football, bookmaker id=8) -> Turk takimlarinin
# Avrupa maclari. Tarayici/proxy YOK; API_FOOTBALL_KEY (.env) + kota kullanir.
# /opt/oddskeeper/run_bet365_odds.sh olarak kopyala. Ucuz, sik cagrilabilir (3s).
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

"$VENV" "$PIPELINE/src/common/fetch_apifootball_odds.py" \
  >> "$LOG/bet365_odds.log" 2>&1
