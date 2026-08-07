#!/usr/bin/env bash
# Mac-sonrasi hizli scrape (polling): her ~10 dk cron ile calisir.
# SofaScore'un bitmis (finished) mac listesinden, kickoff'tan 2.5-6 saat once
# baslamis maclari ceker -> tipik bir mac icin ~ mac bitiminden 30 dk sonra
# (finished-status ayrica kapi; uzayan mac biter bitmez sonraki turda yakalanir).
# Idempotent upsert; ust uste binmez (flock). Kaynak onceligi: SofaScore (ana).
#
# Faz 1: yalniz SofaScore (TSL + 1.Lig, LEAGUES). Faz 2'de FlashScore overlay
# fetcher (xg/xgot/xa/sari-kirmizi kart/detayli pozisyon) buraya eklenecek.
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/match_scrape.log"
LOCK="/opt/oddskeeper/match_scrape.lock"

# Onceki kosu hala suruyorsa bu turu atla (10 dk polling ust uste binmesin).
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u '+%F %T UTC') SKIP (onceki kosu suruyor)" >> "$LOG"
  exit 0
fi

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  # 1) SofaScore (ANA): bitmis maclar, kickoff+2.5..6s penceresi (~ bitis +30 dk)
  if SOFA_MIN_AGE_H=2.5 SOFA_MAX_AGE_H=6 "$VENV" "$PIPE/src/football/fetch_sofascore_matches.py"; then
    echo "===== $(date -u '+%F %T UTC') SOFA OK ====="
  else
    rc=$?
    echo "===== $(date -u '+%F %T UTC') SOFA FAILED rc=$rc ====="
  fi
  # 2) FlashScore (OVERLAY): xg/xgot/xa/sari-kirmizi kart/detayli pozisyon.
  #    Proxysiz duz HTTP; ayni 2.5-6s penceresi (fetcher kendi FS_* envleriyle).
  if "$VENV" "$PIPE/src/football/fetch_flashscore_matches.py"; then
    echo "===== $(date -u '+%F %T UTC') FLASH OK ====="
  else
    rc=$?
    echo "===== $(date -u '+%F %T UTC') FLASH FAILED rc=$rc ====="
  fi
} >> "$LOG" 2>&1
