# Mimari İnceleme Raporu (Uçtan Uca, Salt-Okunur)

Tarih: 2026-08-19. Yöntem: 10 paralel salt-okunur denetçi (veri katmanı, pipeline, servis, UX) + en kritik 8 bulgu için bağımsız düşmanca doğrulama. Ölçümler canlı DB (Supabase, PostgreSQL 17.6, micro instance), lokal dev server (localhost:3000, auth bypass) ve VPS log dosyaları üzerinden alındı. Hiçbir şey değiştirilmedi: yalnız SELECT/EXPLAIN, VPS'te yalnız okuma komutları.

Ham kanıt dökümleri `scratchpad/evidence/` altında etiket başına dosyalarda tutuldu; bu rapor kanıtın özünü taşır.

---

## 0. Durum Panosu (2026-08-19 akşamı)

Rapor 2026-08-19 sabahı salt-okunur bir incelemeyle yazıldı; aynı gün maddelerin çoğu uygulandı. Bu pano tek bakışta durumu verir, ayrıntı her maddenin altındaki *DURUM* notundadır. Aşağıdaki asıl metin (bölüm 1-4) **inceleme anındaki** tabloyu korur; kapanan bulguların "canlı" ifadeleri artık tarihseldir.

| Alan | Kapandı | Yarım | Açık |
|---|---|---|---|
| Ciddi hatalar (2.x) | **2.1 (tam)**, 2.3, 2.4 yama, 2.5 görünür, 2.6 alarm, 2.7 | 2.8 (anon riski gitti, dedup yok) | — |
| Hızlandırma (H) | H1, H2, H3, H4, H6, H7, H10, H12 | H8 (cache var, `.in()` yok) | H5, H9, H11 |
| Veri katmanı (A) | **A-4 (tam)**, A-5, A-1 Faz 1-2 | A-2 (şema+alarm var, is_curated yok) | A-3, A-1 tek modül |
| Pipeline (B) | B-1, B-3, B-4 | — | B-2 |
| Servis (C) | C-1 Faz 1, C-3 cache ayağı | C-4 (route silme sürüyor) | C-2, C-1 Faz 2-3, C-3 ids, C-4 cache |
| UX (D) | D-1, D-2 renk ayağı | — | D-2 tarih/sayı, D-3 header |

Sahip kararıyla iptal edilenler ve kalan işlerin sıralı listesi bölüm 5'te.

---

## 1. Yönetici Özeti

1. **Ciddi mimari hata VAR, iki tanesi canlı ve yüksek öncelikli.** En kritik ikisi: (a) anonim rolün Süper Lig model yazma RPC'lerini çalıştırabilmesi (güvenlik açığı), (b) maç günü mat refresh fırtınası (tek 10 dakikalık döngüde aynı mat listesi 45 kez tazeleniyor).

2. **Güvenlik: Anon rol MSM yazma RPC'lerini çağırabiliyor.** `public.msm_*` SECURITY DEFINER fonksiyonları anon'a EXECUTE grant'li; kimliksiz biri publishable anahtarla Süper Lig model/market konfigürasyonunu değiştirip manuel maçları silebilir. `pm_*` için aynı sınıf hata düzeltilmiş, MSM paraleli atlanmış. Doğrulandı.

3. **Performans: DB statement süresinin %79'u mat refresh'e gidiyor.** Üç ayrı katman (loader, map builder, shell adım 3b) aynı mat listesini bağımsız tazeliyor; bitmiş maç 60 saate kadar değişiklik kontrolsüz yeniden işleniyor. Ölçülen "maç günü CPU sıçraması" şikayetinin kökü bu. Doğrulandı.

4. **Canlı sessiz bozulma: 1. Lig foto sync 4+ gündür çöküyor.** `sync_player_photos_tff1.py` 2026-08-14'ten beri her turda NotNullViolation atıyor, wrapper yine de "OK" basıyor. Görünürlük katmanı olmadığı için fark edilmemiş.

5. **Canlı yanlış veri: TSL/1.Lig Teams sekmesi L5/L10 ortalamaları yanlış.** `loadResmiTeamsTable` sayfalamasız çekiyor; 2025/2026 için 6.136 satırın yalnız ilk 1.000'i geliyor, kalan sezon ortalamaları eksik veriden hesaplanıyor. Aynı fonksiyonun kupa dalı doğru sayfalıyor.

6. **En kârlı 5 hızlandırma (ölçümlü):** (1) döngü içi mükerrer refresh'i teke indir (~134 sn/döngü DB CPU), (2) değişiklik yoksa refresh atla (maç akşamı yükü ~%80 düşer), (3) `ucl/uel/uecl` sezon-agregat view'larını mat'a al (4.35 sn -> <100 ms), (4) TSL Players 19k satır pivotunu mat'a al (sıcak 1.7s -> ~0.5s), (5) `bb_player_metric_window_v1`'i mat'a al (~600 ms -> ~20 ms).

7. **Tek doğruluk kaynağı ihlalleri yaygın.** Kart kuralı (sarı + 2×kırmızı) 11 bağımsız yerde kodlanmış; takım adı 7+ yerde; sezon etiketi DB'de 6 view + pipeline'da 5+ literal; form harfleri (G/B/M vs W/D/L) 5+ görsel dilde. Kural değişince sessiz sapma riski.

8. **DB sağlığı iyi, büyüme izlenmeli.** 770 MB, şişme yok, indeks kapsaması iyi. `match_player_stats_details` tek başına DB'nin %43'ü (335 MB); içindeki `raw_stats` jsonb ~156 MB. Büyüme ~200 MB/yıl (tahmin); micro instance için 6-12 ay ufkunda izleme gerekir.

9. **Ölü/latent yük:** 55 view'lik yetim model-eğitim katmanı (hiç tüketicisi yok, en derin zincirler burada), 3 legacy şema (`map`/`etl`/`mapping`, fiilen ölü), kök dizinde auth dışı 2 legacy sayfa (`/matches`, `/basketball`), 2.2 GB temizlenmeyen Bets10 dump çöplüğü.

10. **Alt yapısal boşluk: hata görünürlüğü yok.** VPS'te bildirim kanalı sıfır; `mapping_health` FAIL (rc=1) dahil tüm sinyaller log dosyasında kalıyor. En ucuz yüksek etkili iş: küçük bir notify helper + wrapper'larda exit-kodu kontrolü.

---

## 2. Ciddi Mimari Hatalar

Aşağıdakiler bağımsız doğrulamadan geçti (7 onaylandı, 1 çürütüldü). Önem sırasıyla.

### 2.1 [GÜVENLİK, CANLI] Anon rol MSM model yazma RPC'lerini çalıştırabiliyor

**Kanıt:** `pg_proc` + `has_function_privilege`: `msm_update_model_config`, `msm_update_market_config`, `msm_upsert_fixture_inputs`, `msm_add_manual_fixture`, `msm_delete_manual_fixture`, `msm_set_manual_fixture_proxy`, `msm_log_import` fonksiyonlarının hepsi `prosecdef=True`, `owner=postgres`, anon EXECUTE=True; gövdelerinde `auth.uid/role/jwt` kontrolü yok. Gövdeler koşulsuz DELETE/UPDATE/INSERT içeriyor (`analytics.msm_manual_fixtures`, `msm.model_config`, `msm.fixture_inputs`). Grant kaynakları: [2026-08-06_msm_fixture_input.sql:65](oddskeeper-web/sql/2026-08-06_msm_fixture_input.sql), [2026-08-06_msm_config_extend.sql:65](oddskeeper-web/sql/2026-08-06_msm_config_extend.sql), [2026-08-08_msm_manual_fixtures.sql:45](oddskeeper-web/sql/2026-08-08_msm_manual_fixtures.sql). Frontend `createBrowserClient(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).rpc(...)` ile çağırıyor ([queries.ts:229,285,299,311,550](oddskeeper-web/frontend/features/tsl/resmi/matchStatsModel/queries.ts)); bu anahtar JS paketinde herkese açık, oturumsuz istek anon rolüne düşer.

