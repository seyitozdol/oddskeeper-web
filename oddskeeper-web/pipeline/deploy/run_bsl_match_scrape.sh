#!/usr/bin/env bash
# VPS wrapper: BSL basketbol mac-sonrasi otomatik veri akisi (kaynak FlashScore).
# Futbol run_match_scrape.sh kalibi: her 10 dk'da bir calisir; tip-off'tan 2.5 saat (= bitis +
# ~30 dk) gecmis, henuz yuklenmemis maclari ceker ve basketball.*'a yazar. Saf HTTP: proxy yok,
# tarayici yok, sezon id'si yok (FlashScore lig sayfasi hep guncel sezonu gosterir).
# Idempotent (fs_match_id + fs_player_id unique upsert); mac yoksa tek HTTP istegiyle cikar.
# /opt/oddskeeper/run_bsl_match_scrape.sh olarak kopyala. Detay: deploy/DEPLOY.md
#
# Cron (CEST): */10 * * * *  /opt/oddskeeper/run_bsl_match_scrape.sh
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
NOTIFY=/opt/oddskeeper/notify.sh
mkdir -p "$LOG"

exec 9>/tmp/ok_bsl_match_scrape.lock
flock -n 9 || exit 0

RUN_OUT=$(mktemp)
"$VENV" -u "$PIPELINE/src/basketball/fetch_flashscore_bsl.py" > "$RUN_OUT" 2>&1
rc=$?

# Kadro denetimi (/dashboard/squad-audit?sport=basketball) yalniz DB okur: mac yuklendiyse hemen
# (sahaya cikan oyuncu "RealGM'de yok" listesinden duser), ayrica her sabah 06:00-06:09 turunda
# (participant id / fotograf degisiklikleri yansisin). Futboldaki sabah denetiminin karsiligi.
if grep -q 'yuklendi' "$RUN_OUT" || [ "$(date +%H%M | cut -c1-3)" = "060" ]; then
  "$VENV" -u "$PIPELINE/src/basketball/build_bsl_squad_audit.py" >> "$RUN_OUT" 2>&1 || true
fi

# Sessiz turlar logu sisirmesin: yalniz bir sey olduysa (mac islendi / bekleyen var / hata) yaz.
if [ "$rc" -ne 0 ] || grep -qE 'yuklendi|beklemede|ATLANDI|INCELEME|HATA|Traceback' "$RUN_OUT"; then
  { echo "$(date '+%F %T') --- bsl_match_scrape rc=$rc"; cat "$RUN_OUT"; } >> "$LOG/bsl_match_scrape.log"
fi

if [ "$rc" -ne 0 ]; then
  "$NOTIFY" "oddskeeper: BSL mac scrape FAILED" "fetch_flashscore_bsl rc=$rc; detay /opt/oddskeeper/logs/bsl_match_scrape.log" high
fi

# Kimlik katmani otomatik baglayamadigi (ama benzeri olan) oyuncu/takim gorduyse haber ver:
# yeni slug acildi, mukerrer olabilir -> basketball.identity_review'a bak, gerekirse birlestir.
N_REVIEW=$(grep -c 'kimlik. INCELEME' "$RUN_OUT" || true)
if [ "${N_REVIEW:-0}" -gt 0 ]; then
  "$NOTIFY" "BSL kimlik incelemesi: $N_REVIEW kayit" \
    "$(grep 'kimlik. INCELEME' "$RUN_OUT" | head -5 | cut -c1-160)" default
fi
rm -f "$RUN_OUT"
exit "$rc"
