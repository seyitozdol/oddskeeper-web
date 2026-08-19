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

# H1 (mukerrer mat refresh): bu turda tsl_ss mat'lari yalniz adim 3b'deki
# refresh_tsl_mats.py bir kez tazelesin. Bayrak, adim 1 loader'inin (step 26) ve
# adim 3b builder'inin (step 93) kendi ic tsl_ss refresh'lerini atlamasini saglar;
# adim 3b gate'i (sofa VEYA flash islendi) loader kosan her turda saglandigi ve
# refresh_tsl_mats.py orada kosuldugu icin erteleme her zaman kapsanir. Yalnizca
# bu wrapper'da set edilir; 3 saatlik run_sofascore.sh ve 04:00 run_fs_player_map.sh
# bayragi set ETMEZ, dolayisiyla o yollarda davranis birebir aynidir.
export DEFER_TSL_MATS=1

# Onceki kosu hala suruyorsa bu turu atla (10 dk polling ust uste binmesin).
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u '+%F %T UTC') SKIP (onceki kosu suruyor)" >> "$LOG"
  exit 0
fi

{
  echo "===== $(date -u '+%F %T UTC') START ====="
  # 1) SofaScore (ANA): bitmis maclar, kickoff+2.5..6s penceresi (~ bitis +30 dk)
  SOFA_OUT=$(SOFA_MIN_AGE_H=2.5 SOFA_MAX_AGE_H=6 "$VENV" "$PIPE/src/football/fetch_sofascore_matches.py" 2>&1); src=$?
  echo "$SOFA_OUT"
  if [ "$src" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') SOFA OK ====="
  else
    echo "===== $(date -u '+%F %T UTC') SOFA FAILED rc=$src ====="
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

  # Bu turda hangi kaynak mac isledi? SofaScore fetcher sonda "TOPLAM: N mac"
  # yazar; FlashScore fetcher "islenecek=N". Gate'ler bu iki bayrakla kurulur.
  sofa_islendi=0;  echo "$SOFA_OUT"  | grep -qE 'TOPLAM: [1-9]'    && sofa_islendi=1
  flash_islendi=0; echo "$FLASH_OUT" | grep -qE 'islenecek=[1-9]'  && flash_islendi=1

  # 3) FlashScore overlay: SADECE FlashScore bu turda mac islediyse. Yeni
  #    oyunculari FS->Sofa esle + fotolar + tff1 player/team mat tazele.
  #    Yoksa yeni 26/27 oyuncularinin kart/xG overlay'i 04:00 gunluk job'a kadar
  #    gecikirdi (Juan Arguello kart bug'i). DB-driven + idempotent + hizli.
  if [ "$flash_islendi" -eq 1 ]; then
    if FS_MAP_SEASON="2026/2027" "$VENV" "$PIPE/src/football/build_flashscore_sofa_player_map.py" >/dev/null; then
      # yeni oyuncularin fotolarini FS ham verisinden sofascore_player_info'ya
      "$VENV" "$PIPE/src/football/sync_player_photos_tff1.py"
      # kart/xG overlay icin player mat ONCE, sonra team mat (team xG oyuncu mat'ini okur)
      "$VENV" -c "import psycopg2; from dotenv import dotenv_values; e=dotenv_values('$PIPE/.env'); c=psycopg2.connect(e['DATABASE_URL'].strip().strip(chr(34))); c.autocommit=True; cur=c.cursor(); cur.execute('refresh materialized view analytics.tff1_player_season_stats_mat'); cur.execute('refresh materialized view analytics.tff1_team_season_stats_mat')"
      echo "===== $(date -u '+%F %T UTC') FS-MAP + PHOTO + MAT OK ====="
    fi
  fi

  # 3b) TSL kimlik haritalari + tsl_ss mat'lari: SofaScore VEYA FlashScore bu
  #     turda mac islediyse. ONEMLI: TSL istatistiklerinin ANA kaynagi SofaScore;
  #     bu adim eskiden yalniz FlashScore gate'ine bagliydi, dolayisiyla SofaScore
  #     bir maci yukleyip FlashScore ayni turda yakalamayinca (FS gec yayinliyor)
  #     harita+mat tazelenmiyor, yeni yuklenen takim ~1 saat analytics'e girmiyordu
  #     (Kasimpasa-Trabzonspor 2026-08-15). Artik SofaScore de tetikliyor.
  #     Sira: sofa->opta ONCE (fs->opta onu kopru olarak okur), sonra mat'lar.
  if [ "$sofa_islendi" -eq 1 ] || [ "$flash_islendi" -eq 1 ]; then
    "$VENV" "$PIPE/src/football/build_sofascore_opta_player_map.py"
    "$VENV" "$PIPE/src/football/build_flashscore_opta_player_map.py" >/dev/null
    # apifootball<->sofascore kimlik haritasi: PSM (Player Market) guncel sezon
    # Avg koprusu bunu okur (af-<id> yeni transfer -> sofascore -> tsl_ss).
    "$VENV" "$PIPE/src/football/build_apifootball_sofascore_player_map.py" >/dev/null
    if "$VENV" "$PIPE/src/football/refresh_tsl_mats.py"; then
      echo "===== $(date -u '+%F %T UTC') TSL MAP + MAT OK ====="
    else
      echo "===== $(date -u '+%F %T UTC') TSL MAP + MAT FAILED ====="
    fi

    # 3c) Tutarlilik denetimi: skor <-> ham oyuncu golu <-> haritali gol.
    #     Uyari verirse logda 'UYARI' satiri olur (gol dusuren kimlik arizasi).
    "$VENV" "$PIPE/src/football/check_match_coverage.py" --days 2 || true
  fi

  # 3d) H3: Avrupa kupasi oyuncu-sezon mat'lari (ucl/uel/uecl) — SADECE bu turda
  #     kupa maci islendiyse. SofaScore cup sinyali: SOFA_OUT 'CUP_M: N'. (VPS kopyasi
  #     ayrica FlashScore cup adimini CUP_OUT ile gate'ler; repo kopyasinda o adim yok.)
  #     Mat'lar unique index'li -> CONCURRENTLY (okuyucu bloklanmaz).
  if echo "$SOFA_OUT" | grep -qE 'CUP_M: [1-9]'; then
    if "$VENV" "$PIPE/src/football/refresh_cup_mats.py"; then
      echo "===== $(date -u '+%F %T UTC') CUP MAT OK ====="
    else
      echo "===== $(date -u '+%F %T UTC') CUP MAT FAILED ====="
    fi
  fi
} >> "$LOG" 2>&1