**Etki:** Site davet-only ve giriş-kapılı olmasına rağmen, publishable anahtarla PostgREST `/rpc` endpoint'ine giden kimliksiz biri Süper Lig (bayrak gemisi model) konfigürasyonunu ve fixture girdilerini değiştirebilir, manuel maçları silebilir. UI kapısı (nav-permission, günlük logout) yalnız uygulama katmanında; PostgREST doğrudan çağrılınca atlanır. `pm_*/bb_pm_*` için bu sınıf zaten hata sayılıp service-role route'a taşınmış; MSM paraleli kesilmemiş.

**Düzeltme:** Faz 1 (S) `msm_*` RPC EXECUTE'unu anon'dan revoke, authenticated'a bırak + `notify pgrst reload`. Frontend zaten giriş yapmış kullanıcıyla çağırdığı için kırılmaz. Faz 2 (M) MSM yazmalarını `/api/msm/write` route'una taşı (pm_* gibi). **Emek:** S (Faz 1). **Risk:** Düşük; Faz 1 yalnız anon dış erişimi kapatır.

**DURUM: KAPANDI (2026-08-19).** Faz 1 (38a28ba) anon EXECUTE'u geri aldı; aynı gün anon SELECT lockdown'u (027d2f6) tüm anon yetkilerini kaldırdı ve CI anon-guard kuruldu. Faz 2 (7d95e5c) yazmaları tek kapıya aldı: `app/api/msm/write` (service-role, önce getNavAccess ile oturum doğrulanır), queries.ts'teki 7 RPC çağrısı tek `msmWrite()` yardımcısına indi. RPC gövdeleri DEĞİŞMEDİ (iş kuralları SQL'de kaldı, davranış riski sıfır); `sql/2026-08-19_msm_rpc_service_role_only.sql` authenticated EXECUTE'u da kaldırdı, artık yalnız service_role çağırabiliyor.

### 2.2 [PERFORMANS, CANLI] Mat refresh orkestrasyonu ölçeklenmeyi kırıyor

**Kanıt:** Aynı 10 dk döngüsünde üç katman refresh çağırıyor: [load_sofascore_1lig_player_stats.py:203](oddskeeper-web/pipeline/src/football/load_sofascore_1lig_player_stats.py) (17 refresh) + [build_sofascore_opta_player_map.py:220](oddskeeper-web/pipeline/src/football/build_sofascore_opta_player_map.py) (`refresh_tsl_mats` = 14) + `run_match_scrape.sh:75` (aynı 14 tekrar) = 45 refresh/döngü. VPS `match_scrape.log` 2026-08-18: tek döngü 21:30:01 START -> 21:37:36 OK = 7,5 dk (maçsız döngü ~20 sn); event 16707704 (FB-Lyon) skoru değişmeden ~21 döngüde yeniden işlendi (değişiklik kontrolü yok, gate yalnız `total_m>0`). `pg_stat_statements`: mat refresh 47.010 sn / 8.470 çağrı = tüm PostgREST okumalarının (7.452 sn) 6 katı, statement süresinin **%79'u**. `player_metric_leaderboard_current` sorgusu kilitsiz 4,3 ms, ama pg_stat ortalaması 1.161 ms / max 4.701 ms (plain REFRESH'in AccessExclusiveLock beklemesi + refresh dönemi yükü).

**Doğrulama düzeltmesi:** Grace penceresi 10 dk döngüde 2.5-6 saat; 60 saatlik geniş pencere ayrı 3 saatlik cron'da. Lig sayısı artınca refresh'ler üst üste binmez (flock var), ama döngü 10 dk'yı aşınca sonraki tur atlanır (veri tazeliği gecikir). Leaderboard yavaşlamasının tamamı kilit değil; refresh dönemi CPU/IO baskısı da katkı veriyor. Yön aynı: kök neden refresh fırtınası.

**Etki:** Maç günü her 10 dk CPU sıçraması (bilinen şikayet); sayfalar saniyelerce takılıyor; micro instance kapasitesinin ~%79'u aynı verinin tekrar tekrar materialize edilmesine gidiyor.

**Düzeltme:** Faz 1 (S) döngü içi mükerrerliği kaldır (map builder'daki `refresh_tsl_mats` çağrısını sil, loader'ın tsl_ss setini match_scrape altında atla) → ~134 sn/döngü. Faz 2 (M) değişiklik yoksa refresh atla (maç payload hash'i) → maç akşamı yükü ~%80 düşer. Faz 3 (M) okuyucu-kritik mat'ları CONCURRENTLY'ye geçir. **Emek:** Faz 1 S. **Risk:** Faz 1 düşük (aynı veri zaten tazeleniyor, refresh sırası korunmalı).
**DURUM (2026-08-19 akşam):** Faz 1 (H1, DEFER bayrağı) sabah, Faz 2 akşam CANLIYA ALINDI (commit 48a9733): loader iç refresh'i `changed_m`'e, wrapper 3b sofa tetiği `sofa_degisti`'ye, 3d kupa tetiği yeni `CUP_CHANGED_M` satırına bağlandı; FlashScore yolları bilinçli dokunulmadı (hash FS'i kapsamaz), tüm kapılar fail-open (CHANGED satırı yoksa eski davranış). VPS wrapper kopyası senkron (.bak-h2faz2 yedeği), sessiz tur smoke testi temiz. Hash altyapısı 62 tur hatasız ama gerçek maç henüz görmedi; ilk sınav 19 Ağu gecesi CL playoff maç-sonrası turları. Faz 3 (CONCURRENTLY) SLA kararıyla ertelendi, muhtemelen gereksiz.

### 2.3 [CANLI SESSİZ BOZULMA] 1. Lig foto sync 4+ gündür çöküyor

**Kanıt:** `match_scrape.log`'da 99 Traceback (ilk 2026-08-14 21:02, son 2026-08-18 00:22 UTC): `psycopg2.errors.NotNullViolation: null value in column sofascore_player_id`. [sync_player_photos_tff1.py:24](oddskeeper-web/pipeline/src/football/sync_player_photos_tff1.py) tek `INSERT..SELECT`, `ref.flashscore_player_map`'te `sofascore_player_id` NULL satırlar tüm statement'ı iptal ediyor. VPS `run_match_scrape.sh` adım 3 exit kodunu kontrol etmiyor, traceback'in hemen ardından "FS-MAP + PHOTO + MAT OK" basıyor.

**Etki:** Yeni 26/27 1. Lig oyuncuları fotosuz kalıyor. Asıl mesele desen: exit-kodu okunmayan adım + tek büyük statement, başka adımda veri kaybına da yol açabilir.

**Düzeltme:** Sorguya `AND fmap.sofascore_player_id IS NOT NULL` + wrapper'da rc kontrolü. **Emek:** S. **Risk:** Yok denecek kadar az. (Not: Bu bulgu güçlü kanıtlı ama bağımsız doğrulama bütçesi bitince onaylanmadan raporlanmış; kanıt zinciri kendi başına yeterli.)

**DURUM: KAPANDI (2026-08-19, commit a4328c6).** NULL filtresi + wrapper rc kontrolü eklendi (adım 3'te artık `PHOTO SYNC FAILED` banner'ı var). Asıl desen sorunu da kapandı: B-1 ile exit kodları ntfy'a düşüyor.

### 2.4 [CANLI YANLIŞ VERİ] TSL/1.Lig Teams sekmesi 1000-cap yüzünden yanlış ortalama

**Kanıt:** [resmiLoaders.ts:596](oddskeeper-web/frontend/features/tsl/server/resmiLoaders.ts) `msm_team_match_log_v1`'i `.limit/.range` olmadan çekiyor. DB: `league='tsl'` 10-market satır sayısı 2025/2026 = 6.136 (PostgREST `db-max-rows=1000`'de kesiliyor). `ORDER BY team_match_index LIMIT 1000` kesiti yalnız erken haftaları taşıyor. Aynı dosyanın eurocup dalı (540-554) sayfalama YAZMIŞ ("db-max-rows=1000 -> SAYFALA" yorumuyla), msm dalına uygulanmamış. Ölçüm: sayfa 200 dönüyor, hata sinyali yok.

**Etki:** Teams tablosunda L5/L10/Season kolonları geçmiş sezonda şimdiden, güncel 2026/2027'de birkaç hafta içinde eksik-veri ortalamasına dönüşür. Bahis modeli desteği olan bir sitede sessiz yanlış istatistik.

