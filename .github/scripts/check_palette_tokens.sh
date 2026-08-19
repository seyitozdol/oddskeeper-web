#!/usr/bin/env bash
# Tema token bekcisi (D-1, karar 2026-08-19): frontend'de hardcoded Tailwind
# palet sinifi (text-emerald-300, bg-amber-500/15, ...) yasak; renkler yalniz
# globals.css'teki tema tokenlarindan gelir (ink/accent/pos/neg/warn/...).
# Gerekce: calimla-light temasinda acik tonlu paletler okunmaz hale geliyordu
# (ARCHITECTURE_REVIEW.md D-1).
#
# Izinli istisnalar:
#   - Ayni satirda dark: varyantiyla iki-tonlu yazilmis bilincli ciftler
#     (or. text-fuchsia-700 dark:text-fuchsia-400); dark: varyanti
#     globals.css'te data-theme'e baglidir, iki tema da okunur kalir.
#   - ALLOW listesindeki dosyalar: legacy route adasi (C-4'te silinecek) ve
#     kendi sabit koyu zeminini boyayan giris sayfalari.
#   - Marka renkleri zaten keyfi hex ile yazilir (bg-[#0aa84f]), tarama disi.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FRONTEND="oddskeeper-web/frontend"

ALLOW=(
  "$FRONTEND/app/matches/"
  "$FRONTEND/app/basketball/"
  "$FRONTEND/app/sign-in/"
  "$FRONTEND/app/sign-up/"
  "$FRONTEND/app/page.tsx"
  "$FRONTEND/components/MatchCard.tsx"
  "$FRONTEND/components/AppHeader.tsx"
  "$FRONTEND/components/StateMessage.tsx"
)

PALETTE='(text|bg|border|ring|from|to|via|divide|outline|decoration|shadow)-(red|green|blue|emerald|amber|rose|slate|zinc|gray|neutral|stone|yellow|orange|lime|teal|cyan|sky|indigo|violet|purple|fuchsia|pink)-[0-9]{2,3}'

hits=$(grep -rnE "$PALETTE" \
  --include='*.tsx' --include='*.ts' \
  "$FRONTEND/app" "$FRONTEND/components" "$FRONTEND/features" "$FRONTEND/lib" \
  | grep -v 'dark:' || true)

for allow in "${ALLOW[@]}"; do
  hits=$(printf '%s\n' "$hits" | grep -v "^$allow" || true)
done

hits=$(printf '%s\n' "$hits" | grep -v '^$' || true)

if [ -n "$hits" ]; then
  echo "HATA: hardcoded Tailwind palet sinifi bulundu. Tema tokeni kullan"
  echo "(text-ink/pos/neg/warn/accent-ink, bg-card/veil/accent, ...) ya da"
  echo "bilincli iki-tonlu cift yaz (or. text-X-700 dark:text-X-300)."
  echo
  printf '%s\n' "$hits"
  exit 1
fi

echo "OK: palet sinifi yok, tema tokenlari kullaniliyor."
