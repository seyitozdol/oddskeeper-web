# OddsKeeper — Advanced Metrics Backbone Plan

## Neden bu belge var

Şu anki ürün durumu şunu gösteriyor:

- entity navigation çalışıyor
- team / player / match detail ekranları açılıyor
- temel summary yüzeyleri var
- ama ürün henüz premium analytics product seviyesinde değil

Sert ürün filtresi bundan sonra sabit:

**"Çalışıyor olması yetmez; ticari olarak ikna edici, premium hissi veren, ürün değeri görünür, müşteri karşısında savunulabilir olmalı."**

Bu yüzden bundan sonraki ana iş küçük UI cilaları değil, **analytics backbone** kurmaktır.

---

## Ana teşhis

Bugüne kadar yapılan işler boşa gitmedi. Bunlar gerekli iskeletti:

- team → team entity geçişi
- squad → player entity geçişi
- team / player → match entity geçişi
- team detail / player detail / match detail modüler page yapısı
- temel overview / results / fixtures / lineups / incidents / team-stats panelleri

Ama bugün hâlâ eksik olan ana şey şudur:

**ürünün analitik omurgası yok.**

Yani:

- türetilmiş metrik katmanı eksik
- benchmark katmanı eksik
- team rank / league rank eksik
- league average comparison eksik
- role-aware oyuncu değerlendirme mantığı eksik
- raw data var, ama ürün anlatısı zayıf

Kısa ve acımasız özet:

**Şu anki ürün navigasyonu olan bir veri gezgini. Premium analytics product değil.**

---

## Bundan sonra sabit prensipler

### 1) Opta / scraped metrikleri kaybetmiyoruz
Pts hariç, scrape ettiğimiz veya normalize ettiğimiz bütün metrikler veri katmanında değerlendirilecek.

### 2) Hepsini aynı ekrana basmıyoruz
Veri katmanında tüm metrikleri alacağız.
Ama premium ürün mantığında bunları:

- kategorileyeceğiz
- benchmark edeceğiz
- role-aware göstereceğiz
- doğru ekrana koyacağız

### 3) UI çöplüğüne dönmüyoruz
"Elimizde veri var, hepsini overview'e basalım" yaklaşımı yanlış.

Doğru yaklaşım:

- overview = karar verdiren az ama güçlü metrik
- detailed tabs = tam metrik yüzeyi
- compare / benchmark = ileri yorum katmanı

### 4) Önce metric architecture, sonra premium polish
Bu aşamada ana iş:

- metric catalog
- analytic views
- ranking / benchmark / split yapıları
- sonra ekranları premium seviyeye çekmek

---

# 1) Player Advanced Metrics Backbone

## 1.1 Player için ham metrik grupları

### Identity / Usage
- appearances
- starts
- sub_appearances
- starter_rate_pct
- total_minutes
- avg_minutes

### Output
- goals
- assists
- expected_goals
- penalties_won
- own_goals

### Shooting
- shots_on_target
- shots_off_target
- shots_blocked
- attempts_ibox
- attempts_obox
- headed_shots
- hit_woodwork

### Passing / Distribution
- passes
- accurate_pass
- crosses
- fantasy_assist

### Defensive
- tackles
- interceptions
- fouls_conceded
- fouls_won

### Discipline / Events
- offsides
- cards_yellow
- cards_red

### Goalkeeper
- saves_total
- penalties_saved
- goals_conceded
- goal_kicks
- total_throws

### Goal type splits
- out_of_box_goals
- right_foot_goals
- left_foot_goals
- headed_goals
- penalty_goals
- freekick_goals

---

## 1.2 Player için analytic türevler

Ham veri tek başına yetmez. Oyuncu metric backbone içinde mümkün olan her ana metrik için şu türevler hedeflenmeli:

- metric_total
- metric_per_match
- metric_per90
- metric_home_per_match
- metric_away_per_match
- metric_last5_total
- metric_last5_per_match
- metric_team_rank
- metric_league_rank
- metric_team_percentile
- metric_league_percentile
- metric_vs_league_avg_abs
- metric_vs_league_avg_pct
- above_league_avg_flag

---

## 1.3 Role-aware player mantığı

Tüm oyuncular aynı metrik yüzeyiyle sunulmayacak.

### Goalkeeper
Öncelikli metrikler:
- saves_total
- goals_conceded
- penalties_saved
- goal_kicks
- total_throws

### Defender
Öncelikli metrikler:
- tackles
- interceptions
- accurate_pass
- passes
- headed_shots / headed_goals (varsa)
- fouls_conceded
- cards

### Midfielder
Öncelikli metrikler:
- passes
- accurate_pass
- crosses
- assists
- fantasy_assist
- tackles
- interceptions
- xG / shot involvement

### Forward
Öncelikli metrikler:
- goals
- assists
- expected_goals
- shots_on_target
- shots_off_target
- attempts_ibox
- attempts_obox
- hit_woodwork

Not:
Role-aware mantıkta tüm metrikler sistemde kalır, ama ekranın önceliklendirmesi role göre değişir.

---

# 2) Team Advanced Metrics Backbone