**Kalıcı boyut:** Bu regresyon sınıf olarak geri geliyor: 909ef1a (2026-08-08) "PostgREST 1000-cap savunması" taramasından 8 gün sonra fa74978 (2026-08-16) Teams tablosuyla aynı hatayı yeniden getirdi. 260 sorgunun 136'sı hâlâ limitsiz. Tek seferlik tarama yetmiyor.

**Düzeltme:** Hemen (S) `fetchAllPaged` uygula (eurocup dalındaki hazır desen). Kalıcı (M) limitsiz `.select`'i yasaklayan lint/CI kuralı. **Emek:** S (yama). **Risk:** Yok. (Not: Bu da doğrulama bütçesi dışında kaldı; kanıt zinciri yeterli.)

**DURUM: Yama KAPANDI, kalıcı kural AÇIK.** [resmiLoaders.ts:598](oddskeeper-web/frontend/features/tsl/server/resmiLoaders.ts) artık `msm_team_match_log_v1`'i sayfalıyor (yorumda db-max-rows notu var). Kalıcı ayak (C-2 lint/CI) yapılmadı: bugün hâlâ 274 `.select(` var, `fetchAllPaged` yalnız 6 dosyada; regresyon sınıfı açık.

### 2.5 [KADRO YÜZEYİ, CANLI] Çift af id mükerrer oyuncu satırı üretiyor

**Kanıt (doğrulandı, canlı render):** `analytics.team_current_squad_profile_v1 WHERE af_player_id IN ('585709','tm1070983')` = 2 satır, ikisi de `player_slug=c-guner--bgcx6apv8i5olhyo2astbias4`, `team_slug=galatasaray`. `football.team_squad_current`'ta iki satır: `apifootball 585709 'C. Guner'` + `synthetic-tm tm1070983 'Armando Güner'`, ikisi de forma no 27. Dev server render: kadro listesinde İKİ ayrı oyuncu kartı (biri api-sports fotolu, biri SofaScore fotolu), ikisi de aynı profile gidiyor. [SquadPanel.tsx:240](oddskeeper-web/frontend/features/team-detail/panels/SquadPanel.tsx) satırları `player_source_id` ile key'liyor, slug dedup yok. Kök neden: oyuncunun gerçek adı Can Armando Güner; af "C." (Can) kısaltıyor, TM "Armando Güner" yazıyor; [apply_synthetic_squad.py](oddskeeper-web/pipeline/src/football/apply_synthetic_squad.py) `find_natural` baş-harf eşleştirmesi tutturamayıp sentetiği emekli edemiyor. Mükerreri kuran mapping satırı [2026-08-16_player_mapping_bridge_backfill.sql](oddskeeper-web/sql/2026-08-16_player_mapping_bridge_backfill.sql) (`match_method='bridge:af-sofa-opta'`).

**Etki:** Süper Lig takım profili Squad sekmesinde aynı oyuncu çift görünüyor (parçalanma kırmızı bayrağı). Bugün 1 görünür vaka, ama yapısal (TM'in ön-ad düşürmesi + af kısaltması kombinasyonu her transfer penceresinde tekrarlayabilir).

**Düzeltme:** `apply_synthetic_squad`'a opta-bazlı ikinci emeklilik kontrolü (aynı opta'ya çözülen iki aktif kadro satırından sentetik olanı emekli et) VEYA view'da opta-bazlı dedup. **Emek:** S-M. **Risk:** Düşük.

**DURUM: Görünür arıza KAPANDI (commit cee7d26), pipeline kökü AÇIK (opsiyonel).** View dedup + frontend dedup canlıda; Güner çift satırı gitti. Kök neden (sentetik emeklilik baş-harf eşleştirmesi) duruyor ama view dedup gelecek vakaları da maskeleyeceği için sahip kararıyla düşük öncelikli.

### 2.6 [LATENT SESSİZ KOPUKLUK] ss→gerçek-opta terfi drifti için mekanik koruma yok

**Kanıt (doğrulandı):** [build_sofascore_opta_player_map.py:207](oddskeeper-web/pipeline/src/football/build_sofascore_opta_player_map.py) günlük truncate+rebuild; oyuncu Opta verisi kazanınca `ssX` sentetik id gerçek opta'ya döner. Ama `ref.player_mapping` do-nothing ([remap_players_additive.py:155](oddskeeper-web/pipeline/src/football/remap_players_additive.py), bridge:135); repoda `pm.opta_player_id` güncelleyen tek satır yok. [2026-08-18_squad_profile_af_sofa_fallback.sql:48](oddskeeper-web/sql/2026-08-18_squad_profile_af_sofa_fallback.sql) `COALESCE(pm.opta, som.opta)` bayat pm'i seçer. DB bugün: pm_total=527, ss'li pm=170 (risk havuzu), drift_promoted=0. `mapping_health_check.py` bu drifti kontrol etmiyor.

**Etki:** Bugün 0 vaka, ama oyuncu Opta verisi kazandığı an kadro linki gerçek profile ulaşmaz, pm satırı kendini onarmaz, kimse alarm almaz. PSM slug-drift arızasının birebir benzeri.

**Düzeltme:** `mapping_health_check`'e ss-drift sayacı + üretimli pm satırlarını rebuild kapsamına al (manuel satırları `is_curated` ile koru). **Emek:** M. **Risk:** Düşük.
**DURUM (2026-08-19 akşam):** Sayaç UYGULANDI: `player_mapping_ss_promoted_drift` (HIGH) mapping_health'te canlı, bugün 0/OK; >0 olursa ntfy alarmı düşer. Rebuild/is_curated ayağı A-2 kapsamında bekliyor (alarm ilk çaldığında pm satırı elle gerçek opta kimliğine taşınır).

### 2.7 [SEZON DEVRİ] 5 view sabit sezon literali taşıyor, biri şu an bayat

**Kanıt (doğrulandı):** `pg_views`: `psm_id_bridge_v1`, `psm_player_season_avg_bridge_v1`, `psm_player_appearances_bridge_v1`, `msm_fixtures_tff1_v1` → `WHERE season_label='2026/2027'`; `tff1_squad_v1` → `'2025/2026'`. Bayatlama ŞU AN gözlemleniyor: `tff1_pm_player_season_v1`'de 26/27 için 835 oyuncu var ama `tff1_squad_v1` istatistikleri hâlâ 25/26'dan geliyor (24/25=1413, 25/26=1430, 26/27=835).

**Doğrulama düzeltmesi:** PSM köprüleri için frontend'de ayrıca `PSM_BRIDGED_SEASONS = Set(["2026/2027"])` kapısı var; sezon devrinde düzeltme tek yerde değil çift tarafta (view + frontend) gerekir. `tff1_squad_v1`'in 25/26 filtresi bilinçli tasarım ("güncel kadro + geçen sezon istatistiği"), ama sezon ilerledikçe geçiş yapacak mekanizma yok. Ton: "gizli tuzak" değil, "dokümante ama alarmsız, unutmaya açık manuel sezon-devri yükü".

**Etki:** Unutulan devirde PSM köprü kolonları ve TFF1 fikstür listesi boş/bayat kalır; sezon ilerledikçe TFF1 kadro istatistikleri bayatlar.

**Düzeltme:** `ref.seasons(competition, season_label, is_current)` tablosu veya `ref.current_season(competition)` fonksiyonu; literal taşıyan view'lar buna bağlanır. **Emek:** S. **Risk:** Düşük (view kolon sözleşmeleri değişmez).

**DURUM: KAPANDI (2026-08-19, commit 753c0f7 + 0dbca88).** Çözüm elle güncelleme değil TAKVİM: `ref.current_season_label(date)` (24 Haziran sınırı, DB ölçümüyle) + frontend eşi `lib/season.ts`. PSM köprüleri "güncel sezon" yerine "Opta-sonrası çağ" (>= 2026/2027) servis ediyor, `tff1_squad_v1` fonksiyona bağlandı (yan kazanç: 204 bayat roster üyeliği düştü). Sezon devrinde artık elle iş yok. Kalan küçükler bilinçli/legacy: PlayerStatsExplorer SEASON_OPTIONS, TSL_DEFAULT_SEASON, PSM fallback literalleri.

### 2.8 [ANON'A AÇIK MÜKERRER] league_results_v1 ve league_overview_v1 dedup'suz

