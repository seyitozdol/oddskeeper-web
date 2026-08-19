#!/usr/bin/env bash
# ntfy.sh push bildirimi (sahip karari 2026-08-19, mimari inceleme soru 10).
# Kullanim: notify.sh "Baslik" "mesaj" [priority]
#   priority: min|low|default|high|urgent (varsayilan default)
# NTFY_TOPIC pipeline/.env'den okunur; tanimli degilse SESSIZ cikar (bildirim
# opsiyonel katman, yoklugu is akisini durdurmaz). Telefonda ntfy uygulamasinda
# ayni topic'e abone olmak yeterli. /opt/oddskeeper/notify.sh olarak kopyala.
ENVF="/opt/oddskeeper/repo/oddskeeper-web/pipeline/.env"
TOPIC=$(grep -E '^NTFY_TOPIC=' "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"\r' | tr -d "'")
[ -z "$TOPIC" ] && exit 0
curl -s -m 10 \
  -H "Title: ${1:-oddskeeper}" \
  -H "Priority: ${3:-default}" \
  -H "Tags: rotating_light" \
  -d "${2:-uyari}" \
  "https://ntfy.sh/$TOPIC" >/dev/null 2>&1 || true
exit 0
