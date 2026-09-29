#!/usr/bin/env bash
# VPS wrapper: SofaScore mac verisi (TSL + 1.Lig + Avrupa kupalari) ve TSL takimlarinin
# yaklasan tum maclari (football.fixtures). /opt/oddskeeper/run_sofascore.sh olarak kopyala.
#
# Cron (CEST): 0 */3 * * *  /opt/oddskeeper/run_sofascore.sh
#
# rc HEMEN degiskene alinir: eskiden echo icindeki $(date ...) $?'i sifirliyordu ve log hep
# "FAILED rc=0" yaziyordu (gunluk ozet bunu "bilinmeyen desen" diye raporluyordu, 2026-09-29).
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/sofascore.log"
{
  echo "===== $(date -u '+%F %T UTC') START ====="
  "$VENV" "$PIPE/src/football/fetch_sofascore_matches.py"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') OK ====="
  else
    echo "===== $(date -u '+%F %T UTC') FAILED rc=$rc ====="
  fi
} >> "$LOG" 2>&1

# TSL takimlarinin tum yaklasan maclari (Avrupa + kupa + hazirlik dahil) fixtures tablosuna.
{
  echo "===== $(date -u '+%F %T UTC') TEAM EVENTS START ====="
  "$VENV" "$PIPE/src/football/fetch_sofascore_team_events.py"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') TEAM EVENTS OK ====="
  else
    echo "===== $(date -u '+%F %T UTC') TEAM EVENTS FAILED rc=$rc ====="
  fi
} >> "$LOG" 2>&1
