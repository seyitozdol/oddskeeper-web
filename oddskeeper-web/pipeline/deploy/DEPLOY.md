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

# 4b) BMBets oranları (saf HTTP, tarayıcı/proxy YOK; domestic+Avrupa+hazırlık):
#     3 saatte bir (ücretsiz, hafif)
15 */3 * * *  /opt/oddskeeper/run_bmbets.sh

# 5) Manuel tetik kontrolü (admin butonu): dakikada bir; bekleyen tetik varsa
#    pipeline'ı bir kez çalıştırır (flock ile üst üste binmez). Scheduled 1-4
#    işleri kendi sabit saatlerinde ETKİLENMEDEN devam eder.
* * * * *  /opt/oddskeeper/run_trigger_check.sh

# 6a) BSL basketbol maç-sonrası OTOMATİK akış (kaynak FlashScore, 2026-09-19): futbol
#    match_scrape kalıbı. Saf HTTP (proxy/tarayıcı/sezon id'si YOK); tip-off + 2.5 saat geçmiş,
#    yüklenmemiş maçları çekip basketball.*'a yazar (source='flashscore'), Tools matview'larını
#    tazeler, kadro tablosunu (team_rosters) maçtan günceller. Maç yoksa tek istekle çıkar.
#    Kimlik fs_player_id ile; geçmiş oyuncuların id'si build_fs_player_bridge.py ile bağlandı.
#    Çift yazım koruması: aynı maç başka kaynaktan yazılmışsa atlar (6b AÇILIRSA çakışmaz).
*/10 * * * *  /opt/oddskeeper/run_bsl_match_scrape.sh

# 6b) TBF basketbol box-score (headful+xvfb+TR proxy → basketball.*): YEDEK, KAPALI.
#    6a devredeyken GEREKMEZ (tek farkı fouls_drawn alanı). Açılacaksa: run_tbf_basketball.sh
#    içindeki TBF_LEAGUE_ID/TBF_SEASON_ID/TBF_SEASON_LABEL her sezon elle güncellenir.
#    KİMLİK (2026-09-19): scraper tbf id'si olmayan oyuncu/takımı MEVCUT kayda bağlar
#    (src/basketball/identity.py: tam isim → tek aday; sponsorlu takım adı → TEAM_KEYWORDS).
#    Bağlayamadığı ama benzeri olan kimlik basketball.identity_review'a düşer ve wrapper
#    ntfy atar; birleştirme analytics.bb_pm_player_merges (alias→canonical) ile yapılır.
#    İLK AÇILIŞTAN ÖNCE (bir kez): geçmiş sezon oyuncularına tbf id backfill'i, isimsiz:
#      xvfb-run -a $VENV $PIPELINE/src/basketball/fetch_tbf_bsl.py --league-id 20728 --season-id 172 \
#        --season-label 2025-2026 --dry-run --dump-json /tmp/tbf_2025-2026.json
#      $VENV $PIPELINE/src/basketball/backfill_tbf_player_ids.py /tmp/tbf_2025-2026.json          # rapor
#      $VENV $PIPELINE/src/basketball/backfill_tbf_player_ids.py /tmp/tbf_2025-2026.json --apply
# 0 6 * * *   /opt/oddskeeper/run_tbf_basketball.sh

# 6c) EuroLeague + EuroCup maç-sonrası OTOMATİK akış (kaynak api-live.euroleague.net v2, 2026-09-28):
#    6a kalıbı, BSL'den 5 dk kaydırmalı. Açık API (proxy/tarayıcı yok); sezon kodu elle verilmez
#    (identity.current_season_label, sınır 1 Temmuz: E2026/U2026). Adaylar DB'den seçilir: tip-off +
#    2.5 saat geçmiş, 14 günden yeni, team_match_stats'ı olmayan maçlar (maç yoksa HTTP isteği yok).
#    Tip-off + 20 saatte box bir kez daha çekilir (resmi istatistik düzeltmesi, "duzeltildi").
#    00/06/12/18 turlarında program API ile eşitlenir: ertelenen maç/saat, takım değişimi; oynanmamış
#    ve istatistiksiz bayat maç/takım silinir. game_date GERÇEK UTC (API utcDate).
#    Yükleme/düzeltme olunca: el_player_metric_window_v1 CONCURRENTLY tazelenir, EL->BSL bağlayıcısı
#    (match_euroleague_bsl.py --auto; 06 turunda --auto --people) koşar, yeni bağ kurulursa
#    build_bsl_squad_audit.py. Log: logs/euro_match_scrape.log (yalnız bir şey olunca yazılır).
#    ntfy: çökme -> "EL/EC mac scrape FAILED" (high); "[kimlik] INCELEME" -> "EL/EC kimlik incelemesi".
#    Env (pipeline/.env, opsiyonel): EL_MIN_AGE_H=2.5 EL_MAX_AGE_D=14 EL_SETTLE_H=20 EL_RUN_INTERVAL_MIN=10
#    Kurulum ve elle komutlar: aşağıda "EL/EC otomatik akış (İş 6c)".
5-59/10 * * * *  /opt/oddskeeper/run_euro_match_scrape.sh

# 7) TSL kadro tazeleme (apifootball squads -> team_squad_current -> player_mapping
#    -> TM piyasa değeri): yeni transferler kadroya girsin. Proxy/tarayıcı YOK.
#    GEÇİCİ: TSL maçları BAŞLAYANA KADAR günlük; sezon başlayınca bu satırı kaldır
#    (maçlar başlayınca kadrolar maç scrape'inden zaten güncellenir). 05:00 (CEST).
0 5 * * *     /opt/oddskeeper/run_tsl_squad_refresh.sh

