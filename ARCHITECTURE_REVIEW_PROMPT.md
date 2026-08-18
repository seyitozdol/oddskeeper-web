# Mimari İnceleme Görevi (Uçtan Uca, SALT-OKUNUR)

> Bu dosyayı incelemeyi yapacak oturuma olduğu gibi ver:
> "ARCHITECTURE_REVIEW_PROMPT.md dosyasını baştan sona oku ve görevi aynen uygula."

## GÖREV

Mevcut mimariyi uçtan uca, KANITA DAYALI incele ve raporla. Dört boyut:
veri katmanı (tablolama), scraping/pipeline, gösterim (servis+frontend), görsel/UX.

1. Hızlandırma önerilerini ÖLÇÜMLE birlikte sun. UYGULAMA YAPMA.
2. Mimaride ciddi hata var mı? Varsa kanıtıyla göster (dosya:satır, sorgu çıktısı, ölçüm).
3. Hata olmasa da "doğru mimari" için önerilerini ver: neyin nereye evrilmesi gerektiği,
   etki ve emek tahminiyle.

**KESİN SINIR: hiçbir şeyi DEĞİŞTİRME.** Kod yazma, dosya düzenleme (rapor dosyası hariç),
DB'ye yazma, mat refresh tetikleme, deploy, cron değişikliği YOK. DB'de yalnız SELECT
(ve `explain analyze select ...`) serbest. VPS'te yalnız okuma komutları (cat, ls, crontab -l).

## PROJE BAĞLAMI (yeniden keşfetme)

- Ürün: Türkiye futbolu merkezli istatistik + model platformu (pixellious.com).
  Kapsam: Süper Lig (Opta+SofaScore+FlashScore), 1. Lig (SofaScore), Türkiye Kupası
  (Mackolik/Opta), Avrupa kupaları CL/EL/Konferans (SofaScore+FlashScore overlay),
  basketbol (BSL/TBF + EuroLeague), voleybol; Bets10 oran yakalama; MSM/PSM model ekranları.
- Repo: `oddskeeper-web/frontend` (Next.js 16, Vercel), `oddskeeper-web/pipeline`
  (Python scraper/joblar, VPS'te cron), `oddskeeper-web/sql` (migration kayıtları).
- DB: Supabase (proje `oddskeeper-db`), Micro instance (~1 GB RAM, work_mem authenticator'da
  8MB). Frontend PostgREST üzerinden anon/authenticated rolleriyle okur; PostgREST
  `db-max-rows=1000` (tek istekte en fazla 1000 satır, sayfalama şart).
- VPS: `ssh -i ~/.ssh/oddskeeper_netcup root@159.195.219.130`, repo `/opt/oddskeeper/repo`,
  venv `/opt/oddskeeper/venv`, loglar `/opt/oddskeeper/logs/`, cron `crontab -l`.
- Lokal DB sorgusu: `pipeline/.venv/Scripts/python.exe` + psycopg2, bağlantı
  `pipeline/.env` içindeki DATABASE_URL. Yalnız SELECT; autocommit AÇMA.
- Dev doğrulama: lokalde çalışan dev server'a bağlan (localhost:3000, auth bypass admin
  gibi davranır); Next aynı dizinde ikinci dev server açtırmaz, mevcut olana URL ile bağlan.
- Memory dizinindeki proje notları arka plan bilgisidir; iddiaları güncel koda karşı doğrula.

## YARGI ÇERÇEVESİ (sahibin ilkeleri; önerileri bunlara göre süz)

- Bir varlık (oyuncu/takım/maç) = tek kanonik kimlik = tek profil = tek foto.
  Rekabet kırılımı sayfanın İÇİNDE (kolon/rozet/filtre), asla ayrı sayfa + geçiş düğmesi değil.
- "Mimari önce": bir işe başlamadan nereye dokunduğu ve neyi bağlaması gerektiği çıkarılır.
  Parçalanma (aynı varlık için çoklu kimlik/sayfa/foto) kırmızı bayraktır.
- Süper Lig yüzeyleri merkezdir; onları riske atan öneri ancak güçlü gerekçeyle önerilir.
- Sade yerel Türkçe; kullanıcıya görünen metinlerde TR/EN ikili dil düzeni vardır.

