#!/usr/bin/env bash
# VPS wrapper: mapping/identity saglik denetimi (HAFTALIK). Tum branslarda kimlik
# eslesmesi bosluklarini sayar; HIGH bosluk varsa exit 1 (loga FAIL yazar).
# Amac: goz ile hata ayiklamayi bitirmek. Yeni yukselen takim / transfer bir
# kaynak-id eslenmeden dusmeye baslarsa burada yakalanir.
#
# /opt/oddskeeper/run_mapping_health.sh olarak kopyala. Crontab (haftalik, Pzt 06:00):
#   0 6 * * 1  /opt/oddskeeper/run_mapping_health.sh
# Son rapor AYRI dosyada tutulur (mapping_health_last.log) — hizli bakilir.
set -uo pipefail
export PYTHONUTF8=1
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/mapping_health.log"
LAST="/opt/oddskeeper/logs/mapping_health_last.log"

TMP="$(mktemp)"
if "$VENV" "$PIPE/src/common/mapping_health_check.py" > "$TMP" 2>&1; then
  rc=0
else
  rc=$?
fi
{ echo "===== $(date -u '+%F %T UTC') (rc=$rc) ====="; cat "$TMP"; } > "$LAST"
cat "$LAST" >> "$LOG"
rm -f "$TMP"
if [ "$rc" -ne 0 ]; then
  # HIGH bosluk = kimlik eslesme arizasi; artik logda beklemez, aninda push.
  ozet=$(grep -iE 'FAIL|HIGH' "$LAST" | head -4 | cut -c1-160 | paste -sd' || ' -)
  /opt/oddskeeper/notify.sh "mapping_health FAIL (rc=$rc)" \
    "${ozet:-detay: mapping_health_last.log}" high
fi
exit "$rc"
