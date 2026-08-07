# VPS Dağıtım — Upcoming Events + Oran Yakalama

7/24 Netcup VPS'te cron ile çalışır. Otomasyon **bu makinede değil**, sunucuda.

## Sunucu düzeni
- Repo: `/opt/oddskeeper/repo/oddskeeper-web/` (git pull ile güncellenir)
- Pipeline: `/opt/oddskeeper/repo/oddskeeper-web/pipeline/`
- Venv: `/opt/oddskeeper/venv/bin/python` (repo dışında)
- Secrets: `pipeline/.env` (git'e girmez)
- Wrapper'lar: `/opt/oddskeeper/run_*.sh`, loglar `/opt/oddskeeper/logs/`
- Erişim: `ssh -i ~/.ssh/oddskeeper_netcup root@159.195.219.130`

## Güncelleme akışı
```bash
cd /opt/oddskeeper/repo/oddskeeper-web && git pull
```

## Tek seferlik kurulum
```bash
/opt/oddskeeper/venv/bin/pip install -r oddskeeper-web/pipeline/requirements.txt
# Oran yakalama (İş 2) için Chromium:
/opt/oddskeeper/venv/bin/playwright install chromium
# xvfb sistemde kurulu olmalı (Opta işinden var). Yoksa: apt install -y xvfb

# Wrapper'ları kopyala + çalıştırılabilir yap:
cp oddskeeper-web/pipeline/deploy/run_upcoming_events.sh /opt/oddskeeper/
cp oddskeeper-web/pipeline/deploy/run_odds_capture.sh   /opt/oddskeeper/
chmod +x /opt/oddskeeper/run_upcoming_events.sh /opt/oddskeeper/run_odds_capture.sh
```

## .env anahtarları
`pipeline/.env.example`'a bakın. Bu iş için gerekenler:
- `DATABASE_URL` — upcoming_events psycopg2 ile yazar
- `PROXY_URL` — SofaScore residential proxy (zaten var)
- `PROXY_ODDS_TR` — Bets10 için **TR-geo + sticky** proxy. DataImpulse username eki:
  ```
  PROXY_ODDS_TR=http://<user>__cr.tr;session-{session}:<pass>@gw.dataimpulse.com:823
  ```
  `{session}` yer tutucusu her koşuda yeni sticky id ile değiştirilir (oturum boyunca sabit IP).

## Cron (`crontab -e`)
**Sunucu yerel saati Europe/Berlin (CEST, UTC+2) ve cron BU yerel saatte tetikler**
(eskiden "UTC" yazıyordu, yanlıştı; loglardaki UTC damgaları `date -u`'dan gelir).
İşler:
```cron
# 0) Maç-sonrası hızlı scrape (SofaScore ana; TSL + 1.Lig): her 10 dk polling.
#    Bitmiş ve kickoff+2.5..6s penceresindeki maçları çeker (~ bitiş +30 dk),
#    idempotent + flock. Faz 2'de FlashScore overlay eklenecek.
*/10 * * * *  /opt/oddskeeper/run_match_scrape.sh

# 0b) FlashScore->SofaScore oyuncu eşlemesi (ref.flashscore_player_map): günde bir.
#     Yeni sezon oyuncularını eşler → tff1 FS overlay (xg/xgot/xa/kart/pozisyon)
#     görünür olur. DB-driven, idempotent, proxy yok. 04:00 (CEST).
0 4 * * *     /opt/oddskeeper/run_fs_player_map.sh

# 1) Yaklaşan maçlar (SofaScore proxy'den; tracker.upcoming_events besler): 3 saatte bir
30 */3 * * *  /opt/oddskeeper/run_upcoming_events.sh

# 2) Bets10 oranları (headful+xvfb+TR proxy, capture+load): 6 saatte bir (GB ücretli)
0 */6 * * *   /opt/oddskeeper/run_odds_capture.sh

# 3) bet365 oranları (API-Football, tarayıcısız; Avrupa maçları): 3 saatte bir (ucuz)
45 */3 * * *  /opt/oddskeeper/run_bet365_odds.sh

# 4) OddsPortal oranları (headful+xvfb, proxy YOK; domestic+Avrupa): 6 saatte bir
30 */6 * * *  /opt/oddskeeper/run_oddsportal.sh

# 5) Manuel tetik kontrolü (admin butonu): dakikada bir; bekleyen tetik varsa
#    pipeline'ı bir kez çalıştırır (flock ile üst üste binmez). Scheduled 1-4
#    işleri kendi sabit saatlerinde ETKİLENMEDEN devam eder.
* * * * *  /opt/oddskeeper/run_trigger_check.sh

# 6) TBF basketbol box-score (headful+xvfb+TR proxy → basketball.*): HAZIR AMA KAPALI.
#    BSL yeni sezon BAŞLAMADI. Sezon başlayınca: run_tbf_basketball.sh içindeki
#    TBF_LEAGUE_ID/TBF_SEASON_ID/TBF_SEASON_LABEL'i yeni sezona göre güncelle,
#    sonra bu satırı aç (günde bir yeter; maçlar haftalık, idempotent upsert).
# 0 6 * * *   /opt/oddskeeper/run_tbf_basketball.sh
```
`public.pipeline_triggers` tablosu gerekir (sql/2026-07-31_pipeline_triggers.sql).
Wrapper'ları kopyala: `cp oddskeeper-web/pipeline/deploy/run_*.sh /opt/oddskeeper/ && chmod +x /opt/oddskeeper/run_*.sh`

**Maç-sonrası scrape (İş 0):** `run_match_scrape.sh` yeni; `fetch_sofascore_matches.py`
artık TSL + 1.Lig'i (LEAGUES: ut=52 + ut=98) besler. Mevcut `run_sofascore.sh`
(3 saatlik uzun-kuyruk düzeltme işi, grace 4-60s) da aynı LEAGUES'ten 1.Lig'i
kapsar; ikisi de idempotent, çakışma zararsız. Kurulum: `cp .../run_match_scrape.sh
/opt/oddskeeper/ && chmod +x /opt/oddskeeper/run_match_scrape.sh` + cron İş 0.
`.env`'e `API_FOOTBALL_KEY` ekli olmalı (bet365 işi için).

## İş 2 — SPIKE (parser yazmadan önce, ZORUNLU)
`capture_odds_vps.py` şu an yalnızca ağı kaydeder. Önce dump al, incele:
```bash
cd /opt/oddskeeper/repo/oddskeeper-web/pipeline
xvfb-run -a /opt/oddskeeper/venv/bin/python \
  src/common/capture_odds_vps.py bets10 --pages futbol-turkiye-1lig --per-league 3
# çıktı: data/odds/netcap_bets10_*.json
```
Dump'ta bakılacak: oran **XHR json'da mı** (kullanıma hazır) yoksa **WS binary'de mi**
(çözüm gerekir)? TR geo doğru mu (yanıtlarda ülke/oran mantıklı mı)? Buna göre
`parse_bets10_network.py` yazılır, sonra wrapper'a `--load` eklenir.

## Notlar
- **GB tasarrufu:** harness image/font/media/casino/analitik isteklerini abort eder;
  yalnızca sportsbook API + WS proxy'den geçer. Yine de DataImpulse panelinden GB izleyin.
- **Geo:** Bets10 TR exit IP ister. bet365 Türkiye'den çekildiği için TR IP'den
  erişilemeyebilir — ayrı geo gerekebilir veya ertelenir (spike'ta netleşir).
- Doğrulama: fetch sonrası `analytics.upcoming_events_v1`, oran sonrası
  `analytics.upcoming_event_odds_v1` dolu olmalı; açılış sayfasında görünür.
