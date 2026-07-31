#!/usr/bin/env bash
# VPS wrapper: manuel tetik kontrolu (crontab: dakikada bir). Bekleyen bir tetik
# varsa pipeline'i bir kez calistirir. flock ile ust uste calismaz (uzun kosu
# suredugunde sonraki dakika-cron'lari no-op olur).
# /opt/oddskeeper/run_trigger_check.sh olarak kopyala.
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

# Ayni anda tek worker: onceki tetik hala calisiyorsa bu dakika-cron cikar.
exec 9>/tmp/ok_trigger_worker.lock
flock -n 9 || exit 0

"$VENV" "$PIPELINE/src/common/trigger_worker.py" >> "$LOG/trigger.log" 2>&1
