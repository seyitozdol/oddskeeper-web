# OddsKeeper — Advanced Metrics Backbone Blueprint v1

## Amaç

Bu belge, **player advanced metrics v1** ve **team advanced metrics v1** analytics backbone'u için uygulanabilir blueprint'i tanımlar.

Bu aşamada hedef:
- UI cilası yapmak değil
- premium analytics backbone'u kurmak
- mevcut çalışan entity navigation ve modüler frontend yapısını bozmadan yeni analytic katmanı eklemek

---

## Temel karar

Backbone 4 katmanda kurulacak:

1. **Base layer**
   - match-level canonical metrics
2. **Aggregate layer**
   - player/team season advanced metrics
3. **Benchmark layer**
   - rank / percentile / avg / median / delta
4. **Overview layer**
   - premium, seçilmiş, karar verdiren özet yüzey

Ek olarak merkezi bir metric catalog tutulacak:

5. **Metric registry**
   - metric metadata, kategori, display önceliği, role scope

---

## Yeni object listesi

### Player analytics object'leri
1. `analytics.player_match_metrics_base_v1`
2. `analytics.player_advanced_metrics_v1`
3. `analytics.player_metric_benchmarks_v1`
4. `analytics.player_overview_advanced_v1`

### Team analytics object'leri
1. `analytics.team_match_metrics_base_v1`
2. `analytics.team_advanced_metrics_v1`
3. `analytics.team_metric_benchmarks_v1`
4. `analytics.team_overview_advanced_v1`

### Registry
1. `ref.metric_registry`

---

## 1) Base layer

Bu katman en kritik katmandır.

Buradaki amaç:
- ham kaynaklardan gelen metrikleri tek bir canonical katmanda toplamak
- üst katmanların aynı kolon mantığıyla çalışmasını sağlamak
- frontend ve analytics tarafında tekrar tekrar karmaşık join yazmamak

---

## 1.1 `analytics.player_match_metrics_base_v1`

**Her satır = bir oyuncu + bir maç**

### Çekirdek kolonlar
- `source_match_id`
- `match_id`
- `season_label`
- `competition`
- `match_datetime`
- `team_bk`
- `opponent_team_bk`
- `player_bk`
- `player_name`
- `team_side`
- `is_home`
- `is_away`
- `started_flag`
- `sub_flag`
- `minutes_played`

### Ham metric kolonları
- `goals`
- `assists`
- `expected_goals`
- `shots_on_target`
- `shots_off_target`
- `shots_blocked`
- `attempts_ibox`
- `attempts_obox`
- `passes`
- `accurate_pass`
- `crosses`
- `fantasy_assist`
- `tackles`
- `interceptions`
- `fouls_conceded`
- `fouls_won`
- `offsides`
- `cards_yellow`
- `cards_red`
- `saves_total`
- `penalties_saved`
- `goals_conceded`
- `goal_kicks`
- `total_throws`
- `out_of_box_goals`
- `right_foot_goals`
- `left_foot_goals`
- `headed_goals`
- `penalty_goals`
- `freekick_goals`
- `hit_woodwork`

### Amaç
Bu view, player advanced metric'lerin ana ham kaynağı olacak.

---

## 1.2 `analytics.team_match_metrics_base_v1`

**Her satır = bir takım + bir maç**

### Çekirdek kolonlar
- `source_match_id`
- `match_id`
- `season_label`
- `competition`
- `match_datetime`
- `team_bk`
- `opponent_team_bk`
- `team_side`
- `is_home`
- `is_away`

### Ham metric kolonları
- `goals`
- `assists`
- `red_cards`
- `yellow_cards`
- `shots`
- `shots_on_target`
- `blocked_shots`
- `attempts_ibox`
- `attempts_obox`
- `expected_goals`
- `headed_shots`
- `hit_woodwork`
- `passes`
- `accurate_pass`
- `crosses`
- `tackles`
- `interceptions`
- `fouls_conceded`
- `fouls_won`
- `offsides`
- `corners_won`
- `saves`
- `goal_kicks`
- `total_throws`
- `penalties_saved`
- `out_of_box_goals`
- `right_foot_goals`
- `left_foot_goals`
- `headed_goals`
- `penalty_goals`
- `freekick_goals`

### Amaç
Bu view, team advanced metric'lerin ana ham kaynağı olacak.

---

## 2) Aggregate layer

Bu katmanda sezon / entity düzeyinde türetilmiş metrikler üretilecek.

