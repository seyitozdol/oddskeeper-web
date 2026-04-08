# OddsKeeper Team Statistics v1 - Mimari Notlar

## Amaç

Team Statistics sekmesini, kısa vadede sade ama uzun vadede büyüyebilir şekilde kurmak.

Bu yapı şu ihtiyaçlara hazır olmalı:
- tek takım detay ekranı
- sezon büyümesi
- ileride takım kıyaslama (compare)
- ileride detaylı takım metrikleri için ayrı sekme

---

## Temel Karar

Team Statistics v1 için tek bir view kullanmak doğru değil.

Çünkü aynı anda üç farklı veri granularity'si var:

1. sezon özeti
2. home/away split
3. recent form

Bunları tek view içine tıkıştırmak:
- frontend'i kirletir
- compare yapısını zorlaştırır
- bakımı kötüleştirir

Bu yüzden Team Statistics v1 için üç ayrı veri katmanı kurulmalı:

- `analytics.team_statistics_summary_v1`
- `analytics.team_statistics_split_v1`
- `analytics.team_recent_form_v1`

---

## Kritik Ön Şart: Season

Şu an `football.matches` içinde season alanı görünmüyor.

Bu haliyle team statistics uzun vadede sağlıklı kurulmaz.  
Bugün tek sezon olsa da yarın ikinci sezon geldiğinde aggregate mantık bozulur.

### Net karar
`football.matches` içine bir sezon alanı eklenmeli.

### Öneri alan adı
- `season_label`

### Örnek değer
- `2025/2026`

---

## Veri Kimliği

Bu üç view'ın da ana grain mantığı şu olmalı:

- `team_slug`
- `team_source_id`
- `competition`
- `season_label`

Bu 4 alan temel kimliktir.

---

# 1) analytics.team_statistics_summary_v1

## Amaç
Takımın sezon genel özetini tek satırda vermek.

## Grain
Her satır:
- 1 takım
- 1 competition
- 1 season

## Kolonlar

| Kolon | Açıklama |
|---|---|
| `team_slug` | UI takım slug |
| `team_source_id` | Gerçek takım anahtarı |
| `team_name` | Takım adı |
| `competition` | Örn. Süper Lig |
| `season_label` | Örn. 2025/2026 |
| `played` | Toplam maç |
| `wins` | Galibiyet |
| `draws` | Beraberlik |
| `losses` | Mağlubiyet |
| `goals_for` | Atılan gol |
| `goals_against` | Yenilen gol |
| `goal_difference` | GF - GA |
| `points` | 3*W + D |
| `win_rate_pct` | Win rate yüzdesi |
| `points_per_game` | Maç başına puan |
| `goals_for_per_game` | Maç başına atılan gol |
| `goals_against_per_game` | Maç başına yenilen gol |
| `latest_match_datetime` | Son maç tarihi |

## Formül kuralları

- `played = wins + draws + losses`
- `goal_difference = goals_for - goals_against`
- `points = wins * 3 + draws`
- `win_rate_pct = wins::numeric / played * 100`
- `points_per_game = points::numeric / played`
- `goals_for_per_game = goals_for::numeric / played`
- `goals_against_per_game = goals_against::numeric / played`

## UI'de kullanım
Bu view şu KPI kartlarını besler:

- Played
- Points
- Wins
- Draws
- Losses
- Goal Difference
- Goals For
- Goals Against
- Win Rate
- Points Per Game

---

# 2) analytics.team_statistics_split_v1

## Amaç
Takımın overall / home / away performansını ayrı ayrı göstermek.

## Grain
Her satır:
- 1 takım
- 1 competition
- 1 season
- 1 split

## Kolonlar

| Kolon | Açıklama |
|---|---|
| `team_slug` | UI takım slug |
| `team_source_id` | Gerçek takım anahtarı |
| `team_name` | Takım adı |
| `competition` | Competition |
| `season_label` | Sezon |
| `split_key` | `overall`, `home`, `away` |
| `split_label` | `Overall`, `Home`, `Away` |
| `sort_order` | UI sırası için 1/2/3 |
| `played` | Maç |
| `wins` | Galibiyet |
| `draws` | Beraberlik |
| `losses` | Mağlubiyet |
| `goals_for` | Atılan gol |
| `goals_against` | Yenilen gol |
| `goal_difference` | GF - GA |
| `points` | Puan |
| `points_per_game` | PPG |
| `win_rate_pct` | Win rate yüzdesi |

