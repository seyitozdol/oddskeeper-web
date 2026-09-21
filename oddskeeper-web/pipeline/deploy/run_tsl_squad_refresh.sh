#!/usr/bin/env bash
# VPS wrapper: TSL kadro tazeleme (gunluk). Yeni transferlerin kadroya girmesi icin.
# NOT (2026-09-21, sahip karari): zincirin apifootball/sofascore bacagi sezon icinde de
# gunluk kosar (kadro denetim sayfasini, sentetik kimligi ve PSM haritasini besler).
# TRANSFERMARKT adimlari (1b/5 audit, 3, 3b, TM diff raporu) YALNIZ transfer penceresi
# doneminde kosar (TM_ON kapisi: yaz 1 Haz - 15 Eyl, kis 1 Oca - 15 Sub; genis tutuldu).
# Pencere disinda elle kosturmak icin: TM_FORCE=1 bash run_tsl_squad_refresh.sh
# (Onceki plan "sezon basinda cron'dan kaldir"di; zincire sezon-ici isler eklenince
# gunluk kaldi ve TM her gece bosuna kosuyordu; 19-21 Eyl TM 405 vakasiyla yakalandi.)
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

# Transfermarkt pencere kapisi: TM sezon basi + ara transfer doneminde kullanilir;
# sezon icinde her gece TM'ye istek atmanin getirisi yok (degerler degismez) ve
# TM bot korumasi (405) triage'a gurultu dusurur.
MMDD=$((10#$(date -u +%m%d)))
TM_ON=0
if [ "${TM_FORCE:-0}" = "1" ]; then
  TM_ON=1
elif { [ "$MMDD" -ge 601 ] && [ "$MMDD" -le 915 ]; } || { [ "$MMDD" -ge 101 ] && [ "$MMDD" -le 215 ]; }; then
  TM_ON=1
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
    local rc=$?  # $(date) komut ikamesi $? degerini ezmeden ONCE yakala
    echo "----- $(date -u '+%F %T UTC') $label FAILED rc=$rc -----"
  fi
}

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  run "1) apifootball squads" fetch_apifootball_squads.py
  run "1a) sofascore kadrolar" fetch_sofascore_squads.py
  # 1b) Denetim ONCE kosar: sentetik seed listesi "tm_not_ours" satirlarindan gelir.
  #     build_squad_audit TM'ye gider -> pencere kapisina bagli. Pencere disinda 1c,
  #     squad_audit tablosunun son basarili halinden okur (idempotent, guvenli).
  if [ "$TM_ON" = "1" ]; then
    run "1b) squad audit (on)"  build_squad_audit.py
  else
    echo "----- $(date -u '+%F %T UTC') 1b) squad audit ATLANDI (TM pencere disi) -----"
  fi
  # 1c) Sentetik kadro: TM'de olup bizde olmayan oyunculara sentetik kimlik + kadro
  #     satiri + SofaScore koprusu. API-Football yetisince otomatik emekli olur.
  run "1c) sentetik kadro"    apply_synthetic_squad.py --seed
  run "2) remap (additive)"   remap_players_additive.py APPLY=1
  # 2b) apifootball<->sofascore kimlik haritasi: yeni transferler kadroya girince
  #     PSM guncel-sezon Avg koprusu (af-<id> -> sofascore -> tsl_ss) icin tazele.
  run "2b) af<->sofa harita"  build_apifootball_sofascore_player_map.py
  if [ "$TM_ON" = "1" ]; then
    run "3) TM market values"   fetch_transfermarkt_values.py
    run "3b) TM values 1.Lig"   fetch_transfermarkt_values_tff1.py
  else
    echo "----- $(date -u '+%F %T UTC') 3+3b) TM values ATLANDI (TM pencere disi) -----"
  fi
  echo "===== $(date -u '+%F %T UTC') DONE ====="
} >> "$LOG" 2>&1

# 4) TM kadro kiyas raporu: son rapor AYRI dosyaya (session-basi ozet bunu okur),
#    ana loga da eklenir. Basarisiz olursa onceki rapor korunur. TM kapisina bagli.
if [ "$TM_ON" = "1" ]; then
  DIFF_LOG="/opt/oddskeeper/logs/tm_squad_diff.log"
  TMP_DIFF="$(mktemp)"
  if "$VENV" "$PIPE/src/football/report_tm_squad_diff.py" --min-value-k 200 > "$TMP_DIFF" 2>&1; then
    { echo "===== $(date -u '+%F %T UTC') TM KADRO KIYAS RAPORU ====="; cat "$TMP_DIFF"; } > "$DIFF_LOG"
    cat "$DIFF_LOG" >> "$LOG"
  else
    echo "----- $(date -u '+%F %T UTC') TM diff raporu FAILED -----" >> "$LOG"
  fi
  rm -f "$TMP_DIFF"
else
  echo "----- $(date -u '+%F %T UTC') 4) TM diff raporu ATLANDI (TM pencere disi) -----" >> "$LOG"
fi

# 5) Kadro denetim listeleri (header'daki herkese acik 3 sekmeli sayfa):
#    TM kiyas + participant-id eksikleri football.squad_audit'a yazilir.
#    build_squad_audit TM'ye gittigi icin pencere disinda atlanir; sayfa son
#    basarili denetimi gostermeye devam eder.
{
  if [ "$TM_ON" != "1" ]; then
    echo "----- $(date -u '+%F %T UTC') 5) squad audit ATLANDI (TM pencere disi) -----"
  elif "$VENV" "$PIPE/src/football/build_squad_audit.py"; then
    echo "----- $(date -u '+%F %T UTC') 5) squad audit OK -----"
  else
    rc=$?
    echo "----- $(date -u '+%F %T UTC') 5) squad audit FAILED rc=$rc -----"
  fi
} >> "$LOG" 2>&1
