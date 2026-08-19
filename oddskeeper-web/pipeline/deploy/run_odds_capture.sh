#!/usr/bin/env bash
# VPS wrapper: Bets10 oran yakalama (headful Chromium + Xvfb + TR proxy) + yukleme.
# /opt/oddskeeper/run_odds_capture.sh olarak kopyala. Detay: deploy/DEPLOY.md
# Bets10 TR-geo residential proxy gerektirir (--cc tr); GB ucretli, sik degil (6s).
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

# Tek Bets10 kosusu: scheduled cron ile manuel tetik ayni anda calismasin
# (cift proxy GB + Xvfb cakismasi). Zaten calisiyorsa atla.
exec 8>/tmp/ok_odds_capture.lock
flock -n 8 || { echo "$(date '+%F %T') odds_capture zaten calisiyor, atlandi" >> "$LOG/odds_capture.log"; exit 0; }

# 1) Yakala (tum competition sayfalari; futbol dolu, basketbol/milli sezonda)
xvfb-run -a "$VENV" "$PIPELINE/src/common/capture_odds_vps.py" bets10 \
  --proxy --cc tr --chromium-path /usr/bin/chromium \
  >> "$LOG/odds_capture.log" 2>&1

# 2) En yeni netcap dump'ini yukle (Bets10 -> tracker.site_event_odds)
DUMP=$(ls -t "$PIPELINE"/data/odds/netcap_bets10_*.json 2>/dev/null | head -1)
if [ -n "$DUMP" ]; then
  "$VENV" "$PIPELINE/src/common/load_site_odds.py" "$DUMP" \
    >> "$LOG/odds_capture.log" 2>&1
fi

# 3) Fikstur <-> Bets10 bagini yeniden kur (Match/Player Stats Model Fixture ID
# sekmeleri icin tracker.fixture_bets10_link). Oran/upcoming_events yuklendikten
# SONRA calisir; proxy gerekmez, DB'den okur. Frontend bu tablodan oneri gosterir.
"$VENV" "$PIPELINE/src/common/link_fixtures_bets10.py" \
  >> "$LOG/odds_capture.log" 2>&1

# 4) Saklama (sahip karari 2026-08-19): 14 gunden eski netcap dump'lari silinir.
# En yeni dump yuklendikten sonra eskilerin tek islevi hata ayiklamada geriye
# bakmak. DB tarafindaki site_event_odds saklamasi load_site_odds.py icinde.
find "$PIPELINE/data/odds" -name 'netcap_*.json' -mtime +14 -delete \
  2>> "$LOG/odds_capture.log"
