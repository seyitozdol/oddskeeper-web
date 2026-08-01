#!/usr/bin/env bash
# VPS wrapper: TBF (tbf.org.tr) BSL basketbol maç + oyuncu box-score scraper'ı.
# Headful Chromium + Xvfb + TR proxy (Cloudflare + TR-geo için ZORUNLU) → Supabase.
# Kimlik TBF playerId/teamId/matchId ile kurulur (isim varyantı sorun değil).
# /opt/oddskeeper/run_tbf_basketball.sh olarak kopyala. Detay: deploy/DEPLOY.md
#
# SEZON KONFİGÜRASYONU (yeni sezonda GÜNCELLE — id'ler her sezon değişir):
#   TBF_LEAGUE_ID   = ActivityId  (BSL 2025-2026 = 20728)
#   TBF_SEASON_ID   = seasonId    (2025-2026 = 172)
#   TBF_SEASON_LABEL= etiket       (ör. 2026-2027)
# Yeni sezon id'lerini bulmak: bir maç-detay sayfasını aç, /api/Match/mac-header
# yanıtındaki faaliyetId (=league) ve seasonId'ye bak (bkz. tbf-scraping notu).
set -uo pipefail
export PYTHONUTF8=1

VENV=/opt/oddskeeper/venv/bin/python
PIPELINE=/opt/oddskeeper/repo/oddskeeper-web/pipeline
LOG=/opt/oddskeeper/logs
mkdir -p "$LOG"

# GÜVENLİK: fallback YOK. Yeni sezon id'leri açıkça set edilmeden ÇALIŞMAZ (no-op).
# Böylece yanlışlıkla tıklama geçmiş sezonu (2025-2026) yeniden çekip veriyi ÇİFTLEMEZ.
# Yeni sezon başlayınca bu üç değeri burada set et (id'ler bir mac-header'dan bulunur).
TBF_LEAGUE_ID="${TBF_LEAGUE_ID:-}"
TBF_SEASON_ID="${TBF_SEASON_ID:-}"
TBF_SEASON_LABEL="${TBF_SEASON_LABEL:-}"

if [ -z "$TBF_LEAGUE_ID" ] || [ -z "$TBF_SEASON_ID" ] || [ -z "$TBF_SEASON_LABEL" ]; then
  echo "$(date '+%F %T') TBF sezon konfigure degil (TBF_LEAGUE_ID/SEASON_ID/SEASON_LABEL bos), atlandi" >> "$LOG/tbf_basketball.log"
  exit 0
fi

# Tek koşu: manuel/scheduled aynı anda çift proxy GB + Xvfb çakışmasın.
exec 9>/tmp/ok_tbf_basketball.lock
flock -n 9 || { echo "$(date '+%F %T') tbf_basketball zaten calisiyor, atlandi" >> "$LOG/tbf_basketball.log"; exit 0; }

# Tüm haftaları tara, oynanmış maçları id-anchored upsert et (tekrar çalışınca idempotent).
xvfb-run -a "$VENV" "$PIPELINE/src/basketball/fetch_tbf_bsl.py" \
  --league-id "$TBF_LEAGUE_ID" --season-id "$TBF_SEASON_ID" --season-label "$TBF_SEASON_LABEL" \
  >> "$LOG/tbf_basketball.log" 2>&1