## BOYUT A: VERİ KATMANI / TABLOLAMA

Envanter çıkar, sonra değerlendir:

1. Şema envanteri: `football`, `analytics`, `ref`, `tracker`, `basketball`, `volleyball`,
   `euroleague` (+ varsa diğerleri). Tablo/view/matview sayıları, en büyük 10 nesne
   (pg_total_relation_size), toplam DB boyutu, şişme (bloat) kaba kontrolü.
2. Kimlik uzayları haritası: opta, sofascore, apifootball (af/aftm), flashscore, transfermarkt
   id'leri hangi tablolarda; eşleme tabloları envanteri (`ref.player_mapping`,
   `ref.sofascore_opta_player_map`, `ref.apifootball_sofascore_player_map`,
   `ref.flashscore_sofa_match_map`, `ref.flashscore_sofa_cup_player_map`, `ref.team_mapping`,
   sentetik `ss`/`af-` önekleri). DEĞERLENDİR: eşleme katmanları tek tutarlı desene
   toplanabilir mi (kimin truncate+insert, kimin additive, kimin view-canlı olduğu);
   çift af id (native+tm) gibi istisnalar nerede patlayabilir.
3. View zinciri derinliği: analytics'te kaçıncı dereceden view-üstü-view var
   (pg_depend ile zincirleri çıkar). Aynı mantığın (örn. maç sonucu W/D/L hesabı,
   ev/deplasman çevirisi, kaynak önceliği dedup) kaç view'da kopyalandığını say.
   DEĞERLENDİR: ortak mantık SQL fonksiyonuna/base view'a alınmalı mı.
