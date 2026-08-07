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
  FLASH_OUT=$("$VENV" "$PIPE/src/football/fetch_flashscore_matches.py" 2>&1); frc=$?
  echo "$FLASH_OUT"
  if [ "$frc" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') FLASH OK ====="
  else
    echo "===== $(date -u '+%F %T UTC') FLASH FAILED rc=$frc ====="
  fi

  # 3) Bu turda mac islendiyse: yeni oyunculari FS->Sofa esle + tff1 player mat tazele.
  #    Yoksa yeni 26/27 oyuncularinin kart/xG overlay'i 04:00 gunluk job'a kadar
  #    gecikirdi (Juan Arguello kart bug'i). DB-driven + idempotent + hizli.
  if echo "$FLASH_OUT" | grep -qE 'islenecek=[1-9]'; then
    if FS_MAP_SEASON="2026/2027" "$VENV" "$PIPE/src/football/build_flashscore_sofa_player_map.py" >/dev/null; then
      "$VENV" -c "import psycopg2; from dotenv import dotenv_values; e=dotenv_values('$PIPE/.env'); c=psycopg2.connect(e['DATABASE_URL'].strip().strip(chr(34))); c.autocommit=True; c.cursor().execute('refresh materialized view analytics.tff1_player_season_stats_mat')"
      echo "===== $(date -u '+%F %T UTC') FS-MAP + MAT OK ====="
    fi
  fi
} >> "$LOG" 2>&1
