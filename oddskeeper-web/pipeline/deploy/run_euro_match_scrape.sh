#!/usr/bin/env bash
# VPS wrapper: EuroLeague (E) + EuroCup (U) mac-sonrasi otomatik veri akisi (kaynak api-live.euroleague.net v2).
# BSL run_bsl_match_scrape.sh kalibi: her 10 dk'da bir calisir; tip-off'tan 2.5 saat gecmis, henuz
# yuklenmemis maclari ceker ve euroleague.*'a yazar. Acik API: proxy/tarayici/sezon id'si yok (sezon
# identity.current_season_label() ile, sinir 1 Temmuz). Adaylar DB'den secilir: mac yoksa HTTP yok.
# Tip-off + 20 saatte box bir kez daha cekilir (resmi istatistik duzeltmesi). Idempotent upsert.
# 00/06/12/18 turlarinda (ya da EURO_FORCE_SYNC=1) program API ile esitlenir (ertelenen mac, saat).
# Yukleme/duzeltme olduysa EL->BSL oyuncu baglayicisi kosar (her sabah 06 turunda --people ile).
# /opt/oddskeeper/run_euro_match_scrape.sh olarak kopyala. Detay: deploy/DEPLOY.md
#
# Cron (CEST): 5-59/10 * * * *  /opt/oddskeeper/run_euro_match_scrape.sh   (BSL'den 5 dk kaydirmali)
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
NOTIFY=/opt/oddskeeper/notify.sh
mkdir -p "$LOG"

exec 9>/tmp/ok_euro_match_scrape.lock
flock -n 9 || exit 0

SLOT=$(date +%H%M | cut -c1-3)
SYNC=""
case "$SLOT" in 000|060|120|180) SYNC="--sync-schedule" ;; esac
[ "${EURO_FORCE_SYNC:-0}" = "1" ] && SYNC="--sync-schedule"

RUN_OUT=$(mktemp)
"$VENV" -u "$PIPELINE/src/basketball/fetch_euroleague.py" --auto $SYNC > "$RUN_OUT" 2>&1
rc=$?

# EL->BSL oyuncu baglayicisi (euroleague.player_bsl_link): yeni box-score yeni oyuncu getirebilir.
# Mac yuklendi/duzeltildiyse --auto; her sabah 06:00-06:09 turunda --people (API kulup kadrolari da).
MATCH_ARGS=""
if [ "$SLOT" = "060" ]; then
  MATCH_ARGS="--auto --people"
elif grep -qE 'yuklendi|duzeltildi' "$RUN_OUT"; then
  MATCH_ARGS="--auto"
fi
mrc=0
M_OUT=$(mktemp)
if [ -n "$MATCH_ARGS" ]; then
  "$VENV" -u "$PIPELINE/src/basketball/match_euroleague_bsl.py" $MATCH_ARGS > "$M_OUT" 2>&1
  mrc=$?
  cat "$M_OUT" >> "$RUN_OUT"
fi

# Yeni bag kurulduysa kadro denetimi (has_euro_photo vb.) hemen yansisin; BSL'deki gibi hatasi yutulur.
if grep -q 'baglandi' "$M_OUT"; then
  "$VENV" -u "$PIPELINE/src/basketball/build_bsl_squad_audit.py" >> "$RUN_OUT" 2>&1 || true
fi

# Sessiz turlar logu sisirmesin: yalniz bir sey olduysa (yukleme / duzeltme / bekleyen / program /
# yeni bag / inceleme / hata) yaz.
if [ "$rc" -ne 0 ] || [ "$mrc" -ne 0 ] || \
   grep -qE 'yuklendi|duzeltildi|beklemede|program guncellendi|baglandi|inceleme kapandi|INCELEME|HATA|Traceback' "$RUN_OUT"; then
  { echo "$(date '+%F %T') --- euro_match_scrape rc=$rc match_rc=$mrc"; cat "$RUN_OUT"; } >> "$LOG/euro_match_scrape.log"
fi

if [ "$rc" -ne 0 ] || [ "$mrc" -ne 0 ]; then
  "$NOTIFY" "oddskeeper: EL/EC mac scrape FAILED" \
    "fetch_euroleague rc=$rc, match_euroleague_bsl rc=$mrc; detay /opt/oddskeeper/logs/euro_match_scrape.log" high
fi

# Baglayici otomatik baglayamadigi (ama benzeri olan) oyuncu gorduyse haber ver:
# basketball.identity_review'a bak, gerekirse elle bagla/birlestir. "Mevcut bag dogru, boyle kalsin"
# karari icin status='ignored' yap ('resolved' = duzeltildi; sorun tekrar gorulurse yeniden acilir).
N_REVIEW=$(grep -c 'kimlik. INCELEME' "$RUN_OUT" || true)
if [ "${N_REVIEW:-0}" -gt 0 ]; then
  "$NOTIFY" "EL/EC kimlik incelemesi: $N_REVIEW kayit" \
    "$(grep 'kimlik. INCELEME' "$RUN_OUT" | head -5 | cut -c1-160)" default
fi
rm -f "$RUN_OUT" "$M_OUT"
worst=$rc
[ "$mrc" -gt "$worst" ] && worst=$mrc
exit "$worst"
