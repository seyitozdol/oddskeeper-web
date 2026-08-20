#!/usr/bin/env bash
# Mac-sonrasi hizli scrape (polling): her ~10 dk cron ile calisir.
# SofaScore'un bitmis (finished) mac listesinden, kickoff'tan 2.5-6 saat once
# baslamis maclari ceker -> tipik bir mac icin ~ mac bitiminden 30 dk sonra
# (finished-status ayrica kapi; uzayan mac biter bitmez sonraki turda yakalanir).
# Idempotent upsert; ust uste binmez (flock). Kaynak onceligi: SofaScore (ana).
#
# NOT (2026-08-19): bu dosya VPS /opt kopyasiyla BIREBIR ayni tutulur (B-3 drift
# kapatildi); degisiklik once burada yapilip /opt'a kopyalanir.
set -uo pipefail
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/match_scrape.log"
LOCK="/opt/oddskeeper/match_scrape.lock"

# A-1 (tek orkestrator): bu turda TUM mat refresh'leri adim 4'teki
# refresh_orchestrator.py'de kosar (kirli kaynaklara gore, her mat en cok 1 kez,
# bagimlilik sirasiyla). DEFER_MATS=1 loader/builder'larin ic refresh'lerini
# tamamen atlatir; DEFER_TSL_MATS eski H1 bayragi, gecis uyumu icin birlikte
# export edilir (eski python koduna denk gelirse en azindan tsl_ss ertelenir).
# Yalnizca bu wrapper'da set edilir; 3 saatlik run_sofascore.sh ve 04:00
# run_fs_player_map.sh bayraklari set ETMEZ, o yollarda davranis birebir aynidir.
export DEFER_MATS=1
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

  # 2b) Avrupa kupalari FlashScore overlay: SofaScore'un bos oldugu kupa maclari
  #     (ozellikle on eleme -> kadro var stat yok) icin FS takim+oyuncu doldurur.
  #     SofaScore adimindan (1) SONRA calisir; kendi eksik-tespiti + eslesmesini yapar
  #     (ref.flashscore_sofa_match_map). Grace penceresi (yeni biten maclar).
  CUP_OUT=$("$VENV" "$PIPE/src/football/fetch_flashscore_cup_matches.py" 2>&1); crc=$?
  echo "$CUP_OUT"
  if [ "$crc" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') CUP FS OK ====="
  else
    echo "===== $(date -u '+%F %T UTC') CUP FS FAILED rc=$crc ====="
  fi

  # 2c) FS->Sofa kupa oyuncu haritasi: cup FS bu turda mac islediyse tazele
  #     (yeni FS oyuncularini sofascore idye esle - Players xG/metrik overlayi
  #     ucl/uel/uecl_player_season_stats_v1 flash_all CTE bu haritayi okur).
  if echo "$CUP_OUT" | grep -qE 'TOPLAM: [1-9]'; then
    if "$VENV" "$PIPE/src/football/build_flashscore_sofa_cup_player_map.py" >/dev/null 2>&1; then
      echo "===== $(date -u '+%F %T UTC') CUP PLAYER MAP OK ====="
    else
      echo "===== $(date -u '+%F %T UTC') CUP PLAYER MAP FAILED ====="
    fi
  fi

  # Bu turda hangi kaynak mac isledi? SofaScore fetcher sonda "TOPLAM: N mac"
  # yazar; FlashScore fetcher "islenecek=N". Gate'ler bu iki bayrakla kurulur.
  sofa_islendi=0;  echo "$SOFA_OUT"  | grep -qE 'TOPLAM: [1-9]'    && sofa_islendi=1
  flash_islendi=0; echo "$FLASH_OUT" | grep -qE 'islenecek=[1-9]'  && flash_islendi=1

  # H2 FAZ 2: SofaScore tarafinin harita+mat tetigi "islendi" degil "DEGISTI".
  # Grace penceresinde ayni bitmis mac ~21 tur yeniden islenir; payload hash'i
  # ayni kaldikca (CHANGED_M: 0) harita rebuild + mat refresh gereksizdir.
  # Fail-open: CHANGED_M satiri hic yoksa (fetcher yarim kaldi / eski surum)
  # islendi=degisti sayilir, eski davranisa duser.
  sofa_degisti=$sofa_islendi
  if echo "$SOFA_OUT" | grep -q 'CHANGED_M:'; then
    echo "$SOFA_OUT" | grep -qE 'CHANGED_M: [1-9]' || sofa_degisti=0
  fi

  # 3) FlashScore overlay: SADECE FlashScore bu turda mac islediyse. Yeni
  #    oyunculari FS->Sofa esle + fotolar + tff1 player/team mat tazele.
  #    Yoksa yeni 26/27 oyuncularinin kart/xG overlay'i 04:00 gunluk job'a kadar
  #    gecikirdi (Juan Arguello kart bug'i). DB-driven + idempotent + hizli.
  if [ "$flash_islendi" -eq 1 ]; then
    if FS_MAP_SEASON="2026/2027" "$VENV" "$PIPE/src/football/build_flashscore_sofa_player_map.py" >/dev/null; then
      # yeni oyuncularin fotolarini FS ham verisinden sofascore_player_info'ya.
      # rc kontrolu 2026-08-19'da eklendi: script 2026-08-14..18 arasi her turda
      # NotNullViolation ile cokuyordu ama banner yine "OK" diyordu (2.3 bulgusu).
      if "$VENV" "$PIPE/src/football/sync_player_photos_tff1.py"; then :; else
        echo "===== $(date -u '+%F %T UTC') PHOTO SYNC FAILED ====="
      fi
      # A-1: tff1 player/team mat refresh'i buradan adim 4 orkestratorune tasindi
      # (flash kaynagi ayni siralamayla: player ONCE, team SONRA).
      echo "===== $(date -u '+%F %T UTC') FS-MAP + PHOTO OK ====="
    fi
  fi

  # 3b) TSL kimlik haritalari: SofaScore VEYA FlashScore bu turda mac islediyse.
  #     ONEMLI: TSL istatistiklerinin ANA kaynagi SofaScore; bu adim eskiden
  #     yalniz FlashScore gate'ine bagliydi, dolayisiyla SofaScore bir maci
  #     yukleyip FlashScore ayni turda yakalamayinca (FS gec yayinliyor)
  #     harita tazelenmiyor, yeni yuklenen takim ~1 saat analytics'e girmiyordu
  #     (Kasimpasa-Trabzonspor 2026-08-15). Artik SofaScore de tetikliyor.
  #     Sira: sofa->opta ONCE (fs->opta onu kopru olarak okur). Mat'lar bu
  #     adimdan adim 4'teki orkestratore tasindi (A-1); haritalar her zaman
  #     mat'lardan once yazilmis olur.
  #     H2 FAZ 2: sofa tarafinda tetik sofa_degisti (payload degisen mac);
  #     FlashScore yolu ayri kaynak, hash onu kapsamaz -> flash_islendi aynen kalir.
  if [ "$sofa_islendi" -eq 1 ] && [ "$sofa_degisti" -eq 0 ] && [ "$flash_islendi" -eq 0 ]; then
    echo "===== $(date -u '+%F %T UTC') H2 SKIP (islenen mac var, degisen yok) ====="
  fi
  if [ "$sofa_degisti" -eq 1 ] || [ "$flash_islendi" -eq 1 ]; then
    "$VENV" "$PIPE/src/football/build_sofascore_opta_player_map.py"
    "$VENV" "$PIPE/src/football/build_flashscore_opta_player_map.py" >/dev/null
    # apifootball<->sofascore kimlik haritasi: PSM (Player Market) guncel sezon
    # Avg koprusu bunu okur (af-<id> yeni transfer -> sofascore -> tsl_ss).
    "$VENV" "$PIPE/src/football/build_apifootball_sofascore_player_map.py" >/dev/null

    # 3c) Tutarlilik denetimi: skor <-> ham oyuncu golu <-> haritali gol.
    #     Uyari verirse logda 'UYARI' satiri olur (gol dusuren kimlik arizasi).
    "$VENV" "$PIPE/src/football/check_match_coverage.py" --days 2 || true
  fi
  # 3d) H3 kupa gate'i: bu turda kupa maci islendi mi? SofaScore cup: SOFA_OUT
  #     'CUP_M: N'; FlashScore cup: CUP_OUT 'TOPLAM: N'.
  #     H2 FAZ 2: sofa kupa tetigi degisiklik-bazli (CUP_CHANGED_M); satir hic
  #     yoksa fail-open olarak CUP_M'e duser. FS kupa yolu (CUP_OUT) aynen kalir.
  cup_islendi=0
  if echo "$SOFA_OUT" | grep -q 'CUP_CHANGED_M:'; then
    echo "$SOFA_OUT" | grep -qE 'CUP_CHANGED_M: [1-9]' && cup_islendi=1
  else
    echo "$SOFA_OUT" | grep -qE 'CUP_M: [1-9]' && cup_islendi=1
  fi
  echo "$CUP_OUT"  | grep -qE 'TOPLAM: [1-9]' && cup_islendi=1

  # 4) A-1 TEK ORKESTRATOR: turun TUM mat refresh'leri tek cagri. Kirli kaynaklar
  #    (sofa degisti / flash isledi / kupa islendi) arguman olarak gecer;
  #    refresh_orchestrator.py tablosundaki mat'lari bagimlilik sirasiyla ve her
  #    birini EN COK 1 KEZ tazeler (kupa mat'lari CONCURRENTLY). Banner'lar eski
  #    satirlarla ayni tutulur (log kontrati: 'TSL MAP + MAT OK' / 'CUP MAT OK');
  #    izleme/teyit grep'leri degismeden calisir.
  orch_src=""
  [ "$sofa_degisti" -eq 1 ]  && orch_src="$orch_src sofa"
  [ "$flash_islendi" -eq 1 ] && orch_src="$orch_src flash"
  [ "$cup_islendi" -eq 1 ]   && orch_src="$orch_src cup"
  if [ -n "$orch_src" ]; then
    if "$VENV" "$PIPE/src/football/refresh_orchestrator.py" $orch_src; then
      if [ "$sofa_degisti" -eq 1 ] || [ "$flash_islendi" -eq 1 ]; then
        echo "===== $(date -u '+%F %T UTC') TSL MAP + MAT OK ====="
      fi
      if [ "$cup_islendi" -eq 1 ]; then
        echo "===== $(date -u '+%F %T UTC') CUP MAT OK ====="
      fi
    else
      if [ "$sofa_degisti" -eq 1 ] || [ "$flash_islendi" -eq 1 ]; then
        echo "===== $(date -u '+%F %T UTC') TSL MAP + MAT FAILED ====="
      fi
      if [ "$cup_islendi" -eq 1 ]; then
        echo "===== $(date -u '+%F %T UTC') CUP MAT FAILED ====="
      fi
    fi
  fi
} >> "$LOG" 2>&1