## 2.1 Team için ham metrik grupları

### Base output
- goals
- assists
- red_cards
- yellow_cards

### Shooting
- shots
- shots_on_target
- blocked_shots
- attempts_ibox
- attempts_obox
- expected_goals
- headed_shots
- hit_woodwork

### Possession / Build-up / Passing
- passes
- accurate_pass
- crosses

### Defensive / Off-ball
- tackles
- interceptions
- fouls_conceded
- fouls_won
- offsides

### Set piece / keeper / restart
- corners_won
- saves
- goal_kicks
- total_throws
- penalties_saved

### Goal composition
- out_of_box_goals
- right_foot_goals
- left_foot_goals
- headed_goals
- penalty_goals
- freekick_goals

---

## 2.2 Team için analytic türevler

Takım düzeyinde hedef türevler:

- metric_total
- metric_per_match
- metric_home_total
- metric_home_per_match
- metric_away_total
- metric_away_per_match
- metric_last5_total
- metric_last5_per_match
- metric_league_avg
- metric_league_median
- metric_league_rank
- metric_league_percentile
- metric_vs_league_avg_abs
- metric_vs_league_avg_pct
- above_league_avg_flag

---

# 3) Benchmark Backbone

Premium ürünün ana değeri sadece toplam sayı göstermek değil, bu sayının bağlamını vermektir.

Bu yüzden merkezi benchmark katmanı kurulmalı.

## 3.1 Gerekli benchmark yüzeyleri
- league average
- league median
- league rank
- league percentile
- team-internal rank
- above / below average flag
- absolute delta
- percentage delta

## 3.2 Sunum örnekleri
Bu backbone kurulduğunda ürün şunları söyleyebilir:

- "Bu oyuncu tackles per match metrikinde takım içinde 2., lig genelinde 14."
- "Bu takım home xG üretiminde lig ortalamasının %18 üstünde."
- "Oyuncu son 5 maçta ortalama dakika açısından sezon ortalamasının altında."
- "Takım away şut hacminde güçlü ama SoT conversion'da lig ortalamasının altında."

İşte müşteri para buna verir.

---

# 4) UI seviyesinde doğru gösterim prensibi

## 4.1 Overview ekranları
Overview ekranı şu sorulara cevap vermeli:

### Player overview
- Bu oyuncu ne kadar kullanılıyor?
- Son dönemde formu nasıl?
- Rolüne göre ana etkisi ne?
- Takım ve lig bağlamında güçlü olduğu alan ne?

### Team overview
- Bu takımın temel oyun profili ne?
- Lig ortalamasına göre nerede üstün / zayıf?
- Home / away farkı ne?
- Son dönem formu yapısal mı, tesadüfi mi?

## 4.2 Detailed tabs
Aşağıdaki metrikler detailed tabs altında kategorili sunulmalı:

### Player detailed categories
- Shooting
- Passing
- Defensive
- Discipline
- Goalkeeper
- Goal Type Splits
- Benchmarks / Ranks

### Team detailed categories
- Attack
- Defence
- Build-up / Passing
- Discipline
- Set Pieces / Restart
- Goal Composition
- Benchmarks / Splits

---

# 5) Mevcut ürün açısından kesin karar

Bu aşamada yanlış olan şey:

- incidents rengini tartışmaya devam etmek
- padding / küçük UI polish'e takılmak
- overview ekranlarına yeni küçük kutular eklemek

Bu aşamada doğru olan şey:

**analytics backbone kurmak.**

---

# 6) Uygulama sırası

## Faz 1 — Player advanced metrics views
Önce oyuncu katmanı:
- player advanced totals
- player per-match / per90
- player team rank
- player league rank
- player vs league average
- role-aware grouping

## Faz 2 — Team advanced metrics views
Sonra takım katmanı:
- overall / home / away
- per match averages
- league average / median
- rank / percentile
- attack / defence / passing / discipline grouping

## Faz 3 — Metric registry
Merkezi metric catalog:
- metric_name
- entity_type (player/team)
- category
- role_scope
- display_priority
- overview_allowed
- detailed_allowed
- benchmark_allowed

## Faz 4 — Premium surface rebuild
Backbone hazır olduktan sonra:
- player detail premium pass
- team detail premium pass
- match detail premium pass

---

# 7) Geçici ama kritik ürün kararı

Şu anki çalışan ekranları bozmayacağız.

Plan şu:
1. eksik ana analytic backbone'u kur
2. kalan ana yapıları tamamla
3. sonra geri dönüp zayıf / yarım kalan ekranları premium seviyeye yükselt

Yani mevcut ekranlar interim yüzeydir.
Son hedef değildir.

---

# 8) Son ürün filtresi

Bundan sonra her karar şu filtreden geçecek:

- Bu ekran müşteriye neden para ödetiyor?
- İlk bakışta ne değer anlatıyor?
- Ham veri mi gösteriyor, yoksa karar verdiren bağlam mı sunuyor?
- Premium hissi veriyor mu?
- Müşteri karşısında savunulabilir mi?

Bu sorulara güçlü cevap veremeyen her şey ikinci sınıf iştir.
