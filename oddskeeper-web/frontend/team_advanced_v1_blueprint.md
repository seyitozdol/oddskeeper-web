# Team Advanced v1 Blueprint

## Amaç
`Team Advanced` ekranını ham veri tekrarından çıkarıp, **rule-based executive intelligence layer** haline getirmek.

Temel ayrım:

- **Detailed Stats = veri motoru**
- **Advanced = karar motoru**

Bu ekran aynı metrikleri tekrar etmemeli.  
Var olan metriklerden **yorumlanmış, explainable, aksiyon alınabilir** sonuç üretmeli.

---

## Mevcut Problem
Şu anki Advanced ekranın zayıf tarafları:

- Jenerik etiketler: `High-volume attack`, `Stable defence`, `Negative shift`
- Ürünsel çelişki: `rank 2` olan şeyin `weakness` diye çıkabilmesi
- Ham key kullanımı: `team_shots` gibi teknik alan adları
- Detailed Stats'ten farklı, yeni karar değeri üretmemesi

Hedef:
- explainable
- rule-based
- premium
- customer-facing
- confidence veren

---

## Ekran Yapısı

### 1) Identity Strip
Üstte 4 kart:

- Attack Identity
- Defensive Identity
- Build-up Identity
- Current Form State

Her kart:
- 1 başlık
- 1 kısa açıklama
- 1 neden satırı

Örnek:
- **Attack Identity:** High-volume chance creator
- `Driven by Shots #3, SoT #2, xG +42.6%`

---

### 2) Highlight Cards
İkinci sırada 4 kart:

- Primary Strength
- Primary Risk
- Biggest Positive Trend
- Biggest Split Signal

Bunlar doğrudan metrik seçer ama seçme kuralları sıkı olmalı.

---

### 3) Action Layer
Alt bölüm:

- League Positioning
- Last 5 vs Season
- Actionable Takeaways

Burada ekran “so what?” cevabını verir.

---

## Rule Catalog v1

## Kritik Not
Rule catalog sabit kod içine gömülmemeli.  
Sonradan değiştirilebilir / update edilebilir bir yönetim alanı olmalı.

### Önerilen yönetim katmanı
Ayrı bir config kaynağı kurulsun:

- ya DB tablosu
- ya ayrı JSON/TS config dosyası
- tercihen DB tablosu + admin/edit mantığı

### Önerilen tablo adı
`analytics.team_advanced_rule_catalog`

### Önerilen kolonlar
- `metric_key`
- `metric_label`
- `display_group`
- `identity_group`
- `direction`
- `include_in_strength_risk`
- `include_in_split`
- `include_in_form`
- `weight_attack`
- `weight_defence`
- `weight_build_up`
- `priority_strength`
- `priority_risk`
- `is_active`
- `notes`

### Neden gerekli
Çünkü yarın:
- ağırlık değişebilir
- bazı metrikler çıkarılabilir
- yeni metrikler eklenebilir
- bir metriğin `strength` seçiminde kullanılmasını kapatmak gerekebilir

Yani rule catalog **updateable** olmalı.

---

## Metric Grouping

### Attack
- goals_for
- expected_goals
- shots
- shots_on_target
- shot_accuracy_pct
- xg_per_shot
- offsides

### Defence
- goals_against
- shots_against
- shots_on_target_against
- tackles
- interceptions
- fouls_conceded

### Build Up
- passes
- accurate_passes
- pass_accuracy_pct

### Discipline
- yellow_cards
- red_cards

---

## Normalize Mantığı

Tüm kararlar ham rank yerine **normalized score** üzerinden konuşmalı.

### Hedef
Tüm metrikleri 0-100 bandına taşımak.

### Önerilen formül
`normalized_score = ((league_size - adjusted_rank) / (league_size - 1)) * 100`

Amaç:
- iyi sonuç = yüksek skor
- kötü sonuç = düşük skor

### Ek güven filtresi
Sadece rank yetmez.

`abs(vs_avg_pct) >= 5%` değilse güçlü anlatı üretme.

Bu sayede küçük farkları “insight” diye satmamış oluruz.

---

## Composite Scores

### Attack Composite
Önerilen ağırlıklar:
- goals_for → 0.22
- expected_goals → 0.22
- shots → 0.16
- shots_on_target → 0.18
- shot_accuracy_pct → 0.12
- xg_per_shot → 0.10

Not:
- `offsides` ilk sürümde composite'e direkt sokulmasın
- risk katmanında ayrıca değerlendirilsin

### Defence Composite
- goals_against → 0.30
- shots_against → 0.18
- shots_on_target_against → 0.18
- tackles → 0.12
- interceptions → 0.12
- fouls_conceded → 0.10

### Build-up Composite
- passes → 0.35
- accurate_passes → 0.35
- pass_accuracy_pct → 0.30

---

## Identity Rules

### Attack Identity

#### High-volume chance creator
Aşağıdakilerden en az 3 tanesi güçlü ise:
- shots score >= 70
- shots_on_target score >= 70
- expected_goals score >= 70
- goals_for score >= 65

#### Efficient finisher
- shot_accuracy_pct >= 70
- xg_per_shot >= 70
- goals_for >= 65

#### Volume over efficiency
- shots >= 70
- ama shot_accuracy_pct < 50
  veya xg_per_shot < 50

#### Blunt attack
- shots < 45
- shots_on_target < 45
- expected_goals < 45

---

### Defensive Identity

#### Stable defence
- goals_against >= 65
- shots_against >= 60
- shots_on_target_against >= 60

#### Active defensive team
- tackles >= 65
- interceptions >= 65
- ama concession metrikleri orta seviye olabilir

#### Fragile defence
- goals_against < 40
- shots_against < 40
- shots_on_target_against < 40