---

## 2.1 `analytics.player_advanced_metrics_v1`

**Her satır = bir oyuncu + bir sezon + bir takım**

### Çekirdek kolonlar
- `season_label`
- `competition`
- `team_bk`
- `player_bk`
- `player_name`
- `role_group`

### Usage kolonları
- `appearances`
- `starts`
- `sub_appearances`
- `starter_rate_pct`
- `total_minutes`
- `avg_minutes`

### Her ana metric için türev kolonlar
- `*_total`
- `*_per_match`
- `*_per90`
- `*_home_per_match`
- `*_away_per_match`
- `*_last5_total`
- `*_last5_per_match`

### Not
Bu yapı wide format olacak. Çünkü entity detay ekranı bunu daha rahat tüketir.

---

## 2.2 `analytics.team_advanced_metrics_v1`

**Her satır = bir takım + bir sezon**

### Çekirdek kolonlar
- `season_label`
- `competition`
- `team_bk`

### Her ana metric için türev kolonlar
- `*_total`
- `*_per_match`
- `*_home_total`
- `*_home_per_match`
- `*_away_total`
- `*_away_per_match`
- `*_last5_total`
- `*_last5_per_match`

### Not
Bu yapı da wide format olacak.

---

## 3) Benchmark layer

Bu katmanda premium ürünün asıl bağlam değeri üretilir.

Ham sayı tek başına yetersizdir.
Müşterinin para verdiği şey bağlamdır.

Bu yüzden benchmark katmanı long format tasarlanacak.

---

## 3.1 `analytics.player_metric_benchmarks_v1`

**Her satır = bir oyuncu + bir metric**

### Kolonlar
- `season_label`
- `competition`
- `team_bk`
- `player_bk`
- `metric_key`
- `metric_value`
- `team_rank`
- `league_rank`
- `team_percentile`
- `league_percentile`
- `league_avg`
- `league_median`
- `vs_league_avg_abs`
- `vs_league_avg_pct`
- `above_league_avg_flag`

### Amaç
Şu tip anlatıları mümkün kılar:
- takım içinde kaçıncı
- lig içinde kaçıncı
- lig ortalamasının yüzde kaç üstünde / altında

---

## 3.2 `analytics.team_metric_benchmarks_v1`

**Her satır = bir takım + bir metric**

### Kolonlar
- `season_label`
- `competition`
- `team_bk`
- `metric_key`
- `metric_value`
- `league_rank`
- `league_percentile`
- `league_avg`
- `league_median`
- `vs_league_avg_abs`
- `vs_league_avg_pct`
- `above_league_avg_flag`

---

## 4) Overview layer

Overview ekranı metric çöplüğü olmayacak.
Burada az ama güçlü metrik gösterilecek.

---

## 4.1 `analytics.player_overview_advanced_v1`

**Her satır = bir oyuncu**

### Kolonlar
- `player_bk`
- `team_bk`
- `season_label`
- `role_group`
- `usage_label`
- `form_label`
- `primary_strength_metric_key`
- `primary_strength_metric_value`
- `primary_strength_league_rank`
- `primary_strength_vs_league_pct`
- `secondary_strength_metric_key`
- `secondary_strength_metric_value`

### Amaç
Overview ekranında şunları söylemek:
- bu oyuncu ne kadar kullanılıyor
- son dönemde formu nasıl
- en güçlü olduğu alan ne
- takım ve lig bağlamında öne çıkan tarafı ne

---

## 4.2 `analytics.team_overview_advanced_v1`

**Her satır = bir takım**

### Kolonlar
- `team_bk`
- `season_label`
- `attack_profile_label`
- `defence_profile_label`
- `strongest_metric_key`
- `strongest_metric_rank`
- `strongest_metric_vs_league_pct`
- `weakest_metric_key`
- `weakest_metric_rank`
- `home_away_gap_metric_key`
- `form_shift_last5_flag`

### Amaç
Overview ekranında şunları söylemek:
- takımın oyun profili ne
- lig ortalamasına göre güçlü / zayıf yönü ne
- home / away farkı var mı
- son dönemde anlamlı form değişimi var mı

---

## 5) Metric registry

Bu object view değil, tablo olarak kurulmalı.

## `ref.metric_registry`

### Kolonlar
- `metric_key`
- `entity_type`
- `category`
- `display_label`
- `role_scope`
- `display_priority`
- `overview_allowed`
- `detailed_allowed`
- `benchmark_allowed`
- `supports_per90`
- `supports_home_away`
- `supports_last5`

