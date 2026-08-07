#!/usr/bin/env bash
# FlashScore -> SofaScore oyuncu id eslesmesi (ref.flashscore_player_map).
# Gunluk calisir: yeni sezon oyuncularini esler ki tff1 view'larindaki FS overlay
# (xg/xgot/xa/sari-kirmizi kart/detayli pozisyon) otomatik gorunur olsun.
# Idempotent (on conflict update); DB-driven, proxy/tarayici GEREKMEZ.
# Guncel sezon FS_MAP_SEASON ile (varsayilan 2026/2027). Sezon donunce bump et.
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/fs_player_map.log"

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  if FS_MAP_SEASON="2026/2027" "$VENV" "$PIPE/src/football/build_flashscore_sofa_player_map.py"; then
    echo "===== $(date -u '+%F %T UTC') OK ====="
  else
    rc=$?
    echo "===== $(date -u '+%F %T UTC') FAILED rc=$rc ====="
  fi
} >> "$LOG" 2>&1
