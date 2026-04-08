# OddsKeeper Team Detail Mimarisi ve Faz Planı

## Amaç

Football Team Detail sayfasını, Supabase üzerindeki mevcut maç/veri tablolarını bozmadan, sürdürülebilir ve ekran-bazlı bir mimariyle kurmak.

Bu dokümanın hedefi:
- takım detay ekranı için veri mimarisini netleştirmek
- eksik referans katmanlarını tanımlamak
- tablo şemalarını çıkarmak
- geliştirme fazlarını sıraya koymak

---

## Ana Mimari Karar

Frontend, ham football tablolarını doğrudan tanımamalı.

Doğru yaklaşım:

1. **Referans / mapping katmanı**
2. **Takım profil katmanı**
3. **Fixture katmanı**
4. **Ekran-bazlı view / service katmanı**
5. **Frontend panel bileşenleri**

Yanlış yaklaşım:
- frontend’den farklı tablarda doğrudan `football.matches`, `football.match_team_stats`, `football.match_player_stats_details` gibi tablolara dağınık sorgular atmak

Bu kısa vadede çalışır gibi görünür ama sayfa büyüdükçe yönetilemez hale gelir.

---

## Mevcut Kaynak Tablolar

Bunlar mevcut veri kaynağı olarak kullanılacak alt katman tablolardır:

- `football.matches`
- `football.match_team_stats`
- `football.match_player_stats_details`
- `football.match_player_stats_opta_points`
- `football.match_incidents`

Bu tablolar frontend’e doğrudan açılmamalı. Bunlardan ekran-bazlı veri üretilecek.

---

## Yeni Önerilen Tablolar

## 1) `ref.team_mapping`

### Amaç
UI tarafındaki takım seçimini, veritabanındaki gerçek takım anahtarına bağlamak.

### Neden gerekli
Şu an UI tarafında takım seçimi `team_slug` ile yapılıyor.  
Ama Supabase tarafındaki veri büyük ihtimalle `team_bk`, `canonical_team_name`, `source_team_id` gibi başka alanlarla tutuluyor.

Bu tablo olmadan:
- aynı takım için farklı string aramaları başlar
- tab bazlı sorgular dağılır
- sistem kırılgan olur

### Önerilen kolonlar

| Kolon | Tip | Açıklama |
|---|---|---|
| `team_mapping_id` | `bigserial` | PK |
| `team_slug` | `text` | UI tarafında kullanılan slug, ör. `eyupspor` |
| `display_name` | `text` | Ekranda gösterilecek isim |
| `canonical_team_name` | `text` | Veri tarafında kullanılacak ana takım adı |
| `team_bk` | `text` | Ana takım business key |
| `competition_bk` | `text` | Lig/competition business key |
| `season_bk` | `text` | Opsiyonel, sezon bazlı mapping ihtiyacı için |
| `logo_path` | `text` | Logo yolu |
| `is_active` | `boolean` | Aktif takım mı |
| `created_at` | `timestamptz` | Kayıt zamanı |
| `updated_at` | `timestamptz` | Güncelleme zamanı |

### Önerilen kısıtlar
- PK: `team_mapping_id`
- UNIQUE: `team_slug`
- INDEX: `(team_bk)`
- INDEX: `(canonical_team_name)`
- INDEX: `(competition_bk, season_bk)`

### Not
İlk versiyonda `team_slug` -> `team_bk` eşlemesi kurmak yeterli.  
Ama ileri aşamada sezon/competition bazlı mapping ihtiyacı gelebilir. Bu yüzden `competition_bk` ve `season_bk` koymak doğru olur.

---

## 2) `ref.team_profiles`

### Amaç
Takım detay ekranının üst kısmındaki yavaş değişen takım bilgilerini tutmak.

### Neden gerekli
Aşağıdaki alanlar maç tablosundan güvenilir şekilde üretilemez:
- founded year
- website
- stadium
- capacity
- market value
- head coach

