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
Sunucu saati UTC. Üç iş:
```cron
# 1) Yaklaşan maçlar (SofaScore proxy'den; tracker.upcoming_events besler): 3 saatte bir
30 */3 * * *  /opt/oddskeeper/run_upcoming_events.sh

# 2) Bets10 oranları (headful+xvfb+TR proxy, capture+load): 6 saatte bir (GB ücretli)
0 */6 * * *   /opt/oddskeeper/run_odds_capture.sh

# 3) bet365 oranları (API-Football, tarayıcısız; Avrupa maçları): 3 saatte bir (ucuz)
45 */3 * * *  /opt/oddskeeper/run_bet365_odds.sh

# 4) OddsPortal oranları (headful+xvfb, proxy YOK; domestic+Avrupa): 6 saatte bir
30 */6 * * *  /opt/oddskeeper/run_oddsportal.sh
```
Wrapper'ları kopyala: `cp oddskeeper-web/pipeline/deploy/run_*.sh /opt/oddskeeper/ && chmod +x /opt/oddskeeper/run_*.sh`
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