4. Matview stratejisi: tüm mat'ların listesi, her birinin refresh süresi (loglardan ya da
   tek seferlik ölçümle DEĞİL, tahmini satır sayısı + son refresh log'larından), hangi cron
   hangi sırayla tazeliyor, REFRESH sırasında okuyucu kilidi etkisi (concurrently
   kullanılmıyor; unique index olanlar concurrently'ye geçebilir mi). Maç günü CPU
   sıçraması bilinen bir şikayet.
5. `raw_stats` jsonb deseni: hangi tablolar ham jsonb saklıyor, view'lar kaç anahtarı
   her sorguda parse ediyor; sık kullanılan metrikler için üretilmiş kolon
   (generated column) ya da mat önerisi mantıklı mı.
6. İndeks kapsaması: en sık filtrelenen kolonlarda (source_player_id, source_team_id,
   player_slug, team_slug, competition, season_label, match_datetime) indeks var mı;
   kullanılmayan indeksler (pg_stat_user_indexes idx_scan=0).
7. Grant/güvenlik düzeni: anon'a açık view yüzeyinin tamamı; yazma yüzeyi (pm_* server
   route'a taşındı, anon-write revoke DEPLOY SONRASI bekliyor olabilir, kontrol et);
   RLS kullanılmıyorsa bilinçli mi.
8. Tek doğruluk kaynağı ihlalleri: aynı bilginin birden çok yerde bağımsız üretildiği
   yerler (örn. takım adı/logosu kaç kaynakta; sezon etiketi hesabı; kart sayımı).

## BOYUT B: SCRAPING / PIPELINE

1. Cron haritası: VPS `crontab -l` çıktısını çöz; her girdinin script'i, sıklığı, kilidi
   (flock var mı), log dosyası. `run_match_scrape.sh` adımlarını (SofaScore, FlashScore
   fallback 2b/2c, mat refresh 3b, bets10 bağı) sırala.
2. Kaynak envanteri: SofaScore (curl_cffi, proxy koşulları), FlashScore (lsapp/ninja feed,
   x-fsign), Opta/Mackolik, API-Football, Transfermarkt, Bets10 (DataImpulse sticky),
   OddsPortal. Her biri için: kimlik uzayı, hangi tablolara yazar, idempotency
   (upsert mi, silip-yaz mı), kısmi hata davranışı.
3. Dayanıklılık: bir kaynak 403/timeout verdiğinde ne olur; yarım yazım riski (transaction
   sınırları); yeniden koşmada çift kayıt riski; alerting (hata olursa kim nasıl duyar,
   mapping_health_check haftalık cron'u ne kontrol ediyor).
4. İsraf/verim: bilinen konu Bets10 odds_capture WS akışı (~60 MB/koşu, kullanılmıyor);
   başka benzer israf var mı (gereksiz tam-tablo çekimleri, kullanılmayan yazımlar).
5. Kimlik eşleme akışının bütünlüğü: yeni oyuncu/takım geldiğinde uçtan uca hangi adımlar
   tetiklenmeli (map builder, bridge script'leri, squad refresh, mat refresh) ve bunlar
   otomatik mi manuel mi. Manuel kalanların otomasyona alınma önerisi.
6. Kod sağlığı: pipeline script'lerinde ortak yardımcıların (norm, tokens, team_key,
   psycopg2 bağlantı kalıbı) kopyalanma derecesi; ortak modül önerisi.

## BOYUT C: GÖSTERİM / SERVİS KATMANI

1. Sayfa başına sorgu profili: dev server'da şu sayfaları aç ve sunucu tarafı PostgREST
   isteklerini say/ölç (network sekmesi yetmez, SSR istekleri için loader kodunu oku ve
   çağrı sayısını çıkar): TSL hub (league/players/rankings), takım profili (overview/
   results/squad/player-stats), oyuncu profili (overview/match-log), kupa ekranları
   (league/players/teams/match), 1. Lig, MSM/PSM ekranları, Upcoming Events.
   Her sayfa için: istek sayısı, tahmini satır hacmi, tam-tablo taramaları.
2. Bilinen desen riskleri: PostgREST 1000 satır sınırı (sayfalamasız .select bir yerde
   kaldı mı, grep ile tara); tam-katalog asset map'leri (getPlayerAssets tarzı) hangi
   sayfalarda hala tam tarama; react cache() kullanımı tutarlı mı; aynı verinin bir render
   içinde iki kez çekildiği yerler.
3. Veri katmanı ile sözleşme: `select("*")` + TS cast deseninin kırılganlığı (view kolonu
   değişince sessiz bozulma); kolon listesi açık yazılan/yazılmayan loader oranı.
4. Route organizasyonu: redirect stub'ları, eski URL uyumluluğu, sekme = query param
   deseni tutarlılığı; server/client bileşen sınırları (gereksiz client bileşen var mı,
   büyük props serileştirmesi var mı).
5. Hesabın yeri: JS'te süzme/aggregasyon yapılan yerler (örn. leaderboard'un ligi çekip
   client'ta süzmesi) DB'ye inmeli mi; tersine, DB'de per-request ağır hesap varsa mat'a
   alınmalı mı.
6. Vercel tarafı: SSR süreleri (sayfa başı), ISR/cache kullanılmıyorsa nerede işe yarardı,
   admin-only sayfaların gereksiz herkese SSR maliyeti var mı.

## BOYUT D: GÖRSEL / UX

1. Tasarım dili tutarlılığı: SideTabMenu + showcase deseni hangi yüzeylerde var, hangileri
   eski desende kaldı; aynı kavram (form harfleri G/B/M vs W/D/L, rozetler, chip'ler) kaç
   farklı görsel dille çizilmiş.
2. Tema: koyu/açık modda logo invert hack'leri (tsl-league-mark), kontrast sorunları
   (accent üstüne accent bilinen vaka), foto/logolarda referrer ve hotlink kırılganlığı.
3. i18n: kullanıcıya görünen hardcoded TR/EN metin taraması (grep ile); dil dışı kalmış
   yüzeyler; sayı/tarih formatlarının locale tutarlılığı.
4. Boş durumlar: veri yokken ne görünüyor (boş tablo mu, açıklayıcı not mu) yüzey yüzey;
   kopuk kimlik fallback sayfası (bio-shell) kullanıcıya yeterince açıklayıcı mı.
5. Bilgi mimarisi: header menü büyüdü (TSL/1.Lig/Cup/CL/EL/Con/BSL/EL/EC/Volleyball...);
   ölçeklenme önerisi (gruplama, spor bazlı menü). Mobil davranış örneklem kontrolü.
6. Erişilebilirlik hızlı taraması: kontrast, alt metinler, tıklama alanları; ekran
   görüntüleriyle örnekle.

## PERFORMANS ÖLÇÜM PROTOKOLÜ (öneriler ölçüme dayansın)

- DB: `pg_stat_statements` varsa top-20 sorgu (total_time, calls); yoksa kilit view'lara
  `explain analyze` (yalnız select). Mat refresh sürelerini loglardan topla.
- Sayfa: dev'de 5 temsilci sayfanın soğuk/sıcak render süresi (server log ya da basit
  zaman ölçümü) + sorgu sayısı tablosu.
- Boyut: DB nesne boyutları, satır sayıları; büyüme hızı (matches, match_player_stats_details).
- Her öneriye şunu ekle: beklenen kazanç (ms / istek sayısı / MB), emek (S/M/L),
  risk (hangi yüzeyi etkiler), önkoşul.

## BİLİNEN KONULAR (yeniden keşfetme; üzerine değerlendirme yap)

- getPlayerAssets tam taraması bir kez optimize edildi (playerIds filtresi); kalan tam
  taramalar ve leaderboard'un ~600 satır çekip JS'te süzmesi ikincil bekliyor.
- Mat refresh her ~10 dk maç günü CPU sıçratıyor (micro instance).
- Bets10 WS israfı kayıtlı, çözülmedi (gözlemde).
- team_results/team_recent_form kaynak-öncelikli dedup 2026-08-18'de eklendi; benzer
  çift-kaynak riski taşıyan BAŞKA view var mı diye bak.
- Kadro af-kimlik köprüsü 3 katmanlı çözüldü; kadrolarda hala ~143 verisiz/bayat kayıt var
  (çoğu ayrılmış oyuncu). Bunun kalıcı temizlik mekanizması yok, öneri bekliyor.
- tsl_ss advanced/detailed metrikleri Süper Lig kapsamlı; kupa eşdeğeri bilinçli yok.
- 1. Lig profilleri ayrı sayfada (tff1); tek-profil desenine alınması sahibin kararına bakıyor.
- FS-fallback-only kimlikli az sayıda eleme oyuncusu profilsiz (bilinçli).
- pm_*/bb_pm_* anon-write revoke SQL'i deploy sonrası bekliyor olabilir; durumunu doğrula.

## ÇIKTI FORMATI

Repo köküne `ARCHITECTURE_REVIEW.md` yaz (başka hiçbir dosyaya dokunma; commit etme,
sahip okuyup karar verecek). Yapı:

1. Yönetici özeti (10 madde geçmesin: en kritik bulgular + en kârlı 5 hızlandırma).
2. Ciddi mimari hatalar (varsa). Her biri: kanıt, etki, düzeltme önerisi, emek, risk.
   Yoksa "ciddi hata bulunamadı" de ve neden emin olduğunu yaz.
3. Hızlandırma önerileri tablosu: öneri, kanıt/ölçüm, beklenen kazanç, emek (S/M/L),
   risk, önerilen sıra. UYGULAMA YOK.
4. Doğru mimari önerileri, boyut başına (A/B/C/D): mevcut durum, hedef durum, geçiş yolu
   (fazlı), geriye uyumluluk notu.
5. Yol haritası önerisi: 1 hafta / 1 ay / 3 ay ufkuyla sıralanmış iş listesi.
6. Açık sorular (sahibin karar vermesi gerekenler).

Rapordaki her iddiada kanıt göster: dosya yolu + satır, sorgu + sonucu, ya da ekran
görüntüsü. Ölçmediğin şeyi "tahmin" diye işaretle. Uzun dash (—) kullanma; sade Türkçe yaz.

## TUZAKLAR / GÜVENLİK

- DB bağlantısında autocommit AÇMA ve DDL/DML çalıştırma; explain analyze yalnız SELECT'te.
- Mat refresh, cron, pipeline script'i TETİKLEME (yük bindirir, yazar).
- Başka bir oturum aynı repoda çalışıyor olabilir; working tree'ye rapor dosyası dışında
  dosya bırakma, commit/push yapma.
- .env içeriklerini ve anahtarlarını rapora KOPYALAMA (yalnız var/yok de).
- Prod yerine dev'de gez; prod'a yalnız route sağlığı için istek at.
- Süper Lig canlı yüzeylerini etkileyecek hiçbir deneme yapma.
