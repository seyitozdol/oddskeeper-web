#!/usr/bin/env bash
# VPS wrapper: TSL kadro tazeleme (gunluk). Yeni transferlerin kadroya girmesi icin.
# TSL macları BASLAYANA KADAR gunluk kosar; sezon basi bu satiri cron'dan kaldir
# (maclar basladiktan sonra kadrolar apifootball macindan zaten guncellenir).
#
# Zincir (sirali, DB-driven, idempotent, tarayici YOK; SofaScore icin PROXY_URL sart):
#   1)  fetch_apifootball_squads.py     -> football.team_squad_current (API-Football)
#   1a) fetch_sofascore_squads.py       -> football.sofascore_squad_current (guncel kadrolar,
#       yeni transferler dahil; hem sentetik kart koprusunun hem 1.Lig TM eslesmesinin kaynagi)
#   1b) build_squad_audit.py            -> football.squad_audit (SIRA ONEMLI: bir sonraki
#       adim "TM'de var bizde yok" listesini BURADAN okur)
#   1c) apply_synthetic_squad.py --seed -> denetimdeki eksik oyunculara sentetik kimlik,
#       kadroya ekleme ve SofaScore'dan foto/uyruk/boy/forma no doldurma
#   2)  remap_players_additive.py       -> ref.player_mapping EKLEMELI (APPLY=1)
#   3)  fetch_transfermarkt_values.py   -> football.player_market_values (TSL)
#   3b) fetch_transfermarkt_values_tff1 -> football.tff1_player_market_values (1.Lig kadro
#       uyeligi de bu tablodan gelir)
#   5)  build_squad_audit.py            -> denetim SON HALIYLE yeniden yazilir
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

run() {  # $1=etiket  $2=script  $3.. = "VAR=val" ise env, degilse script argumani
  local label="$1" script="$2"; shift 2
  local envs=() args=() a
  for a in "$@"; do
    if [[ "$a" == *=* ]]; then envs+=("$a"); else args+=("$a"); fi
  done
  if env "${envs[@]}" "$VENV" "$PIPE/src/football/$script" "${args[@]}"; then
    echo "----- $(date -u '+%F %T UTC') $label OK -----"
  else
    echo "----- $(date -u '+%F %T UTC') $label FAILED rc=$? -----"
  fi
}

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  run "1) apifootball squads" fetch_apifootball_squads.py
  run "1a) sofascore kadrolar" fetch_sofascore_squads.py
  # 1b) Denetim ONCE kosar: sentetik seed listesi "tm_not_ours" satirlarindan gelir.
  run "1b) squad audit (on)"  build_squad_audit.py
  # 1c) Sentetik kadro: TM'de olup bizde olmayan oyunculara sentetik kimlik + kadro
  #     satiri + SofaScore koprusu. API-Football yetisince otomatik emekli olur.
  run "1c) sentetik kadro"    apply_synthetic_squad.py --seed
  run "2) remap (additive)"   remap_players_additive.py APPLY=1
  run "3) TM market values"   fetch_transfermarkt_values.py
  run "3b) TM values 1.Lig"   fetch_transfermarkt_values_tff1.py
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

# 5) Kadro denetim listeleri (header'daki herkese acik 3 sekmeli sayfa):
#    TM kiyas + participant-id eksikleri football.squad_audit'a yazilir.
{
  if "$VENV" "$PIPE/src/football/build_squad_audit.py"; then
    echo "----- $(date -u '+%F %T UTC') 5) squad audit OK -----"
  else
    echo "----- $(date -u '+%F %T UTC') 5) squad audit FAILED rc=$? -----"
  fi
} >> "$LOG" 2>&1
