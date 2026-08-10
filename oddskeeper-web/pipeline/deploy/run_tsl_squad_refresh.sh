#!/usr/bin/env bash
# VPS wrapper: TSL kadro tazeleme (gunluk). Yeni transferlerin kadroya girmesi icin.
# TSL macları BASLAYANA KADAR gunluk kosar; sezon basi bu satiri cron'dan kaldir
# (maclar basladiktan sonra kadrolar apifootball macindan zaten guncellenir).
#
# Zincir (sirali, DB-driven, idempotent, proxy/tarayici YOK):
#   1) fetch_apifootball_squads.py   -> football.team_squad_current tazeler (API-Football)
#   2) remap_players_additive.py     -> ref.player_mapping EKLEMELI (APPLY=1), opta baglama
#   3) fetch_transfermarkt_values.py -> football.player_market_values (TM, retry'li)
#
# /opt/oddskeeper/run_tsl_squad_refresh.sh olarak kopyala. API_FOOTBALL_KEY + DATABASE_URL
# pipeline/.env'den. TM icin ~1-2 dk (18 kulup, istekler arasi 3s).
set -uo pipefail
export PYTHONUTF8=1
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/tsl_squad_refresh.log"
LOCK="/opt/oddskeeper/tsl_squad_refresh.lock"

# Onceki kosu hala suruyorsa bu turu atla.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u '+%F %T UTC') SKIP (onceki kosu suruyor)" >> "$LOG"
  exit 0
fi

run() {  # $1=etiket  $2=script  $3.. = ekstra env (VAR=val)
  local label="$1" script="$2"; shift 2
  if env "$@" "$VENV" "$PIPE/src/football/$script"; then
    echo "----- $(date -u '+%F %T UTC') $label OK -----"
  else
    echo "----- $(date -u '+%F %T UTC') $label FAILED rc=$? -----"
  fi
}

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  run "1) apifootball squads" fetch_apifootball_squads.py
  # 1b) Sentetik kadro: TM'de olup API-Football'da olmayan kuratif oyuncular
  #     (football.squad_synthetic_players). API yetisince otomatik emekli olur.
  run "1b) sentetik kadro"    apply_synthetic_squad.py
  run "2) remap (additive)"   remap_players_additive.py APPLY=1
  run "3) TM market values"   fetch_transfermarkt_values.py
  echo "===== $(date -u '+%F %T UTC') DONE ====="
} >> "$LOG" 2>&1

# 4) TM kadro kiyas raporu: son rapor AYRI dosyaya (session-basi ozet bunu okur),
#    ana loga da eklenir. Basarisiz olursa onceki rapor korunur.
DIFF_LOG="/opt/oddskeeper/logs/tm_squad_diff.log"
TMP_DIFF="$(mktemp)"
if "$VENV" "$PIPE/src/football/report_tm_squad_diff.py" --min-value-k 200 > "$TMP_DIFF" 2>&1; then
  { echo "===== $(date -u '+%F %T UTC') TM KADRO KIYAS RAPORU ====="; cat "$TMP_DIFF"; } > "$DIFF_LOG"
  cat "$DIFF_LOG" >> "$LOG"
else
  echo "----- $(date -u '+%F %T UTC') TM diff raporu FAILED -----" >> "$LOG"
fi
rm -f "$TMP_DIFF"