# 8) Günlük otomatik logout (non-admin oturum iptali, auth.sessions delete):
#    01:59 CEST = 23:59 UTC (kışın 00:59 UTC'ye kayar, zararsız — script sınırı
#    kendisi hesaplar). Frontend iat kontrolünün ana katmanı.
59 1 * * *    /opt/oddskeeper/run_daily_logout.sh

# 9) EuroVolley 2026 (CEV, kadın): TURNUVA PENCERELİ (21 Ağu–6 Eyl 2026).
#    Akşam koşusu günün maçlarını + CEV istatistiklerini çeker; sabah yedeği
#    gece işlenen veriyi süpürür. Wrapper 2026-09-08'den itibaren no-op;
#    turnuva bitince bu iki satırı kaldır.
30 22 * * *   /opt/oddskeeper/run_eurovolley.sh
15 8 * * *    /opt/oddskeeper/run_eurovolley.sh
```
`public.pipeline_triggers` tablosu gerekir (sql/2026-07-31_pipeline_triggers.sql).
Wrapper'ları kopyala: `cp oddskeeper-web/pipeline/deploy/run_*.sh /opt/oddskeeper/ && chmod +x /opt/oddskeeper/run_*.sh`

**Maç-sonrası scrape (İş 0):** `run_match_scrape.sh` yeni; `fetch_sofascore_matches.py`
artık TSL + 1.Lig'i (LEAGUES: ut=52 + ut=98) besler. Mevcut `run_sofascore.sh`
(3 saatlik uzun-kuyruk düzeltme işi, grace 4-60s) da aynı LEAGUES'ten 1.Lig'i
kapsar; ikisi de idempotent, çakışma zararsız. Kurulum: `cp .../run_match_scrape.sh
/opt/oddskeeper/ && chmod +x /opt/oddskeeper/run_match_scrape.sh` + cron İş 0.
`.env`'e `API_FOOTBALL_KEY` ekli olmalı (bet365 işi için).

**EL/EC otomatik akış (İş 6c):** `run_euro_match_scrape.sh` yeni (repo'daki `git pull` /opt kopyasını
güncellemez). ÖNCE iki SQL (scrape cron'larının koşmadığı bir dakikada, ör. :02-:03 ya da :07-:08):
`sql/2026-09-28_metric_window_season_partition.sql` (yoksa ilk 26/27 yüklemesi 25/26 Tools'unun
son-5/10'unu bozar) ve `sql/2026-09-28_euroleague_link_fk.sql`. Sonra kurulum:
```bash
cp /opt/oddskeeper/repo/oddskeeper-web/pipeline/deploy/run_euro_match_scrape.sh /opt/oddskeeper/
chmod +x /opt/oddskeeper/run_euro_match_scrape.sh
# crontab -e -> 5-59/10 * * * *  /opt/oddskeeper/run_euro_match_scrape.sh
EURO_FORCE_SYNC=1 /opt/oddskeeper/run_euro_match_scrape.sh   # ilk tur: programı hemen eşitle (saatler UTC'ye)
```
Elle (`cd /opt/oddskeeper/repo/oddskeeper-web/pipeline`, `V=/opt/oddskeeper/venv/bin/python`):
```bash
$V src/basketball/fetch_euroleague.py --auto --sync-schedule --dry-run   # ne yapacağını göster, DB'ye yazmaz
# BİR KEZ: geçmiş sezon saatlerini UTC'ye düzelt (eski loader Madrid saatini UTC diye yazıyordu, +1/+2 saat);
# düzeltme stats satırlarının game_date'ine de yayılır. Önce aynı komutu --dry-run ile çalıştır.
$V src/basketball/fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026 --schedule
$V src/basketball/fetch_euroleague.py --competition U --season-code U2025 --season-label 2025-2026 --schedule
# Geçmiş bir sezonun box-score'larını baştan yükle (backfill; tüm oynanmış maçlar). API Cloudflare
# hız sınırlı (429 "Error 1015", ~4 dk blok): --sleep 1 ile yavaş git; 429'da Retry-After kadar bekler.
$V src/basketball/fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026 --sleep 1
# EL->BSL bağlayıcısı elle (kulüp kadrolarıyla, önce --dry-run):
$V src/basketball/match_euroleague_bsl.py --auto --people
```
rc anlamı: 0 tamam; 1 beklenmeyen istisna (Traceback); 2 elle müdahale isteyen kalıcı sorun (Tools
matview refresh başarısız ya da EL-BSL bağ bütünlüğü: yetim/manuel/alias bağ). İkisinde de wrapper
"EL/EC mac scrape FAILED" ntfy'ı atar; log_triage bunları KRİTİK sayar.
İnceleme kuyruğu (`basketball.identity_review`, source='euroleague'): elle bağlayınca bağlayıcı kaydı
kendisi kapatır. "Mevcut bağ doğru, böyle kalsın" kararı için `status='ignored'` yap; `resolved`
"düzeltildi" demektir ve sorun tekrar görülürse kayıt yeniden açılıp bildirilir.
Sezon devri: 1 Temmuz'dan sonra yeni sezon (ör. E2027) API'de yayınlanana kadar program turu
`[el] E2027: sezon programi henuz yayinlanmadi` basar; hata değildir, loga da yazılmaz.

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
