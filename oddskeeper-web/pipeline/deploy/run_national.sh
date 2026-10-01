#!/usr/bin/env bash
# VPS wrapper: Turkiye A Milli Futbol Takimi (header "TR") veri akisi. Kaynak SofaScore
# (takim id 4700, proxy uzerinden). run_euro_match_scrape.sh kalibi, ama 30 dk'da bir calisir (sahip karari 2026-10-01).
#
#   --sync      (varsayilan) mac-sonrasi: fikstur tablosunda baslama saati 2.5-8 saat once olan
#               ilgi maclari (Turkiye + yaklasan rakipleri). Aday yoksa HTTP istegi YOK.
#   --fixtures  06 ve 18 turlarinda (ya da NATL_FORCE_FIXTURES=1): fikstur + grup tablosu +
#               yeni rakibin 2023'ten beri resmi mac gecmisi + son 72 saatin duzeltme gecisi.
#
# Mac yuklendi/degistiyse zincir: sofascore->opta kimlik haritasi (yeni milli oyuncuya sentetik
# kimlik) -> takim logosu -> oyuncu bio + foto -> refresh_orchestrator.py natl (sut bolgeleri,
# tek-profil kopruleri, natl_pm zinciri). Hepsi idempotent.
#
# Izinli turnuvalar ref.national_competitions'ta (hazirlik maclari yok). Yeni turnuva = o tabloya
# satir; bu dosya degismez. /opt/oddskeeper/run_national.sh olarak kopyala. Detay: deploy/DEPLOY.md
#
# Cron (CEST): 3,33 * * * *  /opt/oddskeeper/run_national.sh   (06:03 ve 18:03 turlari --fixtures)
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
NOTIFY=/opt/oddskeeper/notify.sh
mkdir -p "$LOG"

exec 9>/tmp/ok_national.lock
flock -n 9 || exit 0

SLOT=$(date +%H%M | cut -c1-3)
MODE="--sync"
case "$SLOT" in 060|180) MODE="--fixtures" ;; esac
[ "${NATL_FORCE_FIXTURES:-0}" = "1" ] && MODE="--fixtures"

RUN_OUT=$(mktemp)
# DEFER_MATS=1: yukleyici/builder ic refresh'leri atlanir, tazeleme asagida tek seferde.
DEFER_MATS=1 "$VENV" -u "$PIPELINE/src/football/fetch_sofascore_national.py" $MODE > "$RUN_OUT" 2>&1
rc=$?

changed=$(grep -oE 'NATL_CHANGED_M: [0-9]+' "$RUN_OUT" | grep -oE '[0-9]+$' | tail -1)
chain_rc=0
if [ "${changed:-0}" -gt 0 ]; then
  mapfile -t COMPS < <("$VENV" "$PIPELINE/src/football/fetch_sofascore_national.py" --list-competitions)
  {
    echo "--- zincir (degisen mac: $changed)"
    DEFER_MATS=1 "$VENV" -u "$PIPELINE/src/football/build_sofascore_opta_player_map.py" | tail -3 || chain_rc=1
    "$VENV" -u "$PIPELINE/src/football/backfill_sofascore_team_logos.py" "${COMPS[@]}" | tail -1 || true
    "$VENV" -u "$PIPELINE/src/football/fetch_sofascore_player_info.py" "${COMPS[@]}" | tail -1 || true
    "$VENV" -u "$PIPELINE/src/football/backfill_sofascore_player_photos.py" "${COMPS[@]}" | tail -1 || true
    "$VENV" -u "$PIPELINE/src/football/refresh_orchestrator.py" natl || chain_rc=1
  } >> "$RUN_OUT" 2>&1
fi

# Sessiz turlar logu sisirmesin: yalniz bir sey olduysa yaz.
if [ "$rc" -ne 0 ] || [ "$chain_rc" -ne 0 ] || [ "$MODE" = "--fixtures" ] || \
   grep -qE '^\s+\+ \[|CEKILEMEDI|ATLANDI|NOT:|HATA|Traceback' "$RUN_OUT"; then
  { echo "$(date '+%F %T') --- national $MODE rc=$rc chain_rc=$chain_rc"; cat "$RUN_OUT"; } >> "$LOG/national.log"
fi

if [ "$rc" -ne 0 ] || [ "$chain_rc" -ne 0 ]; then
  [ -x "$NOTIFY" ] && "$NOTIFY" "oddskeeper: milli takim akisi FAILED" \
    "fetch_sofascore_national $MODE rc=$rc, zincir rc=$chain_rc; detay /opt/oddskeeper/logs/national.log" high
fi
rm -f "$RUN_OUT"
[ "$chain_rc" -gt "$rc" ] && exit "$chain_rc"
exit "$rc"
