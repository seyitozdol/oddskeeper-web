#!/usr/bin/env bash
# VPS wrapper: gunluk otomatik logout — non-admin oturumlarinin sunucu tarafi
# iptali (auth.sessions delete, refresh token cascade). Frontend iat kontrolunun
# ana katmani; ayrinti: src/common/daily_logout_revoke.py docstring.
#
# /opt/oddskeeper/run_daily_logout.sh olarak kopyala. Crontab (VPS yerel saati
# Europe/Berlin: 01:59 CEST = 23:59 UTC; kis DST'de 00:59 UTC'ye kayar — zararsiz,
# script siniri kendisi hesaplar):
#   59 1 * * *  /opt/oddskeeper/run_daily_logout.sh
set -uo pipefail
export PYTHONUTF8=1
PIPE="/opt/oddskeeper/repo/oddskeeper-web/pipeline"
VENV="/opt/oddskeeper/venv/bin/python"
LOG="/opt/oddskeeper/logs/daily_logout.log"
LAST="/opt/oddskeeper/logs/daily_logout_last.log"

TMP="$(mktemp)"
if "$VENV" "$PIPE/src/common/daily_logout_revoke.py" > "$TMP" 2>&1; then
  rc=0
else
  rc=$?
fi
{ echo "===== $(date -u '+%F %T UTC') (rc=$rc) ====="; cat "$TMP"; } > "$LAST"
cat "$LAST" >> "$LOG"
rm -f "$TMP"
exit "$rc"