#### Aggressive but leaky
- tackles/interceptions yüksek
- ama goals_against zayıf

---

### Build-up Identity

#### Controlled circulation
- passes >= 65
- accurate_passes >= 65
- pass_accuracy_pct >= 65

#### High-volume build-up
- pass volume yüksek
- accuracy orta

#### Low-control progression
- pass_accuracy_pct düşük
- accurate_passes düşük

#### Direct / low-possession
- pass volume düşük
- attack metrikleri orta veya güçlü

---

## Current Form State

### Kullanılacak alanlar
- points_per_game
- goals_for_per_game
- goals_against_per_game
- mümkünse son 5 xG / SoT daha sonra eklenebilir

### Kural

#### Improving
- last_5_points_per_game > season_ppg + 0.20
veya
- last_5_gf_per_game season ortalamasının %10 üstünde

#### Declining
- last_5_points_per_game < season_ppg - 0.20
veya
- last_5_ga_per_game season ortalamasının %10 üstünde

#### Stable
- diğer durumlar

### Çıktı
- Improving
- Stable
- Negative shift

---

## Strength / Risk Rules

### Primary Strength
Bir metrik strength olabilir ancak:
- normalized_score >= 70
- abs(vs_avg_pct) >= 5
- whitelist içinde olmalı

#### Öncelik sırası
1. normalized_score
2. vs_avg_pct
3. iş değeri

#### İş değeri yüksek metrikler
- expected_goals
- shots_on_target
- goals_for
- pass_accuracy_pct
- goals_against
- shots_against

---

### Primary Risk
Bir metrik risk olabilir ancak:
- normalized_score <= 30
- abs(vs_avg_pct) >= 5
- whitelist içinde olmalı

#### Risk whitelist
- offsides
- goals_against
- shots_against
- shots_on_target_against
- fouls_conceded
- pass_accuracy_pct
- shot_accuracy_pct
- red_cards
- yellow_cards

#### Yasak kurallar
- rank <= 4 ise risk olamaz
- explainable olmayan metrik riskte kullanılmaz

---

## Biggest Positive Trend
Son 5 vs season kıyası içinden seçilir.

### İlk sürüm adayları
- points per game
- goals for per game
- goals against per game
- recent form delta

### Çıktı örneği
- `Biggest Positive Trend: Points`
- `Last 5 PPG +0.31 above season pace`

---

## Biggest Split Signal

### Aday split metrikleri
- shots
- shots_on_target
- expected_goals
- pass_accuracy_pct
- passes
- goals_against
- offsides

### Kural
- abs(home - away) en yüksek olan
- sadece whitelist içinden
- raw key yerine product label kullanılmalı

### Çıktı örneği
- `Biggest Split Signal: Passing Volume`
- `Home 454.2 • Away 404.6 • Gap +49.6`

---

## League Positioning

3 mini kart:
- Attack Tier
- Defence Tier
- Build-up Tier

### Tier mapping
- 80+ → Elite
- 65–79 → Upper Tier
- 50–64 → Mid Tier
- 35–49 → Below Average
- <35 → Weak

Bu kartlar yönetici seviyesinde hızlı konumlandırma sağlar.

---

## Actionable Takeaways

3 kısa insight:

- Coaching takeaway
- Opponent prep note
- Recruitment implication

### Örnek template mantığı
- Attack güçlü ama offsides kötü ise:
  `Chance creation is strong, but final-third timing is wasteful.`

- Home / away split yüksekse:
  `Build-up quality drops materially away from home.`

- Defence zayıf, top kazanma metrikleri orta ise:
  `Defensive floor may require stronger ball-winning support.`

Bu alanlar template-driven ve explainable olmalı.

---

## UI Layout

### Üst sıra
- Attack Identity
- Defensive Identity
- Build-up Identity
- Current Form State

### Orta sıra
- Primary Strength
- Primary Risk
- Biggest Positive Trend
- Biggest Split Signal

### Alt sıra
- Attack Tier / Defence Tier / Build-up Tier
- Last 5 vs Season
- Actionable Takeaways

---

## Teknik Çıktı Şekli

Önerilen backend summary modeli:

```ts
type TeamAdvancedSummary = {
  identity: {
    attack: { label: string; reason: string }
    defence: { label: string; reason: string }
    buildUp: { label: string; reason: string }
    form: { label: string; reason: string }
  }
  highlightCards: {
    strength: Card
    risk: Card
    trend: Card
    split: Card
  }
  positioning: {
    attackTier: string
    defenceTier: string
    buildUpTier: string
  }
  takeaways: {
    coaching: string
    opponentPrep: string
    recruitment: string
  }
}
```

---

## Red Lines

Advanced ekranında bunlar olmamalı:
- raw field adı (`team_shots`)
- rank 2 olan metriği weakness diye göstermek
- Detailed Stats'in tekrarına düşmek
- açıklamasız jenerik etiket
- tek metrike bakarak büyük ürün cümlesi kurmak

---

## Uygulama Sırası

### Faz 1
Rule catalog v1 oluştur
- updateable olsun
- tek source olsun

### Faz 2
Team Advanced summary hesap motorunu kur
- backend mapper veya view
- explainable output

### Faz 3
UI ekranını yeni layout ile değiştir

### Faz 4
Polish
- yazı dili
- tooltip
- renkler
- confidence / severity görünümü

---

## Net Ürün Kararı

`Detailed Stats` veri ekranı olarak kalmalı.  
`Advanced` ise **yönetici / analist karar ekranı** olmalı.

Bu blueprint uygulanırsa:
- ekran premium hissi verir
- tekrar hissi azalır
- müşteriye neden-sonuç ilişkisi sunar
- explainable olur

Bu blueprint uygulanmazsa:
- `Advanced` ekranı hep yarım ve düşük değerli kalır
