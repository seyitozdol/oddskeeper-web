#!/usr/bin/env bash
# VPS wrapper: yaklasan mac fetch'i (tracker.upcoming_events besler).
# /opt/oddskeeper/run_upcoming_events.sh olarak kopyala (kullanici konvansiyonu)
# veya cron'dan dogrudan bu yolu cagir. Detay: deploy/DEPLOY.md
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

"$VENV" "$PIPELINE/src/common/fetch_upcoming_events.py" \
  >> "$LOG/upcoming_events.log" 2>&1

# Upcoming taze cekildikten hemen sonra: football.fixtures tarih/saat/durumunu
# oradan senkronla (ozellikle 1.Lig elle-yuklu placeholder tarihlerini duzeltir).
"$VENV" "$PIPELINE/src/football/sync_fixtures_from_upcoming.py" \
  >> "$LOG/upcoming_events.log" 2>&1
