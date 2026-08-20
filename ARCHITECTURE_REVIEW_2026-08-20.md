# Mimari İnceleme Raporu 2 (Uçtan Uca, Salt-Okunur)

Tarih: 2026-08-20. Bir önceki rapor: 2026-08-19 (ARCHITECTURE_REVIEW.md); o rapordaki maddelerin büyük kısmı 19-20 Ağustos'ta uygulandığı için bu inceleme hem uygulananların canlı teyidini hem de taze bir uçtan uca taramayı kapsar.

Yöntem: 5 paralel salt-okunur denetçi (VPS log/cron, canlı DB ölçümleri, frontend/servis katmanı kod taraması, pipeline kod incelemesi, lokal dev server sayfa-süresi ölçümü) + öne çıkan bulguların bağımsız doğrulaması (anon grant canlı sorgu, digest deseni kod okuması, fetchAllPaged kod okuması, mapping_health sorgusunun canlıda yeniden koşulması). Hiçbir kod/DB/cron/deploy değişikliği yapılmadı. Ham kanıtlar scratchpad/evidence-*.txt dosyalarında.

---

## 0. Genel Durum (iyi haberler önce)

**Dünkü raporun uygulanan maddeleri üretimde doğrulandı:**

- **H1/H2/H3 canlı çalışıyor.** 19 Ağu gecesi CL playoff turlarında: loader "ertelendi" satırı + tek "TSL MAP + MAT OK" (H1); 16 kez "H2 SKIP", payload'ı gerçekten değişen 5 turda refresh (H2 Faz 2 deseni doğru); "CUP MAT OK" (H3). Maçlı ve mat'lı tur 5 dk 11 sn, H2-skip turu ~1.5 dk, maçsız tur ~20-25 sn; SLA (maç-sonrası scrape bitişi +10 dk) fazlasıyla içeride.
- **daily_logout ilk gerçek koşusu temiz:** 19 Ağu 23:59 UTC, rc=0, 2 admin muaf, 8 kullanıcının 29 oturumu iptal edildi.
- **A-1 orkestratör deploy edildi ama ilk maçlı sınavı henüz olmadı** (deploy'dan beri kirli kaynak yok); ilk gerçek sınav 20 Ağu akşamı Beşiktaş/Trabzonspor EL maçları.
- **mpsd split kalıcı:** match_player_stats_details 68 MB, raw_stats kolonu yok; yan tablo 277 MB; DB toplam 781 MB.
- **MSM güvenliği kalıcı:** 7 msm_* RPC'nin tümü yalnız service_role EXECUTE; tüm yazma route'ları (msm/pm/basketball/team-notes/model-history/user-prefs/admin) oturum + yetki kontrollü; DEV_AUTH_BYPASS çift kilitli, production'da etkinleşme yolu yok.
- **Sayfa süreleri hedefte.** Lokal dev ölçümünde hiçbir sayfa sıcakta 2 sn'yi aşmıyor. Dünkü üç büyük hızlandırma doğrulandı: eurocup takım profili 8-10 sn'den 0.67 sn'ye, CL Players 4.1 sn'den 1.1 sn'ye, TSL Players 1.7 sn'den 1.2 sn'ye. Canlı kabuk TTFB 0.44-0.74 sn.
- **Kaynaklar rahat:** VPS disk %3, RAM 7.5 GB boş, load ~0; DB cache hit %98.6, bloat yok, sequence doluluğu %0, bağlantı 27/60. Bets10 kanaryaları (ws=0 sayacı, 14 gün saklama, boş-koşu ve adres-çözme tekrarı) çalışıyor; wrapper drift 0.
- **26/27'de kazayla giren 9 Opta maçı geri gelmemiş** (0 satır); ss-terfi drifti 0; work_mem=8MB duruyor.

Sayfa ölçüm tablosu (dev server, sıcak medyan): Dashboard 0.07s (redirect), Upcoming Events 0.65s, TSL resmi 0.74s, TSL Players 1.20s, TSL Teams 0.76s, 1.Lig ana 0.67s, 1.Lig Players 0.65s, CL hub 0.45s, CL Players 1.11s, eurocup takım profili 0.67s, CL maç 0.79s, TSL takım profili 0.84s, TSL oyuncu profili 0.89s, MSM/PSM kabuğu 0.09s (veri client'ta yüklenir).

---

## 1. Kritik Hatalar (ilk çözülmesi gerekenler)

Üç gerçek kritik bulgu var; üçü de bağımsız doğrulandı. Doğruluk/güvenlik sınıfında bunların dışında kritik bulgu YOK.

**GÜNCELLEME (2026-08-20 öğleden sonra): üçü de aynı gün KAPANDI.** K-1: commit 6d83d04 (py DDL'inden anon çıktı, canlı REVOKE uygulandı ve proje şemalarında anon grant 0 doğrulandı, mapping_health'e anon_grants_project_schemas HIGH sayacı + anon-guard artık *.py de tarıyor). K-2: commit d5b0429 (fetcher'lar tam çöküşte rc!=0, digest desenine ' HATA:' + 'UYARI' eklendi, wrapper'a SOFA/FLASH/CUP FS/orkestratör FAILED anlık ntfy kancaları; VPS'e deploy edildi, /opt kopyaları birebir). K-3: commit 17a8e64 (fetchAllPaged hata anında throw, resmiLoaders elle sayfalama döngüleri + eurocup/tff1 çekirdek sorguları error kontrolü; smoke test 4 sayfa 200). Aşağıdaki metin inceleme anındaki durumu korur.

### K-1. Anon lockdown kaçağı: bir tablo anon'a açık kalmış

**Kanıt (canlı doğrulandı):** `ref.flashscore_sofa_cup_player_map` tablosunda anon rolüne SELECT grant'i var (has_table_privilege=True; grant listesi: postgres tam + authenticated + service_role + anon SELECT). Proje şemalarındaki TEK anon grant bu; kalan 29 grant Supabase sistem şemalarında (storage/realtime, normal).

**Etki:** Veri hassas değil (kimlik eşleme tablosu) ama 19 Ağu "anon'a sıfır veri yüzeyi" kararının ihlali ve daha önemlisi bekçinin kör noktasının kanıtı: anon-guard CI yalnız sql dosya diff'lerini tarar; bu grant büyük olasılıkla tablo lockdown sonrasında pipeline tarafından yeniden yaratılırken geldi (kupa FS haritası 19-20 Ağu'da aktif geliştirilen yoldu). Aynı yoldan gelecekte de kaçak üreyebilir.

**Düzeltme:** (a) `REVOKE ALL ON ref.flashscore_sofa_cup_player_map FROM anon;` (b) kalıcı ayak: mapping_health'e "proje şemalarında anon grant sayısı = 0" kontrolü (haftalık cron + ntfy zaten var; CI'ın göremediği runtime grant'ları bu yakalar). Emek: S. Risk: yok.

### K-2. Sessiz tam-çöküş boşluğu: fetcher lig hataları hiçbir alarma düşmüyor

**Kanıt (kod doğrulandı):** `fetch_sofascore_matches.py:243-244` ve `fetch_flashscore_matches.py:153-154` lig başına `except: print(f"[{lig}] HATA: ...")` yapıp her durumda rc=0 dönüyor; wrapper "SOFA OK / FLASH OK" basıyor. `log_digest.sh:13` deseni `FAILED|Traceback|FAIL:|\[HATA\]|NotNullViolation|SystemExit`; üretilen satır "[Süper Lig] HATA: ..." biçiminde olduğundan `\[HATA\]` eşleşmez.

**Etki:** Proxy ya da SofaScore erişimi TAMAMEN çökse bile banner, ntfy anlık kanca ve günlük digest'in üçü de sessiz kalır. Foto-sync'in 4 gün fark edilmeyen çöküşüyle birebir aynı sınıf; B-1'in kapattığı sanılan boşluğun kalan yarısı. (Yan bulgu: digest bugün de gürültülü, "198 hata"nın tamamı 14-18 Ağu'nun tarihsel photo-sync satırları.)

**Düzeltme:** (a) digest desenine ` HATA:` ve `UYARI:` ekle + digest'e son-24-saat penceresi; (b) fetcher'lar "işlenen maç 0 VE en az 1 lig HATA" durumunda rc!=0 dönsün, wrapper ntfy'lasın. Emek: S. Risk: yok.

### K-3. Sayfalı okuma katmanı hata anında kısmi veriyi sessizce döndürüyor

**Kanıt (kod + canlı tetikleyici doğrulandı):** `frontend/lib/supabase/paginate.ts:14-17` fetchAllPaged, herhangi bir sayfa hatasında console.error + break yapıp O ANA KADARKİ satırları normal sonuçmuş gibi döndürür. Tüketicilerin çoğu (eurocupData.ts, tff1data.ts, resmiLoaders.ts fetchLog/fetchCurLog) Supabase error alanını hiç okumaz. Bu senaryo teorik değil: bugünkü dev server logunda `getCupTeamSeasonStats` 4 kez "canceling statement due to statement timeout" yedi ve sayfa hatayı yutup boş/eksik veriyle render etti (soğuk pooler + authenticator'daki 8 sn statement_timeout).

**Etki:** Dün kapatılan 2.4 bulgusunun (1000-cap yanlış L5/L10 ortalaması) runtime-hata ikizi: sayfa 2+ sorgusu hata verirse Teams ortalamaları yine erken-hafta kısmi verisinden hesaplanır, UI'da hiçbir sinyal olmaz. Sessiz-yanlış-istatistik sınıfı bahis modeli destekli sitede kritik.

**Düzeltme:** fetchAllPaged hata durumunda throw etsin (ya da `{rows, complete}` döndürsün); hesap yapan yüzeyler (Teams log, aggression, leaderboard) incomplete'te boş dön + hata göster. Loader'larda error alanı kontrolü aynı elde standartlaşsın. Emek: S-M. Risk: düşük (hata durumunda davranış değişir, normal yol aynı).

---

## 2. Hız / Performans Önerileri

Sayfa süreleri zaten hedefte (bölüm 0); buradaki kazançlar DB yükü ve eşzamanlı kullanıcı dayanıklılığı asıllı. Etki sırasıyla:

**P-1. FS kupa yolu H2 kapısını deliyor (ölçüldü, en büyük kalem).** 19-20 Ağu gecesi aynı 4 CL maçı FlashScore grace penceresi boyunca her 10 dk turunda yeniden upsert edildi ve kupa mat'ları 22 ARDIŞIK turda tazelendi (21:35'ten 00:54'e "CUP MAT OK" 22 banner; H2 SKIP olan turlarda bile). H2 Faz 2'de bilinçli açık bırakılan "FlashScore yolu tuzağı" artık ölçülmüş maliyet. Düzeltme: fetch_flashscore_cup_matches'e (ve FS 1.Lig yoluna) sofascore'daki payload-hash kapısının aynısı; değişiklik yoksa cup_islendi tetiklenmesin. Kazanç: maç akşamı kupa refresh yükünün ~%80-90'ı. Emek: S-M.

**P-2. bb_player_metric_window_v1 hala düz view (ölçüldü).** EXPLAIN ANALYZE 690 ms, 96.592 ara satır, 12.7 MB disk sort (work_mem yetmiyor); PostgREST'ten 1.300+ çağrı ort ~640 ms. Basketbol sayfalarının en pahalı sorgusu. Düzeltme: el_player_metric_window_v1 kalıbıyla mat'a al + orkestratör tablosuna ekle. Kazanç: ~640 ms'den ~20 ms'ye. Emek: S.

**P-3. Kullanıcı-bağımsız loader'lara kısa-TTL cache hala 0 (H11).** unstable_cache/revalidate/ISR kullanımı sıfır; her SSR aynı sorguları yeniden koşuyor. En ağır adaylar: eurocup/tff1 playerRows (1-3.5k satır), `resmi.ts:269` getPlayerNameAssetMap (player_current_info_v1 TAM tarama, üstelik cache()'siz; aynı render'da bile tekrar edebilir), `resmiLoaders.ts:606` fetchCurLog (6-7k satır/sezon). Veri zaten 10 dk'lık pipeline turuyla değiştiği için 60-300 sn TTL riski yok denecek kadar az. Kazanç: eşzamanlı trafikte Supabase istek hacminde büyük düşüş. Emek: M.

**P-4. H9 kalanı: TSL leaderboard'u DB'ye indir.** `features/tsl/server/queries.ts:279` hala metrik başına 600 satır çekip JS'te süzüyor (maç listesi de :68'de limit 600). Kupa/tff1 tarafı playerRows cache'iyle fiilen çözüldü; yalnız TSL dalı kaldı. Düzeltme: DB'de order+limit (ya da mevcut leaderboard mat'ından okuma). Emek: S.

**P-5. select("*") dar kolon listesine (C-2 Faz 3).** 71 kullanım / 17 dosya. Ölçülmüş emsal: kupa oyuncu view'unda dar liste payload'ı 1.38 MB'tan 824 KB'a indirdi. En genişler: cupPlayerProfile.ts (61 kolonluk view), getTff1Stats.ts (tüm sezonlar). Kolon atlama riski nedeniyle ayrı dikkatli oturum işi (dünkü bilinçli erteleme geçerli, ama perf kazancı da masada). Emek: M.

**P-6. Ölçüm hijyeni: pg_stat_statements reseti.** İstatistikler 12 Mayıs'tan beri kümülatif; "refresh %76" payı dünkü optimizasyonların etkisini gösteremiyor. `pg_stat_statements_reset()` + 48 saat sonra yeni baz ölçüm; bundan sonraki her perf kararı temiz veriyle alınır. Emek: S (tek komut, sahip onayıyla).

---

## 3. Nice to Have (must değil)

**Kimlik/veri sağlığı paketi (birbirine bağlı küçükler):**
- ref.player_mapping'de 29 opta_player_id iki satırlı (gerçek af id + tm sentetik çifti, ör. Lemina); terfi sonrası tm satırları temizlenmeli.
- Bugün 1 yeni kırık kadro-profil bağı doğrulandı: Kuzey Şapaz (Fenerbahçe), kadro af673366 / profil ss2690252. Haftalık mapping_health Pazartesi yakalayacak; kalıcı çözüm apply_synthetic_squad'a opta/çift-kimlik bazlı emeklilik (dünkü 2.5'in kökü, hala açık).
- TM kadro kıyas raporundaki 3 "eksik transfer" aslında isim-varyantı yanlış pozitifi (Susoho/Sissoho, Thalisson/Kelven, Şatlı sıra farkı); TM matcher'ına token-bazlı normalize eklenirse rapor gürültüsü düşer.
- team_match_metrics_base_v1'de 2.797/11.794 satır team_slug NULL (eşleşmemiş Avrupa takımları); slug ile gruplayan tüketici tek kovaya toplar.

**Tüketicisiz mükerrer view'lar:** league_results_v1 + league_overview_v1 3x şişik (SL 25/26 = 918 satır, 54 takım), team_statistics_split_v1 2x (GS = 6 satır/3 split). Frontend kullanmıyor, anon riski lockdown'la gitti; dedup ya da drop.

**Pipeline yapısal:**
- B-2 textnorm tek kütüphane: team_key drift'i somutlaştı ("Beşiktaş JK" iki haritada farklı anahtar üretir, "Fenerbahçe 1907" üç kopyada farklı, 'spor kulubu' drop elemanı ölü). Yanlış eşleşme sınıfına karşı orta vadeli en değerli refactor.
- Tazelik sıraları: apply_synthetic_squad.py:478-485 squad mat'ını bridged üçlüsünden ÖNCE tazeliyor (kanonik sıranın tersi); run_tsl_squad_refresh.sh zincirinin sonunda hiç refresh yok (transfer penceresi günü kadro/PSM köprüsü saatlerce bayat). İkisi de orkestratör çağrısına bağlanmalı.
- H2 hash kenarı: per-event hash hatası "değişmedi" sayılıyor (fetch_sofascore_matches.py:185-188); deterministik hata kalıcı bayat mat bırakabilir; except dalında değişmiş-say (tek satır).
- Opta emekliliğinin kod kilidi yok: run_auto_pipeline.bat + zinciri hala çalışır durumda, görev yeniden etkinleşirse 26/27 Opta verisi tekrar girer; bat'ı arşivle ya da OPTA_RETIRED guard.
- run_sofascore.sh ve run_sofascore_fixtures.sh repoda yok (yalnız /opt'ta), wrapper-drift denetiminin dışındalar; deploy/ altına alınmalı. run_sofascore.sh + run_fs_player_map.sh flock'suz (match_scrape ile aynı mat'lara teorik çakışma).
- Sessiz-arıza adayı diğer wrapper'lar (bet365/bmbets/oddsportal/upcoming_events/trigger_check) rc kontrolsüz; K-2'deki digest desen genişletmesi çoğunu bedavaya kapatır.

**CI bekçisi boşlukları:** postgrest-guard `.limit(değişken)` yakalamıyor, `count:` token'ı zinciri muaf sayıyor, rpc() hiç taranmıyor; palette-guard `dark:` geçen satırı tümden muaf tutuyor ve template-literal sınıfları görmüyor. anon-guard'ın runtime kör noktası K-1'de.

**Servis/UI küçükleri:**
- player-market-access-request route'u auth'suz ve rate-limitsiz mail tetikliyor (Brevo kota/spam); basit rate limit ya da oturum şartı.
- "Added!" rozeti calimla-dark'ta ~2.6:1 kontrast (ResmiMatchStatsModel.tsx:961-965).
- Ortak formatDate/formatNumber hala yok (en-GB, en-US, tr-TR ve locale-duyarlı karışık, 6+ nokta).
- Sezon literal kalıntıları: app-header.tsx'te 5 sabit "season=2026/2027" href'i; lib/season.ts lokal saat kullanıyor (24 Haziran gecesi DB ile 1 günlük uyuşmazlık penceresi); leagues.ts CUR_SEASON modül-sabiti (uzun yaşayan process'te restart'a kadar bayat).
- getResmiTransfers sıralamasında tie-break unique kolonu yok (913 satır, 1000'i aşınca sayfa kayması riski); eurocup playerRows cache'i fabrika closure'ında (modül seviyesine alınmalı).
- Header 22 link + mobil hamburger yok (D-3, sahip değerlendirmesi bekliyor); kullanılmayan indeks birikimi önemsiz (~20 adet, 8-16 KB, sonraki temizliğe).

---

## 4. Takvimli Teyit

- **20 Ağu akşamı (bu akşam):** A-1 orkestratörün ilk maçlı sınavı (BJK/TS EL): log'da `[orch] kirli kaynak` satırı + mat-başı refreshed satırları + hiç `HATA analytics.` olmaması. Aynı gece P-1 (FS kupa 22x refresh) davranışı yeniden gözlenecek.
- **24 Ağu (Pazartesi):** haftalık mapping_health; squad_profile_broken_link=1 (Kuzey Şapaz) alarmı beklenir.
- **K-2 düzeltmesi sonrası:** digest'in tek günde temiz (tarihsel gürültüsüz) rapor verdiği görülmeli.

*Rapor sonu. Salt-okunur inceleme; hiçbir kod/DB/cron/deploy değişikliği yapılmadı.*