**Kanıt (doğrulandı):** `pg_get_viewdef`: `league_results_v1` `football.matches`'ten kaynak filtresi/dedup olmadan okuyor. Süper Lig 25/26 = 918 satır (opta 306 + sofascore 306 + flashscore 306). Frontend kullanmıyor (grep 0), AMA `role_table_grants`: hem bu view hem bağımlısı `league_overview_v1` anon+authenticated SELECT grant'li; `league_overview_v1` dedupsuz aggregate ile 25/26 için `completed_matches=918` ve `total_goals`'u 3x şişik döndürüyor. Paralel risk: `team_match_metrics_base_v1` (`match_team_stats` 4 kaynaklı, dedup yok); bugün 1 maç çift sayılıyor (SL 25/26 opta+sofascore çakışması), kaynak kapsamaları çakıştıkça büyür.

**Etki:** Bugün doğrudan kullanıcı etkisi yok, ama anon'a açık yanlış-değer üreten yüzey; herhangi bir gelecek loader buna bağlanırsa anında 3x mükerrer.

**Düzeltme:** `team_results_v1`'e 2026-08-18'de eklenen kaynak-öncelik dedup desenini bu view'lara da uygula VEYA anon grant'tan çıkar. **Emek:** S-M. **Risk:** Düşük.

**DURUM: Anon ayağı KAPANDI, dedup AÇIK.** Anon lockdown (027d2f6) bu view'ları da anon'dan aldı, yani "anon'a açık yanlış değer" riski gitti. Ama view'ın kendisi hâlâ dedupsuz: bugün ölçüldü, `league_results_v1` Süper Lig 25/26 = 918 satır (306 maç × 3 kaynak). Tüketicisi olmadığı için düşük öncelikli; ya dedup ya drop.

### Ciddi hata SAYILMAYAN, doğrulamada çürütülen aday

