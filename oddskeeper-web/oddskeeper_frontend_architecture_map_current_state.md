# OddsKeeper — Frontend Architecture Map (Current Football Analytics Slice)

## Bu belge neyi kapsıyor

Bu belge tüm repo'nun tam dökümü değildir.

Bu belge, mevcut konuşmalarda aktif olarak kurduğumuz ve kullandığımız **football analytics slice** içindeki önemli dosyaları, yolları, veri akışını ve bağlantıları netleştirir.

Amaç:
- yeni sohbette "fetcher neredeydi?"
- "bu page orchestration mıydı?"
- "hangi panel hangi view'dan besleniyordu?"
- "routing query param ile miydi?"

gibi kafa karışıklıklarını sıfırlamak.

---

# 1) Mimari prensip

Bu slice için aktif prensip şudur:

- `page.tsx` = orchestration layer
- `server/` = Supabase fetch katmanı
- `panels/` = tab content / ana yüzeyler
- `components/` = küçük tekrar kullanılabilir UI parçaları
- `utils/` = formatter / helper
- `types.ts` = ortak type kontratları
- `constants.ts` = sabitler / tab listeleri

Bu yaklaşım team-detail blueprint içinde tanımlanmış ana prensiple uyumludur.

---

# 2) Route map — aktif sayfalar

## 2.1 Team selection page
**Path:**
`frontend/app/dashboard/stats-analysis/football/team-stats/page.tsx`

**Görevi:**
- takım logosu / takım grid'i gösterir
- team detail'e query param ile gider

**Aktif link formatı:**
`/dashboard/stats-analysis/football/team-stats/detail?team=<teamSlug>`

---

## 2.2 Team detail page
**Path:**
`frontend/app/dashboard/stats-analysis/football/team-stats/detail/page.tsx`

**Görevi:**
- `team` ve `tab` query param alır
- aktif tab'a göre doğru fetcher'ı çağırır
- `TeamDetailHeader` + ilgili paneli render eder

**Aktif tab yapısı:**
- `team-statistics`
- `results`
- `squad`
- `fixture`

---

## 2.3 Player detail page
**Path:**
`frontend/app/dashboard/stats-analysis/football/player-stats/detail/page.tsx`

**Görevi:**
- `player` ve `tab` query param alır
- `getPlayerProfile` + `getPlayerMatchLog` çağırır
- `PlayerDetailHeader` + ilgili paneli render eder

**Aktif tab yapısı:**
- `overview`
- `match-log`

---

## 2.4 Match detail page
**Path:**
`frontend/app/dashboard/stats-analysis/football/match-stats/detail/page.tsx`

**Görevi:**
- `match`, `tab`, `returnTo` query param alır
- `getMatchProfile` + aktif taba göre doğru fetcher'ları çağırır
- `MatchDetailHeader` + ilgili paneli render eder

**Aktif tab yapısı:**
- `overview`
- `incidents`
- `lineups`
- `team-stats`

---

# 3) Global navigation helpers

## 3.1 Route helper
**Path:** `frontend/lib/routes.ts`

**Aktif helper'lar:**
- `getTeamDetailHref(teamSlug)`
- `getPlayerDetailHref(playerSlug)`
- `getMatchDetailHref(sourceMatchId, tab?, returnTo?)`

**Amaç:**
Route string üretimini merkezi tutmak.

---

## 3.2 Link components
**Path:** `frontend/components/links/`

**Aktif bileşenler:**
- `TeamLink.tsx`
- `PlayerLink.tsx`
- `MatchLink.tsx`

**Amaç:**
- null / missing slug güvenliği
- route üretimini tek yerde tutmak
- entity navigation'ı tekrar kullanılabilir yapmak

---

# 4) Team detail architecture

## 4.1 Path root
`frontend/features/team-detail/`

## 4.2 Ana dosyalar

### `constants.ts`
- `VALID_TABS`
- tab label mantığı

### `types.ts`
Aktif team detail type katmanı:
- `TeamProfileRow`
- `TeamResultRow`
- `TeamStatisticsSummaryRow`
- `TeamStatisticsSplitRow`
- `TeamRecentFormRow`
- `TeamSquadRow`
- `TeamFixtureRow`
- `ValidTab`

