#!/usr/bin/env bash
# Avrupa kupalari (CL/UL/UECL) FIKSTUR refresh. Gunluk/12-saatlik cron.
# SofaScore fixtures -> football.fixtures (source='sofascore', competition=kupa etiketi).
# Guncel sezonu OTOMATIK alir (season_label VERILMEZ). Idempotent upsert.
#
# ONEMLI SIZINTI NOTU: Bu fikstürler "Upcoming Events" paneline SIZMAZ. O panel
# analytics.upcoming_events_v1 -> tracker.upcoming_events'ten okur (football.fixtures'a
# bakmaz). TSL league_fixtures_v1 de source='sofascore' satirlarini disladigi icin
# TSL yaklasan maclarina girmez. Kupa fikstürleri yalniz ucl/uel/uecl_fixtures_v1
# (competition-filtreli) view'larindan okunur. Upcoming = sadece TR takimlari.
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/sofascore_fixtures.log"
LOCK="/opt/oddskeeper/sofascore_fixtures.lock"
FIX="$PIPE/src/football/fetch_sofascore_fixtures.py"

# Ust uste binme (uzun kosu bir sonraki turu bloklamasin).
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u '+%F %T UTC') SKIP (onceki kosu suruyor)" >> "$LOG"
  exit 0
fi

run_cup () {
  local comp="$1" ut="$2"
  echo "----- $(date -u '+%F %T UTC') $comp (ut=$ut) -----"
  if "$VENV" "$FIX" "$comp" "$ut"; then
    echo "----- OK $comp -----"
  else
    echo "----- FAILED rc=$? $comp -----"
  fi
}

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  run_cup "UEFA Şampiyonlar Ligi" 7
  run_cup "UEFA Avrupa Ligi" 679
  run_cup "UEFA Konferans Ligi" 17015
  echo "===== $(date -u '+%F %T UTC') END ====="
} >> "$LOG" 2>&1
