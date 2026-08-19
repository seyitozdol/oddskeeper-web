#!/usr/bin/env bash
# anon-guard: yeni/degisen SQL'de anon'a yetki veren satirlari yakalar.
# Karar (2026-08-19, anon SELECT lockdown): site tamamen giris arkasinda,
# hicbir veri yuzeyi anon'a acilmaz. Bilincli istisna gerekirse ilgili
# satira ANON-IZINLI yorumu ekle.
#
# Kullanim: bash .github/scripts/check_no_anon_grants.sh [base_ref]
#   base_ref verilmezse origin/master, o da yoksa HEAD~1 ile kiyaslar.
set -euo pipefail

base="${1:-}"
if [ -z "$base" ]; then
  if git rev-parse --verify -q origin/master >/dev/null 2>&1; then
    base="origin/master"
  else
    base="HEAD~1"
  fi
fi

# Yalniz EKLENEN satirlara bak; yorum satirlari, revoke'lar ve ANON-IZINLI
# isaretli satirlar muaf. "to anon" hem grant hem alter default privileges
# desenlerini yakalar.
viol=$(git diff "$base"...HEAD -- '*.sql' 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -vE '^\+[[:space:]]*--' \
  | grep -viE 'revoke|ANON-IZINLI' \
  | grep -iE '\bto[[:space:]]+anon\b|\bto[[:space:]]+[a-z_, ]*\banon\b' || true)

if [ -n "$viol" ]; then
  echo "HATA: yeni SQL anon rolune yetki veriyor. Karar (2026-08-19): tum veri"
  echo "yuzeyi authenticated-only; anon'a grant yasak. Ihlal eden satirlar:"
  echo "$viol"
  echo ""
  echo "Bilincli istisna ise satira ANON-IZINLI yorumu ekle."
  exit 1
fi

echo "anon-guard: temiz"
