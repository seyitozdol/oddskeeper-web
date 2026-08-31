#!/usr/bin/env bash
# Gunluk log ozeti (sahip karari 2026-08-19, mimari inceleme B-1 Faz 1;
# 2026-08-31 triyaj katmani eklendi, sahip istegi).
# ONCE Python triyaji calisir (log_triage.py): satirlari NOISE/WARN/CRIT diye
# siniflar, kendini-toparlamayi ve tekrar esigini hesaplar, karari basliga
# yazan TEK ntfy mesaji atar (temiz gunde dusuk oncelikli OK heartbeat).
# Triage COKERSE asagidaki eski ham grep ozeti fallback olarak devreye girer
# ve ayrica "triage coktu" bildirimi gider: bildirim katmani asla sessiz olmaz.
# Cron: 10 7 * * * /opt/oddskeeper/log_digest.sh >> /opt/oddskeeper/logs/digest.log 2>&1
# Durum dosyalari: /opt/oddskeeper/digest_state/<log>.pos (son okunan satir;
# triage ile fallback AYNI pos dosyalarini kullanir) + triage_history.json.
set -uo pipefail
LOGDIR=/opt/oddskeeper/logs
STATE=/opt/oddskeeper/digest_state
NOTIFY=/opt/oddskeeper/notify.sh
PY=/opt/oddskeeper/venv/bin/python
TRIAGE=/opt/oddskeeper/repo/oddskeeper-web/pipeline/src/common/log_triage.py

if [ -x "$PY" ] && [ -f "$TRIAGE" ]; then
  "$PY" "$TRIAGE"
  rc=$?
  [ "$rc" -eq 0 ] && exit 0
  echo "$(date -u '+%F %T UTC') TRIAGE FAILED rc=$rc - ham fallback devrede"
  "$NOTIFY" "oddskeeper: log triage COKTU" "log_triage.py rc=$rc ile dustu; ham ozet ayri mesajda, detay digest.log'da." high
fi

# --- eski ham akis (fallback; triage pos yazmadan dustugu icin ayni chunk'i gorur) ---
# K-2 (2026-08-20): fetcher lig hatalari "[Super Lig] HATA: ..." bicimindedir;
# eski '\[HATA\]' deseni bunu YAKALAMIYORDU. ' HATA:' o sinifi, 'UYARI' da
# mat-refresh/kimlik/coverage uyarilarini kapsar.
PATTERN='FAILED|Traceback|FAIL:|\[HATA\]| HATA:|UYARI|NotNullViolation|SystemExit'
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