Bunları ayrı bir takım profil tablosunda tutmak gerekir.

### Önerilen kolonlar

| Kolon | Tip | Açıklama |
|---|---|---|
| `team_profile_id` | `bigserial` | PK |
| `team_bk` | `text` | Takım business key |
| `canonical_team_name` | `text` | Ana takım adı |
| `founded_year` | `integer` | Kuruluş yılı |
| `stadium_name` | `text` | Stadyum adı |
| `website_url` | `text` | Resmi web sitesi |
| `capacity` | `integer` | Stadyum kapasitesi |
| `head_coach` | `text` | Teknik direktör |
| `market_value` | `numeric(18,2)` | Piyasa değeri |
| `market_value_currency` | `text` | Para birimi, ör. `EUR` |
| `logo_path` | `text` | Logo yolu |
| `is_active` | `boolean` | Aktif mi |
| `source_name` | `text` | Profil verisi kaynağı |
| `last_verified_at` | `timestamptz` | Son doğrulama zamanı |
| `created_at` | `timestamptz` | Kayıt zamanı |
| `updated_at` | `timestamptz` | Güncelleme zamanı |

### Önerilen kısıtlar
- PK: `team_profile_id`
- UNIQUE: `team_bk`
- INDEX: `(canonical_team_name)`

### Not
İlk aşamada `head_coach` ve `market_value` boş geçilebilir.  
Şema yine de şimdiden buna uygun kurulmalı.

---

## 3) `football.fixtures`

### Amaç
Gelecek maçları ve planlanan fikstürü ayrı tabloda tutmak.

### Neden gerekli
Şu an `football.matches` içinde fixture yok.  
Bu yüzden fixture tab için ayrı bir tablo kurmak mantıklı.

### Önerilen kolonlar

| Kolon | Tip | Açıklama |
|---|---|---|
| `fixture_id` | `bigserial` | PK |
| `source` | `text` | Veri kaynağı |
| `source_fixture_id` | `text` | Kaynak fixture id |
| `competition_bk` | `text` | Lig business key |
| `season_bk` | `text` | Sezon business key |
| `round_label` | `text` | Hafta / tur |
| `fixture_datetime` | `timestamptz` | Maç başlangıç zamanı |
| `match_date` | `date` | Tarih |
| `home_team_bk` | `text` | Ev sahibi takım bk |
| `away_team_bk` | `text` | Deplasman takım bk |
| `venue_name` | `text` | Stadyum / venue |
| `status` | `text` | scheduled, postponed, cancelled, completed vb. |
| `created_at` | `timestamptz` | Kayıt zamanı |
| `updated_at` | `timestamptz` | Güncelleme zamanı |

### Önerilen kısıtlar
- PK: `fixture_id`
- UNIQUE: `(source, source_fixture_id)`  
  veya source yoksa mantıklı alternatif unique key
- INDEX: `(competition_bk, season_bk, fixture_datetime)`
- INDEX: `(home_team_bk, fixture_datetime)`
- INDEX: `(away_team_bk, fixture_datetime)`
- INDEX: `(status)`

### Not
Bu tablo takım ekranı dışında genel fixture ekranı için de kullanılabilir.  
O yüzden takım-bazlı değil, maç-bazlı kurulmalı.

---

## Ekran Bazlı View / Service Katmanı

Frontend, doğrudan ham tablolara gitmemeli.  
Bunun yerine aşağıdaki ekran-bazlı veri katmanı oluşturulmalı.

### Önerilen isimler

- `team_header`
- `team_results`
- `team_statistics`
- `team_squad`
- `team_fixtures`

Bu isimler SQL view, RPC, backend service veya typed query function olabilir.

---

## Tab Bazlı Veri Planı

## A) Team Statistics

### Kaynak tablolar
- `football.matches`
- `football.match_team_stats`

### Amaç
Sezon ve form bazlı takım özetini göstermek.

