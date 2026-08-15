#!/usr/bin/env bash
# Oyuncu id eslesme job'lari (gunluk). Yeni sezon oyuncularini esler ki view'lardaki
# FlashScore overlay (xg/xgot/xa/kart/pozisyon) otomatik gorunur olsun.
# Hepsi DB-driven + idempotent (on conflict update); proxy/tarayici GEREKMEZ.
#   1) 1.Lig  FlashScore->SofaScore  (ref.flashscore_player_map.sofascore_player_id)
#   2) Super Lig SofaScore->Opta      (ref.sofascore_opta_player_map)
#   3) Super Lig FlashScore->Opta    (ref.flashscore_player_map.opta_player_id)
# SIRA ONEMLI: #3 kopru olarak #2'nin ciktisini okur (FS->Sofa->Opta), boylece
# Opta karsiligi olmayan yeni oyuncularin sentetik id'si iki haritada AYNI olur.
# #2 ve #3 sezon-agnostik; FS_MAP_SEASON yalniz #1 (1.Lig FS->Sofa) icin gecerli,
# sezon donunce onu bump et.
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/fs_player_map.log"
export FS_MAP_SEASON="2026/2027"

run() {  # $1=etiket $2=script
  if "$VENV" "$PIPE/src/football/$2"; then
    echo "----- $(date -u '+%F %T UTC') $1 OK -----"
  else
    rc=$?
    echo "----- $(date -u '+%F %T UTC') $1 FAILED rc=$rc -----"
  fi
}

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  run "1lig fs->sofa" build_flashscore_sofa_player_map.py
  run "tsl sofa->opta" build_sofascore_opta_player_map.py
  run "tsl fs->opta"  build_flashscore_opta_player_map.py
  echo "===== $(date -u '+%F %T UTC') DONE ====="
} >> "$LOG" 2>&1