### `components/`
Aktif veya bilinen ana parçalar:
- `TeamDetailHeader.tsx`
- `ResultBadge.tsx`
- (blueprint'te tanımlı diğer reusable parçalar da bu mantığın parçasıdır)

### `panels/`
Aktif team panels:
- `TeamStatisticsPanel.tsx`
- `ResultsPanel.tsx`
- `SquadPanel.tsx`
- `FixturePanel.tsx`

### `server/`
Aktif fetcher'lar:
- `getTeamProfile.ts`
- `getTeamResults.ts`
- `getTeamStatisticsSummary.ts`
- `getTeamStatisticsSplit.ts`
- `getTeamRecentForm.ts`
- `getTeamSquad.ts`
- `getTeamFixtures.ts`

### `utils/`
Aktif formatter/helper mantığı:
- `formatDate.ts`
- `formatDecimal.ts`
- (ve team-detail blueprint'te tanımlı diğer helper mantıkları)

---

## 4.3 Team detail veri akışı

### Team header kaynakları
- local team logo / name: `lib/football-teams`
- profile meta: `ref.team_profiles`

### Team statistics tab kaynakları
- `analytics.team_statistics_summary_v1`
- `analytics.team_statistics_split_v1`
- `analytics.team_recent_form_v1`

### Results tab kaynağı
- `analytics.team_results_v1`

### Squad tab kaynağı
- `analytics.team_squad_v1`

### Fixture tab kaynağı
- `analytics.team_fixtures_v1`

---

## 4.4 Team detail navigation ilişkileri

### Team → Team
- `ResultsPanel` içindeki rakip takım adı → `TeamLink`
- `FixturePanel` içindeki rakip takım adı → `TeamLink`

### Team → Match
- `ResultsPanel` içindeki date / score → `MatchLink`
- `returnTo` ile geri dönüş team results tabına bağlanır

### Team → Player
- `SquadPanel` içindeki oyuncu adı → `PlayerLink`

---

# 5) Player detail architecture

## 5.1 Path root
`frontend/features/player-detail/`

## 5.2 Ana dosyalar

### `constants.ts`
- `VALID_PLAYER_TABS`
- player tab label mantığı

### `types.ts`
Aktif player detail type katmanı:
- `PlayerProfileRow`
- `PlayerMatchLogRow`
- `ValidPlayerTab`

### `components/`
Aktif player components:
- `PlayerDetailHeader.tsx`
- `PlayerResultBadge.tsx`
- (geçmişte `PlayerStatCard.tsx` gibi yapı denendi; şu an dense yaklaşım önde)

### `panels/`
Aktif player panels:
- `PlayerOverviewPanel.tsx`
- `PlayerMatchLogPanel.tsx`

### `server/`
Aktif player fetcher'lar:
- `getPlayerProfile.ts`
- `getPlayerMatchLog.ts`

### `utils/`
Aktif player helpers:
- `formatDate.ts`
- `formatDecimal.ts`
- `getTeamLogoPath.ts`

---

## 5.3 Player detail veri akışı

### Player profile kaynağı
- `analytics.player_profile_v1`

### Player match log kaynağı
- `analytics.player_match_log_v1`

### Player overview şu an ne kullanıyor
- profile alanları
- match log içinden türetilmiş:
  - recent form
  - last 5 summary
  - recent matches mini table

---

## 5.4 Player detail navigation ilişkileri

### Player → Team
- header / context içindeki team name → `TeamLink`
- back button → source team'in squad tabı

### Player → Match
- `PlayerMatchLogPanel` date / score → `MatchLink`
- `PlayerOverviewPanel` recent matches mini block → `MatchLink`
- `returnTo` ile geri dönüş player detail tabına bağlanır

### Match → Player
- `MatchLineupsPanel` içindeki oyuncu adı → `PlayerLink`

---

# 6) Match detail architecture

## 6.1 Path root
`frontend/features/match-detail/`

## 6.2 Ana dosyalar

### `constants.ts`
- `VALID_MATCH_TABS`
- match tab label mantığı

### `types.ts`
Aktif match detail type katmanı:
- `MatchProfileRow`
- `MatchIncidentRow`
- `MatchTeamStatsRow`
- `MatchParticipantRow`
- `ValidMatchTab`

### `components/`
Aktif match components:
- `MatchDetailHeader.tsx`

### `panels/`
Aktif match panels:
- `MatchOverviewPanel.tsx`
- `MatchIncidentsPanel.tsx`
- `MatchTeamStatsPanel.tsx`
- `MatchLineupsPanel.tsx`

### `server/`
Aktif match fetcher'lar:
- `getMatchProfile.ts`
- `getMatchIncidents.ts`
- `getMatchTeamStats.ts`
- `getMatchParticipants.ts`

### `utils/`
Aktif match helpers:
- `formatDateTime.ts`
- `formatDecimal.ts`

---

## 6.3 Match detail veri akışı

### Match header / overview kaynağı
- `analytics.match_profile_v1`

### Incidents tab kaynağı
- `analytics.match_incidents_v1`

### Team stats tab kaynağı
- `analytics.match_team_stats_v1`

### Lineups / participants tab kaynağı
- `analytics.match_participants_v1`

---

## 6.4 Match detail navigation ilişkileri

### Match → Team
- `MatchDetailHeader` içindeki team badge / team name → `TeamLink`
- `MatchOverviewPanel` team name → `TeamLink`

### Match → Player
- `MatchLineupsPanel` player rows → `PlayerLink`

### Geri dönüş mantığı
- `MatchLink` içine `returnTo` paramı taşınır
- `MatchDetailHeader` back button bu `returnTo` linkini kullanır
- böylece:
  - team results → match → back = team results
  - player match log → match → back = player match log

---

# 7) Analytics view map — current active views

## Team views
- `analytics.team_statistics_summary_v1`
- `analytics.team_statistics_split_v1`
- `analytics.team_recent_form_v1`
- `analytics.team_results_v1`
- `analytics.team_fixtures_v1`
- `analytics.team_squad_v1`

## Player views
- `analytics.player_profile_v1`
- `analytics.player_match_log_v1`

## Match views
- `analytics.match_profile_v1`
- `analytics.match_incidents_v1`
- `analytics.match_team_stats_v1`
- `analytics.match_participants_v1`

---

# 8) Raw / base tables touched by this slice

## Ref schema
- `ref.team_profiles`
- `ref.team_mapping`
- `ref.players` (şu an boş / güvenilir profile kaynağı değil)

## Football schema
- `football.matches`
- `football.fixtures`
- `football.match_incidents`
- `football.match_team_stats`
- `football.match_player_stats_opta_points`
- `football.match_player_stats_details`

---

# 9) Current UI state — important product note

Bu slice şu an teknik olarak çalışır durumda ama premium product finish seviyesinde değildir.

Özellikle:
- team / player overview ekranları interim yüzeylerdir
- analytics backbone henüz eksiktir
- benchmark / rank / league average katmanı henüz kurulmamıştır
- detailed premium metric surfaces henüz yapılmamıştır

Yani bu mimari şu an:
- doğru iskelet
- doğru yön
- ama final product surface değil

---

# 10) Aktif çalışma kararı

Şu karar sabit kabul edilmeli:

1. çalışan ekranlar şimdilik korunur
2. önce eksik analytic backbone tamamlanır
3. sonra team/player/match ekranları premium standarda yeniden yükseltilir

---

# 11) Bir sonraki sohbet için kısa yol

Yeni sohbette biri "burada modüler yapı mı vardı?" derse cevap:

- evet
- `page.tsx` orchestration
- `server/` fetch
- `panels/` tab content
- `components/` reusable UI
- `utils/` helper
- `types/constants` kontrat

Yeni sohbette biri "şu metriği nereden çekiyorduk?" derse yaklaşım:

1. önce ilgili entity'yi belirle: team / player / match
2. sonra ilgili `server/` dosyasına bak
3. o fetcher'ın çağırdığı `analytics.*_v1` view'a bak
4. gerekirse alttaki football/ref tablolarına in

Bu slice için veri akışı genel olarak:

`football/ref raw tables -> analytics.*_v1 views -> features/*/server fetchers -> page.tsx orchestration -> panels/components`