### Önerilen içerik
- played
- wins
- draws
- losses
- goals for
- goals against
- points
- home record
- away record
- last 5 form
- maç başına ortalamalar
- gerekiyorsa trend metrikleri

### Not
Bu tab ham maç satırı değil, aggregate veri ister.

---

## B) Squad

### Kaynak tablolar
- `football.match_player_stats_details`
- `football.match_player_stats_opta_points`

### Amaç
Takıma ait oyuncu / participants katmanını göstermek.

### Önemli not
Bu katman tam resmi kadro olmayabilir.  
Senin mevcut veri mimarinde daha çok **participants / player usage layer** var.

### Önerilen içerik
- player_name
- position
- appearances
- starts
- minutes
- goals
- assists
- opta_points_avg
- last_match_date

---

## C) Results

### Kaynak tablolar
- `football.matches`

### Amaç
Takımın geçmiş maçlarını ve sonuçlarını göstermek.

### Önerilen içerik
- date
- opponent
- home/away
- score
- result (W/D/L)
- round

### Not
İlk yapılması gereken tab budur. En hızlı doğrulanır.

---

## D) Fixture

### Kaynak tablolar
- `football.fixtures`

### Amaç
Takımın gelecek maçlarını göstermek.

### Önerilen içerik
- date
- opponent
- home/away
- venue
- round
- status

---

## Frontend Bileşen Yapısı

Team detail sayfası tek büyük dosya olmamalı.

### Önerilen bileşenler
- `TeamDetailHeader`
- `TeamStatisticsPanel`
- `SquadPanel`
- `ResultsPanel`
- `FixturesPanel`

### Önerilen mantık
- Header yalnızca seçili takım bağlamını ve tab kontrolünü tutar
- Her panel kendi veri fonksiyonu ile beslenir
- Alt alan tab’a göre değişir

---

## Geliştirme Fazları

## Faz 1 — Team Mapping
Kurulacak:
- `ref.team_mapping`

Hedef:
- `team_slug -> team_bk` eşleşmesini oturtmak

Teslim:
- UI tarafındaki seçili takım güvenilir şekilde veri tarafına bağlanır

---

## Faz 2 — Team Profiles
Kurulacak:
- `ref.team_profiles`

Hedef:
- header alanındaki statik / yavaş değişen takım bilgilerini tutmak

Teslim:
- detail header gerçek veriyle dolabilir

---

## Faz 3 — Results Veri Katmanı
Kurulacak:
- `team_results` view/service

Hedef:
- seçili takımın geçmiş maç sonuçlarını getirmek

Teslim:
- Results tab ilk canlı çalışan tab olur

---

## Faz 4 — Team Statistics Veri Katmanı
Kurulacak:
- `team_statistics` view/service

Hedef:
- sezonluk ve form bazlı takım aggregate metriklerini üretmek

Teslim:
- Team Statistics tab anlamlı hale gelir

---

## Faz 5 — Squad Veri Katmanı
Kurulacak:
- `team_squad` view/service

Hedef:
- participants / oyuncu kullanım katmanını tablo halinde üretmek

Teslim:
- Squad tab çalışır

---

## Faz 6 — Fixtures
Kurulacak:
- `football.fixtures`
- `team_fixtures` view/service

Hedef:
- gelecek maçları göstermek

Teslim:
- Fixture tab çalışır

---

## Başlangıç İçin En Doğru Yol

İlk teknik sıra şu olmalı:

1. `ref.team_mapping`
2. `ref.team_profiles`
3. Results tab veri akışı
4. Team Statistics tab veri akışı
5. Squad tab veri akışı
6. Fixture tab veri akışı

Bu sırayı bozmak gereksiz karmaşa üretir.

---

## Son Karar

Şu an ilk yapılması gereken kod değil, şunları kurmaktır:

- `ref.team_mapping`
- `ref.team_profiles`
- `football.fixtures`

Bunlar kurulduktan sonra tab bazlı sorgu ve UI bağlama çok daha temiz ilerler.
