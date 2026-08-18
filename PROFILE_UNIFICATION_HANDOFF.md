# Tek-Profil Birleştirme — Sonraki Oturum Prompt'u

> **DURUM (2026-08-18): TÜM FAZLAR TAMAMLANDI (2b + 3 + 4).** Bu doküman artık
> tarihsel kayıt. Yapılanların özeti:
> - **Faz 2b**: `player_profile_sofascore_v1` + current-info köprüsü kupalara
>   genişledi (yalnız synthetic + SL-verisi-olmayan oyuncular; opsiyon c) —
>   kupa-only oyuncular (Mbappe) profil+foto aldı; Talisca/Uğurcan bire bir
>   değişmedi, non-synthetic 553 sabit. Ek: Faz 2a'nın opta_seasons dışlaması
>   yalnız SL satırlarına daraltıldı (Torreira'nın CL 25/26 12 maçı loga geldi).
>   Migration: `sql/2026-08-18_player_profile_cup_widen.sql` (canlı).
> - **Faz 3**: `sofascore_football_player_link_v1` synthetic dışlaması kalktı
>   (`sql/2026-08-18_player_link_all_profiles.sql`, canlı); kupa Players/
>   sıralama/kadro/maç-detay oyuncu linkleri TEK football profiline;
>   EuroCupPlayerDetail + CupCrossLeagueToggle + player toggle loader'ları
>   SİLİNDİ; eski /euro-cups/*/player/[id] URL'leri slug çözüp redirect eder.
> - **Faz 4**: `team_results_v1` + `team_recent_form_v1` kaynak-öncelikli dedup
>   (opta>apifootball>sofascore; GS 25/26'daki çift satır bug'ı da düzeldi) —
>   `sql/2026-08-18_team_results_source_dedup.sql` (canlı). Dual takımlar
>   football takım profiline (sonuçlarda kupa rozetli, form/trend/özet lig-öncelikli);
>   yabancı takımlar TEK birleşik `/dashboard/euro-cups/team/[teamId]` sayfasında
>   (kupa kırılımı sayfa içi ?comp= pilleri); eski 3 takım route'u redirect.
> - Perf korumaları: getPlayerSlugMap sayfalama+filtre (1000-satır kırpılması da
>   düzeldi), getPlayerAssets full-scan TSL filtresi.
> - tsc 0 hata; dev tarayıcı doğrulaması yapıldı; changelog entry eklendi.

> (Aşağısı tarihsel plan metnidir.)
> Bunu bir sonraki oturuma **olduğu gibi** ver. Agent bu dosyayı baştan sona okumalı,
> KOD YAZMADAN ÖNCE bahsedilen dosya/view'ları gerçekten okuyup DB'de doğrulamalı,
> ve aşağıdaki "SAHİBİN ENDİŞELERİ"ni içselleştirmeli. Kolay yerden başlama; önce
> "nereye dokunuyor, neyi neye bağlamam gerek" haritasını çıkar.

---

## AMAÇ (değişmez ilke)

**Bir oyuncu = tek kanonik kimlik (slug) = tek profil = tek fotoğraf.** Bir takım da öyle.
Veri tüm rekabetlerden (Süper Lig + 1.Lig + Şampiyonlar/Avrupa/Konferans Ligi) O TEK
profile dolar. Rekabet kırılımı profilin **içinde** (competition kolonu / filtre / sekme),
**asla ayrı sayfa + toggle değil.** Site zaten slug-keyed tek profile sahip (football
player-detail); iş, onu tüm rekabetleri kapsayacak şekilde genişletmek + her şeyi ona
yönlendirmektir.

## SAHİBİN ENDİŞELERİ (bunları anlamadan başlama)

1. Rekabet başına ayrı profil sayfası + butonlarla birbirine yama = YANLIŞ MİMARİ. Bir
   oyuncunun 3 farklı profil fotoğrafı olması bunun kanıtıydı. Bunu ortadan kaldır.
2. "En kolay yerden başlama." Bir şey isteyince önce **nereye dokunacağını, birbirine
   bağlaman gereken yerleri** çıkar; sonra dokun.
3. **Süper Lig'i (merkezî canlı profilleri) BOZMA.** player_profile_bridged mat'ı + tüm
   tsl_ss mat'ları buna bağlı.
4. Yama yapıp yarım bırakma. Konsolidasyonu tutarlı bitir.
5. Oyuncu başına TEK foto. Takım başına tek logo.

---

## VERİ MODELİ GERÇEKLERİ (yanlış keşfetme, bunlar doğru)

- **SofaScore global tek oyuncu id** kullanır: bir oyuncunun kupa sofascore_player_id'si =
  Süper Lig sofascore_player_id'si (AYNI). Örn. Talisca her yerde `329245`.
- Kimlik köprüsü: `ref.sofascore_opta_player_map` (sofascore_player_id → opta_player_id;
  opta yoksa sentetik `ss<sofascore_id>`). **FAZ 1'DE GENİŞLETİLDİ**: artık kupa
  oyuncularını da içerir (opta-eşleştirme Süper Lig havuzunda; kupa-only yabancı → ss).
  Kanıt: Talisca 329245→opta `4lhyi7...`; Mbappe 826643→`ss826643`; non-synthetic=553
  DEĞİŞMEDİ (SL regresyon yok). Kaynak: `pipeline/src/football/build_sofascore_opta_player_map.py`
  (commit 5ed48a4). **Bu builder cron'da her koşuda truncate+insert ile map'i sıfırdan
  kurar → GENİŞLETİLMİŞ builder DEPLOY edili kalmalı yoksa map eski haline döner.**
- Football profili köprüsü: `analytics.player_profile_bridged_v1` = opta UNION sofascore,
  slug-keyed, eşitlikte **opta kazanır** (src_rank; opta=0, sofascore=1). `player_source_id`
  = opta id VEYA `ss<id>`. Kaynak: `sql/2026-08-15_player_profile_sofascore_bridge.sql`.
- **Kanonik foto = `football.sofascore_player_info.photo_url`** (sofascore_player_id ile).
  Hem football bridge'i hem kupa yolu zaten oradan okur. Slug'a ulaşmak için map üzerinden.
- Football player-detail loader'ları (`frontend/features/player-detail/server/`):
  - `getPlayerProfile` → `player_profile_bridged_v1` (slug)
  - `getPlayerMatchLog` → `player_match_log_bridged_v1` (slug) — **FAZ 2a'DA GENİŞLETİLDİ**
    (kupaları kapsar; competition kolonu var).
  - `getPlayerCurrentInfo` → `player_current_info_bridged_v1` (slug, photo_url)
  - `getPlayerAdvancedOverview(player_source_id)` → `tsl_ss_player_overview_advanced_mat`
    (opta-source-id; Süper Lig scope; eksikte null → boş render, çökmez)
  - `getPlayerDetailedMetrics` → `tsl_ss_player_detailed_metrics_global_mat` (aynı)

## ZATEN YAPILDI (TEKRAR YAPMA)

- **FAZ 1 — Kimlik** (commit 5ed48a4, canlı): map kupaları kapsar. Süper Lig inert.
- **FAZ 2a — Match-log birleştirme** (commit b12f94d, canlı): `player_match_log_sofascore_def_v1`
  competition filtresi Süper Lig + CL/EL/Con. Migration `sql/2026-08-18_player_match_log_cup_widen.sql`.
  DOĞRULANDI: Talisca'nın TEK profili = Süper Lig 47 + Şampiyonlar Ligi 4 (competition etiketli,
  toggle yok). Mat `player_match_log_sofascore_mat` `refresh_tsl_mats.py` ile tazelenir.
- **KUPA VERİ KATMANI hazır** (önceki iş): ucl/uel/uecl_* view'lar, eurocup_player_match_log_v1,
  eurocup_stage_matches_v1, FlashScore xG overlay, kupa fotolar/logolar. Bunlara dokunma;
  yalnız TÜKETİCİ tarafını (profil) birleştir.
- **BENİM YANLIŞ YAPTIĞIM (KALDIRILACAK)**: ayrı kupa profil sayfaları + toggle:
  `frontend/features/tsl/resmi/EuroCupPlayerDetail.tsx`, `EuroCupTeamDetail.tsx`,
  `CupCrossLeagueToggle.tsx`; route'lar `app/dashboard/euro-cups/{cl,el,conf}/{player,team}/[id]/page.tsx`;
  loader'lar `cupPlayerProfile.ts` içinde `getCupPlayerCrossLinks`/`getCupTeamCrossLinks`/
  `getCupMatches`; view `analytics.sofascore_football_player_link_v1` + `sofascore_football_team_link_v1`;
  `leagues.ts` playerBase/teamBase + playerHrefFor/teamHrefFor kupa dalları.

---

## KALAN FAZLAR (yap)

### FAZ 2b — Kupa-only oyuncular + tek foto (RİSKLİ, DİKKAT)

Kupa-only yabancılar (Mbappe gibi, Süper Lig'de oynamayan) için de TEK profil + foto olması.

1. `player_profile_sofascore_v1`'in competition filtresini (`sql/2026-08-15_player_profile_sofascore_bridge.sql`
   ~satır 47-49: `and m.competition like 'S%per Lig%'`) kupaları da alacak şekilde genişlet.
   → kupa-only oyuncular profil satırı + slug alır.
2. **KRİTİK RİSK**: bridge, `player_source_id`'ye göre partition + `row_number` (order:
   `last_match_datetime desc, appearances desc, src_rank`) ile TEK satır tutar. DUAL oyuncuda
   (Talisca) opta legi Süper Lig; sofascore legine kupa eklenince, eğer kupa maçı son Süper Lig
   maçından DAHA YENİ ise sofascore-cup satırı row_number'ı KAZANIR → profil BAŞLIĞI (takım,
   özet) Süper Lig yerine kupadan gelir → REGRESYON. İsim/slug canon'a pinli (opta) ama
   takım/özet kazanan satırdan. ÇÖZÜM SEÇENEKLERİ: (a) dual (opta mevcut) oyuncuda sofascore-cup
   satırının override etmesini engelle (opta legi öncelikli), (b) profil özetini competition-farkında
   yap, (c) sofascore legini "yalnız opta karşılığı OLMAYAN (ss) oyuncular için" kupaya genişlet
   (dual oyuncuların kupa satırı sofascore legine hiç girmesin, çünkü zaten opta ile var).
   **(c) EN GÜVENLİSİ**: `player_profile_sofascore_v1`'i kupaya genişlet AMA sadece map'te
   match_method='synthetic' olan (yani Süper Lig opta profili olmayan) oyuncular için. Böylece
   dual oyuncuların profil başlığı DEĞİŞMEZ; yalnız kupa-only oyuncular yeni profil alır.
3. `player_current_info_sofascore` legini (`sql/2026-08-15_player_current_info_sofascore_bridge.sql`
   ~satır 36) aynı mantıkla genişlet → kupa-only oyuncular foto/bio alır (foto
   `football.sofascore_player_info.photo_url`).
4. Bunlar MATVIEW (`player_profile_bridged_mat`, `player_current_info` mat) — def'i recreate +
   REFRESH. **TAZELEME SIRASI**: profil mat ÖNCE (match-log'un slug_map'i onu okur), sonra
   match-log mat. `refresh_tsl_mats.py`'ye bak; sıra doğru mu kontrol et.
5. tsl_ss advanced/detailed mat'ları Süper Lig scope kalır → kupa-only oyuncuda Advanced/Detailed
   sekmeleri BOŞ render (graceful, çökmez). Kabul edilebilir; istenirse kupa eşdeğeri sonra.
6. **DOĞRULA**: (a) dual oyuncu (Talisca opta 4lhyi7) profil başlığı takım/rank/özet DEĞİŞMEDİ;
   (b) kupa-only (Mbappe ss826643) profil + foto + kupa match-log GELDİ; (c) bilinen Süper Lig
   yıldızı profili aynen duruyor.

### FAZ 3 — Yeniden bağla + parçalanmayı kaldır (2b'ye bağlı)

1. **Sofascore player id → slug çözücü**: kupa Players/sıralama satırları sofascore player_id
   taşır. Bunu slug'a çevir. `sofascore_football_player_link_v1` synthetic'i DIŞLIYOR (yalnız
   dual) — kupa-only için YETMEZ. Faz 2b sonrası TÜM oyuncular (dual+ss) profil aldığından,
   `player_profile_bridged_v1`'den (sofascore id → opta/ss → slug) TÜMÜNÜ kapsayan bir analytics
   view kur (veya mevcut link view'ı synthetic'i de alacak şekilde genişlet — DİKKAT: o view
   Süper Lig profili olmayanları kasten dışlıyordu; artık hepsi profil aldığından güvenli).
2. `leagues.ts` `playerHrefFor` kupa dalı: ayrı kupa route yerine → football detail
   `/dashboard/stats-analysis/football/player-stats/detail?player=<slug>`. (1.Lig için de
   yapmak isteğe bağlı — şimdilik tff1 bırakılabilir, sahibe sor.)
3. **KALDIR**: EuroCupPlayerDetail.tsx + 3 player route + toggle + getCupPlayerCrossLinks +
   sofascore_football_player_link_v1 (artık gereksiz). Eski kupa profil URL'leri football
   profiline REDIRECT (kırık link/yer imi olmasın) — Next redirect config veya route-level.
4. **DİKKAT**: `cupPlayerProfile.ts` loader'larının BİR KISMI kupa Players LİSTESİ tarafından
   da kullanılıyor (profil dışında). Neyin listeye, neyin profile ait olduğunu ayır; listeyi
   BOZMA. Silmeden önce `grep` ile kullanım yerlerini çıkar.

### FAZ 4 — Takımlar (aynı mimari)

1. Football takım profili: `/dashboard/stats-analysis/football/team-stats/detail?team=<slug>`,
   slug-keyed (`ref.team_profiles`, `getTeamProfile`). Köprü: `ref.team_mapping`
   (source_team_id sofascore ↔ team_slug, is_active).
2. **KISIT**: `ref.team_mapping` KÜRE (yalnız Türk takımları sofascore-eşli; yabancı kupa
   takımları YOK). Yani yabancı kupa takımları slug alamaz → tek football profili olamaz.
   KARAR (sahibe sor): (a) team_mapping'i yabancı kupa takımlarıyla genişlet (otomatik/küratör),
   ya da (b) yabancı kupa takımı yalnız kupa takım-view'ında kalsın (football profili olmasın).
3. Takım profili verisini (varsa bridge) dual takımlar (GS/FB) için kupa verisini kapsayacak
   şekilde genişlet (player match-log deseninin takım karşılığı).
4. **KALDIR**: EuroCupTeamDetail.tsx + 3 team route + teamBase + teamHrefFor kupa dalı +
   getCupTeamCrossLinks + sofascore_football_team_link_v1 (veya slug çözümü için tut).

---

## DOĞRULAMA (her faz sonrası)

- **Süper Lig regresyon YOK**: bilinen oyuncu (Uğurcan 754330→opta, veya bir SL yıldızı) profil
  başlık/istatistik AYNEN. `player_profile_bridged_v1`'de non-synthetic sayısı 553 sabit kalmalı.
- Dual oyuncu (Talisca) profili tüm rekabetleri, TEK foto, doğru başlık gösteriyor.
- Kupa-only oyuncu (Mbappe ss826643) profil + kupa verisi + foto var.
- Kupa Players/sıralama link'leri → TEK football profiline.
- Kırık link yok (eski kupa URL'leri redirect veya temiz kaldırma).
- `cd oddskeeper-web/oddskeeper-web/frontend && npx tsc --noEmit` = 0 hata.
- Prod route sağlığı (sign-in yönlenmesi = build OK).

## DEPLOY MEKANİĞİ

- **Frontend**: commit + push → Vercel otomatik deploy (vercel.json, CI yok).
- **SQL**: canlı Supabase DB'ye psycopg2 ile uygula (VPS `pipeline/.env` DATABASE_URL, autocommit).
  Migration dosyasını `sql/`'e kaydet. Büyük view'ları pg_get_viewdef + hedefli string-replace ile
  dönüştürmek güvenli (bu oturumda kullanıldı; transaction+ROLLBACK ile dry-test et).
- **Pipeline**: commit + push → VPS `git pull` (`*/15` cron otomatik; manuel:
  `ssh -i ~/.ssh/oddskeeper_netcup root@159.195.219.130 'cd /opt/oddskeeper/repo && git pull --ff-only'`).
- **Mat'lar**: `pipeline/src/football/refresh_tsl_mats.py` bridge mat'larını tazeler (run_match_scrape
  step 3b). Def recreate ettiysen manuel refresh + cron'un tazelediğini teyit et.
- **Pipeline testi**: git ağacını/auto-pull'u bozmamak için VPS'te İZOLE staging dizini kullan
  (`/opt/oddskeeper/*_stage/pipeline` + kopya `.env`), oradan çalıştır.
- **VPS**: `ssh -i ~/.ssh/oddskeeper_netcup root@159.195.219.130`; venv `/opt/oddskeeper/venv/bin/python`;
  repo `/opt/oddskeeper/repo/oddskeeper-web`; log `/opt/oddskeeper/logs/`.
- **Görsel doğrulama**: dashboard admin-login gerektirir; agent tarayıcıdan authed render açamaz.
  Sahip (admin) görsel teyit eder. Build sağlığı = prod route sign-in'e yönleniyor mu (404/500 değil).

## TUZAKLAR (bu oturumda yaşandı / bilinmesi gereken)

- SofaScore global id → dual oyuncular zaten köprülü; onlar için isim-eşleştirme YENİDEN kurma.
- Map builder her cron'da truncate+insert → genişletilmiş builder deploy'da kalmalı yoksa map döner.
- Bridge opta-kazanır tiebreak → Faz 2b'nin ANA riski (yukarı bak, (c) çözümü).
- Mat tazeleme sırası: profil mat ÖNCE, match-log mat SONRA (slug_map bağımlılığı).
- Kupa Players LİSTESİ `cupPlayerProfile.ts` loader'larını kullanır → silmeden kullanım çıkar.
- `ref.team_mapping` küratör (yabancı takım yok) → takım birleştirme yabancıda sınırlı.
- Map builder `--dry` flag'i ÇALIŞMADI (script "dry"de commit etti); gerçek DRY env değişkenini
  kontrol et (script başındaki DRY tanımına bak) yoksa test yazar.
- pg_get_viewdef `like`'ı `~~` render eder; string-replace'te buna dikkat.
- Başka bir oturum aynı repoda Bets10 proxy işi yapıyor olabilir (commit'ler karışmasın; farklı dosyalar).

## KİLİT DOSYALAR (agent önce bunları okusun)

- `frontend/app/dashboard/stats-analysis/football/player-stats/detail/page.tsx` + `features/player-detail/server/*`
- `sql/2026-08-15_player_profile_sofascore_bridge.sql`, `..._current_info_sofascore_bridge.sql`,
  `..._match_log_sofascore_bridge.sql` (match-log zaten genişletildi)
- `pipeline/src/football/build_sofascore_opta_player_map.py` (Faz 1 genişletildi)
- `frontend/features/tsl/leagues.ts` (playerHrefFor/teamHrefFor/playerBase/teamBase)
- `frontend/features/tsl/server/cupPlayerProfile.ts` (kaldırılacak/ayrılacak loader'lar + liste loader'ları)
- `frontend/features/tsl/resmi/EuroCupPlayerDetail.tsx` / `EuroCupTeamDetail.tsx` / `CupCrossLeagueToggle.tsx` (kaldırılacak)
- `frontend/app/dashboard/stats-analysis/football/team-stats/detail/*` + `features/team-detail/server/getTeamProfile.ts`
- Memory: `euro-cups-integration` + bu dosya.