**team_fixtures_v1 çift-kaynak guard'ı (GEÇERSİZ):** Guard'ın yalnız `'Süper Lig'` literaline bağlı olması doğru, ama bugün başka lige apifootball fikstür yazan mekanizma yok (tüm fixture loader'ları sofascore kaynaklı), `team_slug+opponent+tarih` count>1 sorgusu 0 satır, 18 takımın slug'ı team_mapping'te kanonik. Bu **mevcut hata değil, latent tasarım sınırı**: ileride bir lige ikinci kaynaklı fikstür loader'ı eklenirse çift satır üretir. Düşük öncelikli iyileştirme olarak raporlanır (guard'ı competition-agnostik kaynak-öncelik kuralına genelleştir).

### team_statistics_split_v1 (doğrulandı, ama etki DAR)

`analytics.team_statistics_split_v1` kaynak/competition dedup'suz (GS 25/26 = 9 satır, kupa satırları lig satırlarına karışıyor), [getTeamStatisticsSplit.ts:60](oddskeeper-web/frontend/features/team-detail/server/getTeamStatisticsSplit.ts) `_competition` parametresini kullanmıyor. **AMA** 2026-08-10'dan beri varsayılan Team Statistics görünümü showcase paneli bu tabloyu hiç göstermiyor; yalnız elle `?design=classic` ile erişilen legacy görünümde render ediliyor (o görünüme takım sayfasından UI linki yok). Yani canlı varsayılan yüzeyde görünen bir hata değil; opta 26/27 verisi gelince veya classic yeniden bağlanınca geri dönecek gerçek mimari borç. Düzeltme: view'a kaynak-öncelik dedup + loader'a competition filtresi (S).

---

## 3. Hızlandırma Önerileri (ölçüm/tahmin ayrımıyla)

Durum kolonu 2026-08-19 akşamı eklendi (o günkü uygulamalardan sonra).

| # | Öneri | Kanıt / Ölçüm | Beklenen kazanç | Emek | Risk | **Durum** |
|---|---|---|---|---|---|---|
| H1 | Döngü içi mükerrer refresh'i teke indir | 45 refresh/döngü; `tsl_ss_..._global_mat` (ort 36 sn) 3 kez | ~134 sn/döngü DB CPU (ölçülen ort. ile) | S | Düşük | **KAPANDI** (df75fb6, DEFER_TSL_MATS) |
| H2 | Değişiklik yoksa refresh atla (payload hash) | event 16707704 ~21 döngü yeniden işlendi; refresh %79 pay | maç akşamı refresh yükü ~%80 (tahmin) | M | Orta | **KAPANDI** (48a9733; ilk maç teyidi 21 Ağu) |
| H3 | `ucl/uel/uecl_player_season_stats_v1` → mat | EXPLAIN 4.35 sn (external merge 11.6 MB, work_mem 8 MB) | sorgu 4.35 sn -> <100 ms (tahmin) | S | Düşük | **KAPANDI** (30c16ed) |
| H4 | TSL Players pivot mat (oyuncu başına 1 satır) | 1 count + 20 range = 19.348 satır; sıcak 1.7s | sıcak ~0.5s, 25→5 istek, ~2.5MB→150KB (tahmin) | M | Orta | **KAPANDI** (`tsl_ss_player_table_mat` canlı) |
| H5 | `bb_player_metric_window_v1` → mat (el_ deseni) | EXPLAIN 1.058 ms, 96.592 satır WindowAgg + 12.7 MB disk | ~600 ms -> ~20 ms; 1.315 çağrı | S | Düşük | AÇIK (hâlâ view) |
| H6 | Teams sekmesi `fetchAllPaged` (doğruluk + hız) | 6.136 satır > 1000 cap | yanlış L5/L10 düzelir; +5 istek | S | Yok | **KAPANDI** |
| H7 | `getNavAccess` + `getPlayerProfile` react cache() | layout+sayfa 2x auth.getUser + 2x izin sorgusu | sayfa başına 1-3 istek + ~200-600ms RTT | S | Çok düşük | **KAPANDI** |
| H8 | `playerInfoMap` cache() + `.in()` (CL/1.Lig/kupa) | aynı render'da 2x tam tarama (10.977 satır x 2) | CL players 36→~7 istek, 4.1s→~1.5s (tahmin) | S-M | Düşük | YARIM: cache() kapandı, `.in()` daraltması AÇIK |
| H9 | Leaderboard'ları DB'de order+limit / SQL GROUP BY | 600 satır→10; 1.382 satır→18 (aggression) | cap bug'ı da çözülür; satır hacmi çöker | S | Düşük | AÇIK |
| H10 | idx_scan=0 non-unique indeksleri düşür (9 adet) | pg_stat_user_indexes, 3+ ay, ~2.2 MB | ~2.2 MB + yazma bakımı azalır | S | Düşük | **KAPANDI** (418837d, 11 indeks/~2.1 MB) |
| H11 | Kullanıcı-bağımsız loader'lara kısa-TTL cache | grep: revalidate/unstable_cache hiç yok | eşzamanlı trafikte Supabase istek hacmi büyük düşer (tahmin) | M | Bayatlık | AÇIK (bugün de 0 kullanım) |
| H12 | Bets10 WS kaydını kapat + dump temizliği | 30MB dump = 4205 WS vs 251 XHR; data/odds 2.2 GB | 2.2 GB disk geri + ~80-120 MB/gün büyüme durur (ölçülen) | S | Düşük | **KAPANDI** (94ed3f4) |

Not: "Ölçülen" işaretsiz kazançlar tahmindir; dev server ilk derlemede yavaş olduğu için soğuk/sıcak ayrımı `evidence/C1-sayfa-olcum.txt`'te ayrı tutuldu.

**H10 DURUM (2026-08-19 akşam): UYGULANDI.** Güncel pg_stat taramasıyla liste yeniden türetildi: uygulama şemalarında idx_scan=0 non-unique 11 indeks düşürüldü (~2.1 MB; en büyüğü player_leaderboard_rows metric_rank 1.3 MB + metric_team 464 KB). idx_team_leaderboard_rows_metric_team kullanımda olduğu için korundu; auth/storage/realtime sistem şemalarındaki taranmamış indekslere bilerek dokunulmadı. Migration: sql/2026-08-19_drop_unused_indexes.sql (+ birebir ROLLBACK dosyası). Sorgular PK/diğer indekslerle karşılanıyor, drop sonrası temsilci sorgular sağlıklı.

---

## 4. Doğru Mimari Önerileri (Boyut Başına)

### Boyut A: Veri Katmanı / Tablolama

**A-1. Tek refresh orkestratörü.** *Mevcut:* refresh mantığı 4 yerde kopyalı (sofa loader 17, FS loader 5, wrapper inline 2, refresh_tsl_mats 14); aynı mat aynı turda 2-3 kez tazeleniyor; sıra bilgisi iki dosyada kopya. *Hedef:* mat→bağımlılık sırası→tetikleyen kaynak eşlemesini tek modülde tutan, döngü başına her mat'ı en çok 1 kez tazeleyen, "kirli" bayrağına bakan, global flock'lu tek script; loader'lar refresh çağırmaz. *Geçiş:* Faz 1 mükerrerliği kaldır, Faz 2 loader'lar "değişen tablo" işareti bırakır, Faz 3 CONCURRENTLY. Mat adları/tanımları değişmez, frontend etkilenmez. *Etki:* DB yükünün %79'unu oluşturan refresh'in %70-85 azalması. *Emek:* Faz 1 S, toplam M.

*DURUM: Faz 1-2 KAPANDI (H1 + H2), tek-modül hedefi AÇIK.* Mükerrerlik gitti (45 -> 1 refresh/tur) ve refresh artık değişiklik-bazlı; ama refresh mantığı hâlâ 3 dosyaya dağılmış (loader, builder, wrapper), "kirli bayrağı" okuyan tek orkestratör modülü yazılmadı. Faz 3 (CONCURRENTLY) SLA kararıyla ertelendi.

**A-2. Eşleme katmanını tek desene topla.** *Mevcut:* üç yazma deseni karışık (truncate+rebuild, additive-update, additive-do-nothing); `player_mapping`/`team_mapping` do-nothing olduğu için bir kez yanlış yazılan satır sonsuza kalır; `map`/`etl`/`mapping` legacy şemaları fiilen ölü ama duruyor. *Hedef:* iki sınıf: (a) kaynaktan türetilebilen her harita deterministik truncate+rebuild, tek cron zincirinde; (b) insan-kuratif tablolar `is_curated` ile korunur. *Geçiş:* `player_mapping`'e `is_curated` bayrağı + üretimli satırları rebuild (dry-run kıyasıyla), `mapping_health_check`'e drift kontrolleri, `apply_synthetic_squad`'a opta-bazlı emeklilik. Legacy şemalar 1 ay pg_stat gözlemi sonrası drop. *Etki:* sessiz kopukluk sınıflarının kalıcı kapanması. *Emek:* M.

*DURUM: YARIM.* Kapanan: legacy `map`/`etl`/`mapping` şemaları DB'den tamamen silindi (bugün doğrulandı, PostgREST sağlıklı) ve drift kontrolleri mapping_health'e girdi (2.6 ss-drift + PSM kimlik kanaryaları). Açık: `player_mapping`'e `is_curated` bayrağı yok (bugün doğrulandı), üretimli satırlar hâlâ do-nothing yazılıyor, `apply_synthetic_squad` opta-bazlı emeklilik eklenmedi.

**A-3. Ortak mantığı base view/fonksiyona al.** *Mevcut:* takım-perspektif mantığı dağınık (34 view `is_home`, ~15 view W/D/L, 25 view home/away UNION, kaynak-öncelik dedup yalnız 4 view'da); kart kuralı 11 yerde; sezon etiketi 6 view + 5 literal. *Hedef:* tek kanonik "takım-maç" base view/mat (kaynak-öncelik dedup + W/D/L + is_home + sezon tek yerde, `team_results_v1`'in 2026-08-18 deseni çekirdek); `football.card_total(yellow,red)` SQL fonksiyonu + frontend `cardTotal()`; `ref.seasons` tablosu. *Geçiş:* her biri bağımsız küçük PR, `CREATE OR REPLACE` ile kolon sözleşmesi korunur. *Etki:* çift-kaynak ve kural-sapması sınıfları kökten kapanır, sezon devri tek-dosya işine iner. *Emek:* kart S, sezon S, base view M.

*DURUM: Sezon ayağı KAPANDI (2.7), kalanı AÇIK.* `ref.current_season_label()` kuruldu. Ama `football.card_total()` SQL fonksiyonu yok, frontend `cardTotal` yalnız tek dosyada yerel helper, kanonik takım-maç base view yazılmadı.

**A-4. raw_stats sıcak/soğuk ayrımı.** *Mevcut:* `mpsd` yekpare (4 kaynak + ham jsonb + tüm sezonlar), DB'nin %43'ü, `raw_stats` ~156 MB. *Hedef:* `raw_stats`'ı `mpsd_raw` yan tablosuna taşı (veya eski sezonlar arşiv/DB dışı); mat'lar sıcak kısımdan beslenir. *Geçiş:* önce tüketici envanteri, kopya-sonra-kes fazlı, `pg_repack`/pencere planı. *Etki:* ~150 MB küçültme + micro instance ömrü uzar. *Emek:* M (dikkatli fazlama).

*DURUM: TAMAMEN KAPANDI (2026-08-19 gecesi).* Faz 1 (93c6cb9) + Faz 2 (146717f, bb0e52e, 9d2316e). **Ölçülen: mpsd 340 MB -> 68 MB, DB 1042 MB -> 770 MB (272 MB geri); yan kazanç mat refresh %21-40 hızlandı** (tsl_ss global 39.2->31.0s, tff1 17.4->11.3s, shot_zones 25.6->15.4s). Yöntem: `football.mpsd_with_raw` compat view + 22 nesnenin ona bağlanması (18 view CREATE OR REPLACE, 4 matview + 10 bağımlısı tek transaction'da yeniden kurma), writer'lar `mpsd_raw.split` ile doğrudan yan tabloya, sonra trigger + kolon drop + VACUUM FULL (20.1s). Doğrulama: 32 nesnenin içerik md5'i birebir aynı, writer gerçek maç verisiyle sınandı, site smoke temiz. ESKİ NOT: `football.match_player_stats_raw` + senkron trigger + 279k backfill canlı ve doğrulandı. Faz 2 yapılmadı: bugün doğrulandı, `mpsd.raw_stats` kolonu hâlâ duruyor (22 view join geçişi + writer geçişi + kolon drop + VACUUM FULL bekliyor; ~150 MB kazanç henüz alınmadı).

**A-5. 55 yetim model-eğitim view'ini arşivle.** *Mevcut:* `fact_/dim_/model_/participation_/data_health + mapping.v_*` ailesi (derinlik 8-12 zincirlerin tamamı), frontend 0 kullanım, pipeline 0 referans. *Hedef:* tanımlar `sql/archive`'a, DB'den DROP CASCADE. *Etki:* katalog sadeliği, base tablo DDL özgürlüğü. *Emek:* S. *Geriye uyum:* kullanım sıfır, risk yok.

*DURUM: KAPANDI (93c6cb9).* 94 nesne `sql/archive/2026-08-19_dead_catalog`'a arşivlenip DB'den düşürüldü. Ders (exposed-schemas 503 tuzağı) raporun 6. bölümünde.

### Boyut B: Scraping / Pipeline

**B-1. Hata görünürlüğü katmanı (en yüksek öncelik).** *Mevcut:* bildirim kanalı sıfır; exit kodları ya üretilmiyor (fetch tüm lig hatalarını yutuyor) ya tüketilmiyor (`mapping_health` rc=1, foto sync rc); 4 günlük traceback "OK" banner'ının arkasında. *Hedef:* (1) küçük `notify.sh` (ntfy/Telegram tek curl), wrapper'lar rc!=0'da ve mapping_health FAIL'de çağırır; (2) günlük log-digest cronu (son 24 saatte `FAILED|Traceback|FAIL:` toplayıp tek push). *Etki:* YÜKSEK (sessiz arıza sınıfını kapatır). *Emek:* S-M.

*DURUM: KAPANDI (a4328c6).* ntfy seçildi: `notify.sh` + günlük log digest cron'u + odds_capture/mapping_health anlık kancaları canlı; wrapper'larda rc kontrolü var. Sessiz arıza en geç 24 saatte görünür.

**B-2. Ortak yardımcı kütüphanesi.** *Mevcut:* 13 isim-normalize varyantı (10x `norm` + `norm_name` + 2 fold), 5x `tokens`, 4x `team_key` (drop setleri DRIFT etmiş), psycopg2 kalıbı 59 dosyada, upsert helper 7 dosyada. *Hedef:* `pipeline/src/lib/` paketi: `textnorm.py` (tek doğru fold/norm/tokens/team_key), `db.py`, `http.py`. Kritik: `norm/team_key` tek implementasyona inince drift-kaynaklı yanlış eşleşme sınıfı kapanır. *Geçiş:* harita builder'ları önce dry-run kıyasıyla taşı. *Emek:* M.

*DURUM: AÇIK.* `pipeline/src/lib/` paketi kurulmadı; 13 isim-normalize varyantı ve drift etmiş `team_key` setleri duruyor.

**B-3. Wrapper drift'ini kapat.** *Mevcut:* `/opt/oddskeeper/run_match_scrape.sh` repo kopyasından farklı (kupa 2b/2c adımları yalnız VPS'te, 23 satır); DEPLOY.md cp konvansiyonu git pull ile güncellenmez. *Hedef:* cron doğrudan `repo/.../deploy/run_*.sh` çağırır; /opt kopyaları kalkar. *Geçiş:* önce VPS sürümünü repoya commit et, sonra cron yollarını çevir. *Etki:* sessiz-drift sınıfı kapanır. *Emek:* S. *Not:* Bu incelemede VPS→repo commit yapılmadı (salt-okunur); sahip onayı bekliyor.

*DURUM: KAPANDI (a4328c6).* VPS sürümü repoya alındı, `run_match_scrape.sh` repo ile /opt kopyası birebir tutuluyor (dosya başında kural notu var). NOT: kopya hâlâ elle senkronlanıyor (cron doğrudan repo'yu çağırmıyor), bu yüzden her wrapper edit'inden sonra `cp` şart; bugün H2 Faz 2'de uygulandı.

**B-4. Opta staging pagination (latent veri kaybı).** *Mevcut:* [load_staging_to_football_matches.py:197](oddskeeper-web/pipeline/src/football/load_staging_to_football_matches.py) ve incidents loader sayfalamasız GET; `raw.match_json_staging` 1000'i geçince (bugün 279) yeni maçlar sessizce yüklenmez. Details/opta_points/team_stats loader'larında offset döngüsü VAR. *Hedef:* mevcut sayfalı loader'daki offset döngüsünü kopyala. *Emek:* S. *Not:* Opta zinciri lokal Windows makinesinde koşuyor (VPS cron'unda yok); tek makineye bağımlılık + merkezi olmayan loglar ayrı bir konu.
**DURUM (2026-08-19 akşam):** UYGULANDI: matches + incidents loader'larına details loader'daki offset döngüsü kopyalandı (incidents'taki limit=10000 da yanılsamaydı, PostgREST 1000'e kırpıyordu). Test: PAGE_SIZE=100'e zorlanıp çok sayfalı fetch SQL count ile birebir doğrulandı (306/306). Zamanlanmış görev bu repo klonundan koştuğu için yarınki 07:00 koşusunda devrede.

### Boyut C: Gösterim / Servis Katmanı

**C-1. Sayfa-şekilli okuma katmanı.** *Mevcut:* uzun-format view'lar SSR'da 15-35k satır taşınıp JS'te pivot ediliyor (TSL Players 19.3k, CL players ~35k, 1.Lig takım ~15k); istek sayısı 20-36'ya çıkıyor, süreyi RTT domine ediyor. *Hedef:* her liste yüzeyi için oyuncu/takım başına 1 satırlık pivot view/mat; SSR loader 1-3 istek, <1000 satır. *Geçiş:* Faz 1 TSL Players, Faz 2 eurocup, Faz 3 tff1. Eski view'lar silinmez. *Etki:* en yavaş 4 sayfada sıcak süre ~%60-70 azalma (tahmin). *Emek:* M-L.

*DURUM: Faz 1 KAPANDI (H4), Faz 2-3 AÇIK.* TSL Players pivot mat'ı (`tsl_ss_player_table_mat`) canlı. Eurocup ve tff1 yüzeyleri hâlâ uzun-format view okuyup JS'te pivotluyor.

**C-2. PostgREST sözleşme katmanı (1000-cap + select("*")).** *Mevcut:* 260 sorgunun 136'sı limitsiz (regresyon aldı: 909ef1a→fa74978), 71'i `select("*") + TS cast` (kolon değişince sessiz undefined). *Hedef:* (a) limitsiz `.select` lint/CI ile yasak, (b) 1000+ potansiyelli her çekim `fetchAllPaged`, (c) satır tipleri view başına açık kolon listesiyle. *Geçiş:* Faz 1 lint + istisna listesi, Faz 2 sınıra yakın 4 sorgu (Teams log, aggression, all_rows 600, squad_audit). *Etki:* sessiz-yanlış-veri sınıfı kapanır. *Emek:* M.

*DURUM: AÇIK (tek nokta yamaları hariç).* 2.4 Teams sorgusu sayfalandı ama kalıcı kural yok: bugün ölçüldü, 274 `.select(` çağrısı var, `fetchAllPaged` yalnız 6 dosyada, lint/CI kuralı yazılmadı. D-1'de kurulan palette-guard deseni (script + workflow) bu kural için hazır şablon.

**C-3. Asset harita deseni + cache() konvansiyonu.** *Mevcut:* `getPlayerAssets` `playerIds` destekliyor ama provider'lar parametresiz çağırıyor; tff1/eurocup varyantları filtre desteklemiyor; aynı harita aynı render'da 2x; 13 loader cache'li, sık çağrılanlar (getNavAccess, getPlayerProfile, playerInfoMap) cache'siz. *Hedef:* asset servis fonksiyonu ids-zorunlu + react cache(); `features/*/server` altındaki her parametrik loader varsayılan cache()'li. *Etki:* euro/kupa yüzeylerinde 10-22 istek/sayfa azalma. *Emek:* S-M.

*DURUM: YARIM.* cache() ayağı kapandı (getNavAccess, getPlayerProfile, playerInfoMap artık cache()'li). Açık: `getPlayerAssets` hâlâ bazı yerlerde parametresiz çağrılıyor (resmiLoaders.ts:136), ids-zorunlu değil.

**C-4. Legacy route temizliği + Vercel cache.** *Mevcut:* kök dizinde auth dışı `/matches/[id]` ve `/basketball` (proxy matcher yalnız `/dashboard/*`); hiçbir data sayfasında ISR/cache yok. *Hedef:* legacy route'ları sil/redirect (tek inbound link [MatchCard.tsx:18](oddskeeper-web/frontend/components/MatchCard.tsx)); kullanıcı-bağımsız loader'lara kısa-TTL cache. *Etki:* güvenlik yüzeyi küçülür + SSR maliyeti düşer. *Emek:* S (route) + M (cache).

*DURUM: Route ayağı SÜRÜYOR (arka plan görevi), cache ayağı AÇIK.* `/matches` ve `/basketball` bu satır yazılırken hâlâ duruyordu; silme işi ayrı oturuma verildi (palet bekçisinin ALLOW listesi de o iş bitince sadeleşecek). ISR/kısa-TTL cache ayağı H11 ile aynı, yapılmadı.

### Boyut D: Görsel / UX

**D-1. Tema token'larını zorla (calimla-light kırılması).** *Mevcut:* 32 hardcoded Tailwind palet sınıfı 18 dosyada; team-detail form rozetleri `text-emerald-300/amber-300/rose-300` beyaz kartta WCAG 1.44-1.89 (eşik 4.5), okunmaz; MSM Apply butonu `bg-accent + text-accent-ink` calimla-light'ta kontrast 1.00 (görünmez, [ResmiMatchStatsModel.tsx:1273](oddskeeper-web/frontend/features/tsl/resmi/ResmiMatchStatsModel.tsx)). *Hedef:* token dışı renk sınıfı lint ile yasak; `text-white`→`text-on-accent`. *Geçiş:* Faz 1 lint warn + ihlal dondur, Faz 2 calimla-light'ı kıran 18 dosya, Faz 3 error. *Etki:* açık tema güvenilir. *Emek:* M. *Açık soru:* calimla-light gerçekten kullanılıyor mu (kullanıcı dağılımı)? Kullanılıyorsa MSM Apply + rozet kontrastı acilleşir.

*DURUM: KAPANDI (b166603).* Rapordaki 18 dosya tahmininden genişti: 47 dosyada ~210 palet sınıfı token'a çevrildi. Yeni mekanizmalar: `--warn` tokeni (üç temada), `@custom-variant dark` ile `dark:` varyantı OS yerine site temasına bağlandı, palette-guard CI (yeni palet sınıfı build kırar; iki-tonlu `X-700 dark:X-300` çifti serbest). Bilinçli istisnalar: marka rozetleri (sabit hex), legacy route adası, giriş sayfaları.

**D-2. Tek FormBadge + i18n birliği.** *Mevcut:* form harfleri 5+ implementasyon (FormPills W/D/L, ResultBadge hardcoded renk, EuroCup/tff1 G/B/M); TR kullanıcı bazı sayfada G/B/M bazısında W/D/L görüyor; tarih formatı tek-profilde sabit en-GB, hub'larda locale. *Hedef:* tek `FormBadge` (harfler i18n, renkler pos/neg/veil token); tek `formatDate(locale)/formatNumber(locale)`. *Etki:* dil/tema tutarlılığı tek yerden. *Emek:* S-M.

*DURUM: Form-harfi ayağı İPTAL (sahip kararı 7), renk ayağı D-1 ile KAPANDI, tarih/sayı ayağı AÇIK.* Rozet renkleri artık pos/warn/neg token'ı. Ortak `formatDate(locale)/formatNumber(locale)` helper'ı hâlâ yok (bugün doğrulandı).

**D-3. Spor bazlı header + profil deseni birliği.** *Mevcut:* header 14'e kadar düz hedef, çift "EL" etiketi (futbol Europa League + basket EuroLeague), mobilde hamburger yok (sticky header 2-3 satır chip); takım/oyuncu profili 4 görsel lehçe (~2300 satır paralel kod: TFF1 kopya showcase'ler, kupa tek-sayfa, basket hap-sekme). *Hedef:* spor bazlı iki seviyeli menü (LEAGUE_ITEMS zaten `group` alanı taşıyor); futbol profil iskeleti parametrik, TFF1/kupa aynı iskelete rekabet filtresiyle bağlanır. *Etki:* menü ölçeklenir, paralel kod erir. *Emek:* header M, profil birliği L. *Açık soru:* 1. Lig tek-profil desenine alınsın mı (sahip kararı bekliyor).

*DURUM: Profil birliği İPTAL (sahip kararı 5), header ayağı AÇIK.* Header bugün de 22 link taşıyor ve mobilde hamburger yok.

---

## 5. Yol Haritası ve Kalan İşler

**Bu bölüm 2026-08-19 akşamı güncellendi.** Orijinal yol haritasındaki 1 haftalık kalemlerin tamamı aynı gün kapandı; aşağısı kalan işlerin güncel sırasıdır. Her madde koddan/DB'den doğrulandı.

### KAPANAN (2026-08-19, tek gün)

Güvenlik ve canlı hatalar: **MSM yazma tamamen kapandı (2.1: anon revoke + lockdown + CI bekçisi + service-role route)**, foto sync çökmesi (2.3), Teams 1000-cap yanlış ortalaması (2.4/H6), kadro mükerrer satırı (2.5 görünür ayağı).

Performans: refresh mükerrerliği (H1), değişiklik-bazlı refresh atlama (H2), kupa mat'ları (H3), TSL Players pivot mat (H4), react cache() (H7 + C-3'ün cache ayağı), ölü indeksler (H10), Bets10 WS israfı (H12).

Yapısal: **raw_stats yan tablo ayrımı TAM (A-4: mpsd 340->68 MB, DB 272 MB geri)**, sezon devri takvim mekanizması (2.7), ölü katalog + legacy şema temizliği (A-5, A-2'nin şema ayağı), raw_stats yan tablo Faz 1 (A-4), hata görünürlüğü/ntfy (B-1), wrapper drift (B-3), Opta staging pagination (B-4), ss-drift sayacı (2.6'nın alarm ayağı), tema token'ları + palette-guard CI (D-1).

Bakım: mapping_health FAIL'i (squad_profile_broken_link 9 -> 0) kimlik zinciri düzeltmeleriyle kapandı; denetim bugün PASS.

### KALAN — büyük kalemler (sırayla)

1. **C-2 PostgREST sözleşme katmanı.** Limitsiz `.select` için lint/CI kuralı (bugün 274 çağrı, `fetchAllPaged` 6 dosyada) + sınıra yakın kalan sorgular (aggression 1.382, all_rows 600, squad_audit). D-1'in palette-guard'ı hazır şablon. Bu, 2.4 sınıfının tekrarını önleyen tek kalıcı çözüm.
2. **C-1 Faz 2-3.** Eurocup ve tff1 yüzeyleri için sayfa-şekilli pivot mat'lar (TSL deseni kanıtlandı).
3. **A-1 tek orkestratör modülü.** Refresh mantığı hâlâ 3 dosyada; "kirli bayrağı" okuyan tek modül. H1+H2 kazancı alındığı için önceliği düştü.

### KALAN — küçük/orta işler

6. **H5:** `bb_player_metric_window_v1` -> mat (bugün doğrulandı, hâlâ view; ~600 ms -> ~20 ms).
7. **H8/C-3 kalanı:** `getPlayerAssets`'i ids-zorunlu yap, parametresiz çağrıları daralt.
8. **H9:** leaderboard'ları DB'de order+limit / SQL GROUP BY'a indir.
9. **H11 + C-4 cache ayağı:** kullanıcı-bağımsız loader'lara kısa-TTL cache (bugün de sıfır kullanım).
10. **C-4 route ayağı:** `/matches` + `/basketball` silme (ayrı oturuma verildi; bitince palette-guard ALLOW listesi de sadeleşir).
11. **A-2 kalanı:** `player_mapping`'e `is_curated` + üretimli satırları rebuild kapsamına al; `apply_synthetic_squad`'a opta-bazlı emeklilik (2.5 kökü).
12. **A-3 kalanı:** `football.card_total()` + frontend `cardTotal()` (kart kuralı hâlâ dağınık), kanonik takım-maç base view.
13. **B-2:** pipeline ortak kütüphanesi (`textnorm.py`/`db.py`/`http.py`); drift etmiş `team_key` setleri yanlış eşleşme riski taşıyor.
14. **D-2 kalanı:** ortak `formatDate(locale)/formatNumber(locale)`.
15. **D-3 kalanı:** spor bazlı iki seviyeli header + mobil hamburger (22 link).

### KALAN — düşük öncelik / latent

16. **2.8:** `league_results_v1` + `league_overview_v1` dedup ya da drop (bugün ölçüldü: SL 25/26 = 918 satır, 3x şişik; anon riski lockdown'la gitti, tüketici yok).
17. **team_statistics_split_v1:** kaynak/competition dedup + loader'a competition filtresi (bugün ölçüldü: GS 25/26 = 9 satır; yalnız `?design=classic` yüzeyinde).
18. **team_fixtures_v1** guard'ını competition-agnostik kaynak-öncelik kuralına genelleştir (latent, bugün vaka yok).
19. **mapping_health MED/LOW backlog:** basket pozisyon 4, voleybol isimsiz 46, yetim odds availability 45.

### İPTAL (sahip kararı)

Form harfi standardizasyonu (D-2 form ayağı), TFF1/kupa tek-profil birliği (D-3 profil ayağı), refresh CONCURRENTLY + instance büyütme (H2 SLA'sı sonrası muhtemelen gereksiz), MSM yazmayı admin-only'a daraltma.

### Takvimli teyit

- **20 Ağu sabahı:** daily_logout ilk gerçek koşu doğrulaması.
- **21 Ağu:** H1 (ertelendi) + H3 (CUP MAT OK) + **H2 Faz 2** (ilk turda `degisen>=1` + refresh, tekrar turlarında `H2 SKIP`) VPS logundan doğrulanacak.

---

## 6. Açık Sorular (sahibin karar vermesi gerekenler)

1. **MSM/pm_* model yazmaları:** "herhangi giriş yapmış kullanıcı" mı yoksa yalnız admin mi? Şu an authenticated (admin şart değil) Süper Lig model config yazabiliyor; davet-only güvene mi dayanıyor, admin-only'a mı daraltılsın?
   **KARAR (sahip, 2026-08-19):** Admin-only DEĞİL. Siteye giriş yapan herkes, verilen nav-permission yetkisiyle okuma/yazma değişikliği yapabilir; davet-only güven modeli bilinçli tercih. Kod değişikliği gerekmez.
2. **Anon SELECT yüzeyi:** gerçekten public olması istenen bir alt küme var mı (landing/demo), yoksa 218 nesnenin tümü authenticated'a mı çekilsin? Lockdown kuralını CI ile zorlayalım mı ("to anon" görünce build kır)?
   **KARAR (sahip, 2026-08-19) + UYGULANDI (commit 027d2f6):** Public vitrin yok, site tamamen giriş arkasında. Tüm anon yetkileri geri alındı (uygulama sırasında 245 nesne), postgres default privilege'larındaki otomatik anon grant'lar temizlendi, PUBLIC-execute analytics fonksiyonları rol bazına indirildi. CI koruması kuruldu: yeni SQL'de "TO anon" görülürse build kırılır (.github/workflows/anon-guard.yml, bilinçli istisna için ANON-IZINLI yorumu). Dev bypass server istekleri artık secret key kullanır. Migration: sql/2026-08-19_anon_select_lockdown.sql.
3. **Refresh tazelik SLA'sı:** maç sonrası verinin sitede görünme süresi kaç dakika kabul? Değişiklik-bazlı refresh tasarımının tazelik/yük dengesini bu belirler. CONCURRENTLY'nin refresh CPU'sunu ~1.5-2x artırması micro instance'ta kabul mü, yoksa instance büyütme (Small) masada mı?
   **KARAR (sahip, 2026-08-19):** Maç sırasında güncellik GEREKMİYOR. Ölçü: maç bitiminden 30-45 dk sonra başlayan maç-sonrası scrape tamamlanıp bittiğinden emin olunduktan sonra +10 dk içinde görünsün. H2 Faz 2 tasarımı bu SLA'ya göre kurulacak (canlı maç sırasında mat refresh yok; refresh maç-sonrası scrape'in başarılı bitişine bağlanır). CONCURRENTLY/instance büyütme: ertelendi; bu SLA ile refresh sıklığı çökeceği için muhtemelen gerekmeyecek, H2 sonrası ölçümle yeniden bakılır.
4. **raw_stats jsonb:** geçmiş sezonlar için yeniden-işleme (yeni metrik türetme) hâlâ gerekli mi, yoksa arşivlenip DB dışına alınabilir mi? map/etl/mapping legacy şemaları drop edilsin mi?
   **KARAR (sahip, 2026-08-19) + UYGULANDI (commit 93c6cb9):** Ham veri GEREKLİ (cross, interception, long balls ileride modele girecek) → A-4/B yan tablo yolu seçildi. Faz 1 canlı: football.match_player_stats_raw + senkron trigger + 279k satır backfill (birebir doğrulandı). Faz 2 (22 view'ın join geçişi + kolon drop + VACUUM FULL) ayrı oturum, runbook memory'de. Ölü katalog: 94 nesne sql/archive'a arşivlenip drop edildi. Ders: map/etl/mapping Supabase exposed-schemas listesindeydi, şema drop'u tüm API'yi dakikalarca 503'e düşürdü; boş placeholder olarak geri kuruldu, panelden liste temizlenince kalıcı drop edilecek.
5. **1. Lig tek-profil:** TFF1 kopya showcase'ler (~2300 satır paralel kod) ortak iskelete alınsın mı, yoksa TFF1 ayrı mı kalsın? Kupa (Mackolik) profilleri de tek-profil desenine mi geçsin?
   **KARAR (sahip, 2026-08-19):** Ayrı kalsın; ileride özelleşme/değişme ihtimali var. D-3'ün profil birliği ayağı iptal (spor bazlı header önerisi ayrı değerlendirilir).
6. **calimla-light teması** gerçekten kullanılıyor mu? Kullanılmıyorsa hardcoded palet temizliğinin önceliği düşer.
   **KARAR (sahip, 2026-08-19):** Evet, kullanılıyor. D-1 acilleşir: MSM Apply butonunun calimla-light'ta görünmez olması (kontrast 1.00) ve beyaz kartta okunmayan form rozetleri öncelikli düzeltme.
7. **Form harfleri:** her yerde TR'de G/B/M mi (changelog TR metni öyle vaat ediyor), yoksa evrensel W/D/L'de mi standartlaşılsın?
   **KARAR (sahip, 2026-08-19):** Böyle kalsın, değiştirmeye gerek yok. D-2'nin form-harfi birleştirme ayağı iptal.
8. **Bets10 WS akışı** ileride canlı oran için kullanılacak mı? Kullanılmayacaksa kayıt tamamen kapatılabilir. netcap dump ve `site_event_odds` için saklama süresi (arşiv mi, 7-14 gün silme mi)?
   **KARAR (sahip, 2026-08-19) + UYGULANDI (commit 94ed3f4):** Detaylı inceleme sonrası (parse_bets10_network yalnız responses[] okur, sockets[] tüketicisiz; WS'siz dump birebir aynı satırları üretti) WS payload kaydı kapatıldı; frame SAYACI log'da kaldı (ws=0 "SPA yüklenmedi" arızasının kanaryası). Ek: events-table boş dönen koşu yeni proxy oturumuyla bir kez otomatik tekrarlanır (2026-08-19 10:04 boş koşusu bu sınıftı). Saklama: netcap dump 14 gün (wrapper siler; 683 MB tek seferlik temizlendi), site_event_odds 14 gün (loader siler; 3.880 eski satır temizlendi).
9. **Sezon devri:** literal taşıyan view'lar `ref.current_season`'a bağlansın mı, yoksa her sezon elle güncelleme bilinçli tercih mi? `mapping_health` 2026-08-17 FAIL (squad_profile_broken_link=9) incelenip kapatılacak mı?
   **KARAR (sahip, 2026-08-19) + UYGULANDI (commit 753c0f7):** Sezon geçişi elle değil TAKVİMLE; sınır 24 HAZİRAN (son 2 sezon ölçüldü: finaller en geç 30 Mayıs-1 Haziran, ön elemeler en erken 7-8 Temmuz; 24 Haziran iki yönde de pay bırakır). ref.current_season_label(date) kuruldu, msm_fixtures_tff1_v1 fonksiyona bağlandı; PSM köprü view'ları "güncel sezon" değil "Opta-sonrası çağ" (>= 2026/2027) servis ediyor, sezon devrinde artık HİÇBİR elle iş yok (frontend eşleri de aynı commit'te: lib/season.ts 24 Haziran + isBridgedSeason). **TAMAMLANDI (aynı gün akşam, commit 0dbca88):** detaylı inceleme yapıldı; "geçen sezon istatistiği" kuralı sahip kararıyla kaldırıldı, tff1_squad_v1 de ref.current_season_label()'a bağlandı (yan kazanç: 204 bayat roster-fallback üyeliği düştü, 822→634; "~143 bayat kadro kaydı" bilinen konusunun TFF1 ayağı temizlendi). TSL'de eşdeğer sezon-literal'li kadro yüzeyi yok (sweep doğruladı). Frontend elle sezon listeleri de türetildi (leagues.ts, buildZeroTeamMetrics). mapping_health FAIL'i KAPANDI (2026-08-19 akşam koşusu: squad_profile_broken_link=0, genel PASS; gün içindeki kimlik zinciri düzeltmeleri 0dbca88+808af5f sorunu giderdi). FAIL'ler artık ntfy'a düşüyor. Kalan MED/LOW backlog bilinen konular: bsl pozisyon 4, voleybol isim 46, odds yetim 45.
10. **Bildirim kanalı** tercihi: ntfy.sh push mu, Telegram bot mu? (VPS'te MTA yok, kurulması önerilmez.)
   **KARAR (sahip, 2026-08-19) + UYGULANDI (commit a4328c6):** ntfy.sh seçildi. notify.sh + günlük log digest cron'u (sessiz arıza en geç 24 saatte görünür) + odds_capture/mapping_health anlık kancaları VPS'te canlı; foto sync bug'ı (2.3) da aynı commit'te düzeltildi ve match_scrape wrapper drift'i (B-3) kapatıldı.

---

*Rapor sonu. Salt-okunur inceleme; hiçbir kod/DB/cron/deploy değişikliği yapılmadı. Kanıt dökümleri scratchpad/evidence/ altında.*