### Amaç
- metric katalogunu merkezi tutmak
- ekran önceliğini merkezi yönetmek
- role-aware sunumu düzgün yapmak
- detailed / overview / benchmark kullanımını kontrollü yapmak

---

## 6) Role-aware mantık

Player tarafında bütün metrikler herkeste tutulacak.
Ama overview ve önceliklendirme role göre değişecek.

### V1 role grupları
- `GK`
- `DEF`
- `MID`
- `FWD`
- `UNKNOWN`

### V1 mantık
Role kaynağı güvenilir değilse:
- oyuncunun en sık görülen position / role bilgisinden türet
- güven düşüğünde `UNKNOWN` kullan

### Kritik not
Role-aware mantık backend / analytics katmanında kurulmalı.
UI içinde dağınık if-else ile yapılmamalı.

---

## 7) Frontend etkisi

Mevcut modüler mimari korunacak.

Aktif mimari prensibi:
- `page.tsx` = orchestration
- `server/` = fetch
- `panels/` = tab içerikleri
- `components/` = reusable UI parçaları
- `utils/` = helper / formatter
- `types.ts` = kontratlar
- `constants.ts` = tab / sabitler

Yeni advanced metrics yüzeyi bu yapının üstüne eklenecek.

---

## 7.1 Player tarafında eklenecek dosyalar

### `frontend/features/player-detail/server/`
- `getPlayerAdvancedOverview.ts`
- `getPlayerAdvancedMetrics.ts`
- `getPlayerMetricBenchmarks.ts`

### `frontend/features/player-detail/panels/`
- `PlayerAdvancedOverviewPanel.tsx`
- `PlayerAdvancedMetricsPanel.tsx`
- `PlayerBenchmarksPanel.tsx`

### `frontend/features/player-detail/types.ts`
Eklenecek type'lar:
- `PlayerAdvancedOverviewRow`
- `PlayerAdvancedMetricRow`
- `PlayerMetricBenchmarkRow`

### Player tab yapısı
Mevcut:
- `overview`
- `match-log`

Yeni:
- `overview`
- `advanced`
- `benchmarks`
- `match-log`

---

## 7.2 Team tarafında eklenecek dosyalar

### `frontend/features/team-detail/server/`
- `getTeamAdvancedOverview.ts`
- `getTeamAdvancedMetrics.ts`
- `getTeamMetricBenchmarks.ts`

### `frontend/features/team-detail/panels/`
- `TeamAdvancedOverviewPanel.tsx`
- `TeamAdvancedMetricsPanel.tsx`
- `TeamBenchmarksPanel.tsx`

### `frontend/features/team-detail/types.ts`
Eklenecek type'lar:
- `TeamAdvancedOverviewRow`
- `TeamAdvancedMetricRow`
- `TeamMetricBenchmarkRow`

### Team tab yapısı
Mevcut:
- `team-statistics`
- `results`
- `squad`
- `fixture`

Yeni:
- `team-statistics`
- `advanced`
- `benchmarks`
- `results`
- `squad`
- `fixture`

---

## 8) Uygulama sırası

Doğru sıra şu:

1. `ref.metric_registry`
2. `analytics.player_match_metrics_base_v1`
3. `analytics.team_match_metrics_base_v1`
4. `analytics.player_advanced_metrics_v1`
5. `analytics.team_advanced_metrics_v1`
6. `analytics.player_metric_benchmarks_v1`
7. `analytics.team_metric_benchmarks_v1`
8. `analytics.player_overview_advanced_v1`
9. `analytics.team_overview_advanced_v1`
10. frontend fetcher + panel wiring

---

## 9) V1 scope sınırı

Bu aşamada yapmayacağız:
- tüm metrikleri overview'a basmak
- benchmark hesaplarını frontend'de yapmak
- role-aware mantığı UI if-else çöplüğüne çevirmek
- mevcut entity navigation akışını bozmak

---

## 10) Net sonuç

Bu blueprint ile şu hedefleniyor:
- raw data explorer seviyesinden çıkmak
- premium analytics product yönüne geçmek
- player/team detail ekranlarını gerçek analytic backbone ile beslemek
- benchmark ve context katmanını merkezi hale getirmek

Bu belge executable SQL değildir.
Bu belge, executable SQL ve frontend implementasyonu başlamadan önce kilitlenmiş **v1 backbone kontratıdır**.
