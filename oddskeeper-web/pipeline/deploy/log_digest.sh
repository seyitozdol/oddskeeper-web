#!/usr/bin/env bash
# Gunluk log ozeti (sahip karari 2026-08-19, mimari inceleme B-1 Faz 1):
# son kosudan beri /opt/oddskeeper/logs/*.log'a eklenen satirlarda hata
# isaretlerini arar; bulursa TEK ntfy mesaji atar. Boylece hicbir sessiz
# arizanin gorunmezligi 24 saati gecmez (1.Lig foto sync 4 gun sessiz
# cokmustu, bu katman onu 1. gun yakalardi).
# Cron: 10 7 * * * /opt/oddskeeper/log_digest.sh >> /opt/oddskeeper/logs/digest.log 2>&1
# Durum dosyalari: /opt/oddskeeper/digest_state/<log>.pos (son okunan satir)
set -uo pipefail
LOGDIR=/opt/oddskeeper/logs
STATE=/opt/oddskeeper/digest_state
NOTIFY=/opt/oddskeeper/notify.sh
PATTERN='FAILED|Traceback|FAIL:|\[HATA\]|NotNullViolation|SystemExit'
mkdir -p "$STATE"

summary=""
for f in "$LOGDIR"/*.log; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  [ "$base" = "digest.log" ] && continue
  posf="$STATE/$base.pos"
  total=$(wc -l < "$f")
  last=0; [ -f "$posf" ] && last=$(cat "$posf")
  # rotasyon/kucultme durumunda bastan basla
  [ "$last" -gt "$total" ] && last=0
  new=$(tail -n +$((last+1)) "$f")
  echo "$total" > "$posf"
  hits=$(printf '%s\n' "$new" | grep -cE "$PATTERN" || true)
  if [ "$hits" -gt 0 ]; then
    ornek=$(printf '%s\n' "$new" | grep -E "$PATTERN" | head -3 | cut -c1-160 | paste -sd' || ' -)
    summary="${summary}${base}: ${hits} hata isareti. Ornek: ${ornek}
"
  fi
done

if [ -n "$summary" ]; then
  "$NOTIFY" "oddskeeper log ozeti (son 24s)" "$summary" high
  echo "$(date -u '+%F %T UTC') bildirim gonderildi:"
  printf '%s' "$summary"
else
  echo "$(date -u '+%F %T UTC') temiz"
fi