## UI'de kullanım
Bu view şu split tablosunu besler:

| Split | Played | W | D | L | GF | GA | GD | PTS | PPG |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Overall |  |  |  |  |  |  |  |  |  |
| Home |  |  |  |  |  |  |  |  |  |
| Away |  |  |  |  |  |  |  |  |  |

---

# 3) analytics.team_recent_form_v1

## Amaç
Takımın son 5 maçlık formunu göstermek.

## Grain
Her satır:
- 1 takım
- 1 competition
- 1 season
- 1 recent match

Bu view normalize kalmalı. JSON/array yapısına gerek yok.

## Kolonlar

| Kolon | Açıklama |
|---|---|
| `team_slug` | UI takım slug |
| `team_source_id` | Gerçek takım anahtarı |
| `team_name` | Takım adı |
| `competition` | Competition |
| `season_label` | Sezon |
| `recent_rank` | 1..5 |
| `match_datetime` | Maç tarihi |
| `is_home` | İç saha mı |
| `opponent_name` | Rakip adı |
| `team_score` | Takım golü |
| `opponent_score` | Rakip golü |
| `score_display` | Örn. 2-1 |
| `result_code` | `W`, `D`, `L` |
| `result_points` | 3, 1, 0 |

## Sıralama kuralı
- SQL tarafında en yeni maç `desc`
- UI tarafında form strip gösterirken en eski solda, en yeni sağda

## UI'de kullanım
- küçük form strip: `W W D L W`
- son 5 özet:
  - Last 5 Points
  - Last 5 GF
  - Last 5 GA

Not: Son 5 özet frontend'de hesaplanabilir.

---

## V1'de Bilerek Dışarıda Bırakılanlar

Şimdilik Team Statistics v1'e bunlar girmeyecek:

- possession
- shots
- shots on target
- xG
- pass metrics
- corners
- ileri stil/profil metrikleri

Bunlar daha sonra ayrı bir sekmede gösterilmeli:

### Önerilen gelecek sekme
- `Detailed Team Stats`

---

## Compare İçin Neden Bu Yapı Doğru

İleride compare geldiğinde bu yapı bozulmaz.

### Summary
Tek takım yerine iki takım satırı dönebilir.

### Split
İki takım aynı split yapısında yan yana karşılaştırılabilir.

### Recent Form
İki takımın son 5 formu ayrı strip olarak gösterilebilir.

Bu yüzden bu yapı compare-ready'dir.

---

## Frontend Eşlemesi

### Team Statistics tab yerleşimi

#### Blok A
Info cards
- Founded
- Stadium
- Head Coach
- Website
- Capacity
- Market Value

#### Blok B
Main KPI cards
- kaynak: `analytics.team_statistics_summary_v1`

#### Blok C
Split table
- kaynak: `analytics.team_statistics_split_v1`

#### Blok D
Recent form
- kaynak: `analytics.team_recent_form_v1`

---

## Sert Tavsiye

Uygulama sırası şu olmalı:

1. `football.matches` içine `season_label` ekle
2. mevcut veriyi `2025/2026` ile backfill et
3. `analytics.team_statistics_summary_v1` kur
4. `analytics.team_statistics_split_v1` kur
5. `analytics.team_recent_form_v1` kur
6. sonra Team Statistics tabını bağla

Bu sırayı bozmak gereksiz karmaşa üretir.

---

## Son Karar

Team Statistics v1 için final backend kontratı şudur:

- `analytics.team_statistics_summary_v1`
- `analytics.team_statistics_split_v1`
- `analytics.team_recent_form_v1`

Bu yapı:
- sade
- compare-ready
- season-ready
- future detailed stats için genişlemeye uygun
