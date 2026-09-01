#!/usr/bin/env bash
# VPS wrapper: CEV EuroVolley 2026 (Kadinlar) scraper'i (legacy www-old.cev.eu).
# Maclar (mID taramasi, set-set skor) + kadro bio + oyuncu mac-mac istatistik
# postback zinciri + fixtures senkron; idempotent, saf HTTP (proxy/tarayici yok).
# /opt/oddskeeper/run_eurovolley.sh olarak kopyala. Detay: deploy/DEPLOY.md
#
# Cron (CEST): 30 22 * * *  aksam kosusu (gunun maclari + istatistikler)
#              15 8  * * *  sabah yedek (gece islenen CEV verisini supurur)
# TURNUVA PENCERELI: 6 Eylul finali sonrasi 2026-09-08'den itibaren no-op;
# turnuva bitince cron satirlari kaldirilabilir (sonraki buyuk turnuvada
# fetch_cev_eurovolley.py COMP config'i yeni ID/PID ile guncellenir).
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
NOTIFY=/opt/oddskeeper/notify.sh
mkdir -p "$LOG"

# Turnuva bitti mi? (son supurme 7 Eylul sabahi; sonrasi no-op)
if [ "$(date +%Y%m%d)" -gt 20260907 ]; then
  echo "$(date '+%F %T') EuroVolley 2026 bitti, kosulmadi (cron kaldirilabilir)" >> "$LOG/eurovolley.log"
  exit 0
fi

# Tek kosu (tam kosu ~15 dk; manuel + cron cakismasin)
exec 9>/tmp/ok_eurovolley.lock
flock -n 9 || { echo "$(date '+%F %T') eurovolley zaten calisiyor, atlandi" >> "$LOG/eurovolley.log"; exit 0; }

echo "$(date '+%F %T') === eurovolley kosusu basladi ===" >> "$LOG/eurovolley.log"
"$VENV" -u "$PIPELINE/src/volleyball/fetch_cev_eurovolley.py" >> "$LOG/eurovolley.log" 2>&1
rc=$?
echo "$(date '+%F %T') === eurovolley kosusu bitti rc=$rc ===" >> "$LOG/eurovolley.log"

if [ "$rc" -ne 0 ]; then
  "$NOTIFY" "oddskeeper: EuroVolley scrape FAILED" "fetch_cev_eurovolley rc=$rc; detay /opt/oddskeeper/logs/eurovolley.log" high
fi
exit "$rc"
