# OddsKeeper Team Detail Refactor Blueprint

## Amaç

`team-stats/detail/page.tsx` dosyasını monolith yapıdan çıkarıp sürdürülebilir, ölçeklenebilir ve feature-bazlı bir mimariye geçirmek.

Bu refactor'un hedefi:

- `page.tsx` dosyasını orchestration layer haline getirmek
- veri çekme katmanını ayırmak
- panel bazlı modüler yapı kurmak
- compare / detailed team stats / basketball gibi gelecekteki feature'lara hazır olmak

---

## Ana Prensip

### Yanlış yaklaşım
Tek bir `page.tsx` içinde:

- query param parse
- Supabase fetch
- helper function'lar
- formatter'lar
- table rendering
- header rendering
- tab panel rendering

tutmak.

### Doğru yaklaşım
- `page.tsx` = route orchestration
- `server/` = data fetch
- `panels/` = tab content
- `components/` = küçük tekrar kullanılabilir parçalar
- `utils/` = formatter / helper
- `types.ts` = ortak type'lar
- `constants.ts` = sabitler

---

## Nihai Dosya Yapısı

```text
frontend/
  app/
    dashboard/
      stats-analysis/
        football/
          team-stats/
            detail/
              page.tsx

  features/
    team-detail/
      components/
        TeamDetailHeader.tsx
        CompactInfoCard.tsx
        StatCard.tsx
        ResultBadge.tsx
        RecentFormStrip.tsx
        SplitStatsTable.tsx
        LastFiveMatchesList.tsx

      panels/
        TeamStatisticsPanel.tsx
        ResultsPanel.tsx
        SquadPanel.tsx
        FixturePanel.tsx

      server/
        getTeamProfile.ts
        getTeamResults.ts
        getTeamStatisticsSummary.ts
        getTeamStatisticsSplit.ts
        getTeamRecentForm.ts

      utils/
        formatDate.ts
        formatCapacity.ts
        formatDecimal.ts
        formatPercentage.ts
        getMetaValue.ts
        getWebsiteLabel.ts
        getResultBadgeClass.ts
        reverseRecentForm.ts
        getLastFiveSummary.ts

      constants.ts
      types.ts
```

---

## `page.tsx` Son Hedefi

`page.tsx` sadece şunları yapmalı:

1. `team` ve `tab` parametrelerini almak
2. takım geçerli mi kontrol etmek
3. ortak header'ı render etmek
4. aktif taba göre doğru paneli çağırmak

### Hedef satır sayısı
- 80–140 satır

---

## Mevcut Koddan Ne Nereye Taşınacak

## 1) `types.ts`

Taşınacak yapılar:

- `TeamProfileRow`
- `TeamResultRow`
- `TeamStatisticsSummaryRow`
- `TeamStatisticsSplitRow`
- `TeamRecentFormRow`
- `ValidTab`

### Amaç
Sayfa dosyası type kalabalığından kurtulsun.

---

## 2) `constants.ts`

Taşınacaklar:

- `VALID_TABS`
- tab label listesi

### Amaç
Tab sistemi merkezi sabitten beslensin.

---

## 3) `utils/`

Taşınacak helper / formatter'lar:

- `formatDate`
- `formatCapacity`
- `formatDecimal`
- `formatPercentage`
- `getMetaValue`
- `getWebsiteLabel`
- `getResultBadgeClass`
- `reverseRecentForm`
- `getLastFiveSummary`

### Amaç
JSX dosyası business logic / formatting logic ile dolmasın.

---

## 4) `server/`

Page içindeki fetch fonksiyonları tamamen buraya taşınacak:

- `getTeamProfile`
- `getTeamResults`
- `getTeamStatisticsSummary`
- `getTeamStatisticsSplit`
- `getTeamRecentForm`

### Kural
- her dosya tek işi yapacak
- Supabase erişimi burada olacak
- UI dosyası `.schema(...).from(...)` görmeyecek

---

## 5) `components/`

Küçük tekrar kullanılabilir UI parçaları:

### `CompactInfoCard.tsx`
Team Statistics üstteki 6 bilgi kartı

### `StatCard.tsx`
KPI kartları ve küçük özet kartlar

### `ResultBadge.tsx`
`W / D / L` badge

### `RecentFormStrip.tsx`
küçük form badge satırı

### `SplitStatsTable.tsx`
overall / home / away tablo

### `LastFiveMatchesList.tsx`
son 5 maç listesi

### `TeamDetailHeader.tsx`
- logo
- takım adı
- tabs
- back button
- results count badge

---

## 6) `panels/`

Asıl sekmeler burada:

### `ResultsPanel.tsx`
- dense results table
- empty state

### `TeamStatisticsPanel.tsx`
- info cards
- KPI row
- split table
- recent form strip
- last 5 block

### `SquadPanel.tsx`
- şimdilik placeholder bile olsa ayrı

### `FixturePanel.tsx`
- şimdilik placeholder bile olsa ayrı

---

## Refactor Sırası

## Faz 1 — Güvenli ayrıştırma
Önce küçük ve düşük riskli şeyleri çıkar:

1. `types.ts`
2. `constants.ts`
3. `utils/*`

## Faz 2 — Fetch katmanı
4. `server/getTeamProfile.ts`
5. `server/getTeamResults.ts`
6. `server/getTeamStatisticsSummary.ts`
7. `server/getTeamStatisticsSplit.ts`
8. `server/getTeamRecentForm.ts`

## Faz 3 — UI parçaları
9. `CompactInfoCard.tsx`
10. `StatCard.tsx`
11. `ResultBadge.tsx`
12. `RecentFormStrip.tsx`
13. `SplitStatsTable.tsx`
14. `LastFiveMatchesList.tsx`

## Faz 4 — Paneller
15. `ResultsPanel.tsx`
16. `TeamStatisticsPanel.tsx`
17. `SquadPanel.tsx`
18. `FixturePanel.tsx`

## Faz 5 — Header
19. `TeamDetailHeader.tsx`

## Faz 6 — Page cleanup
20. `page.tsx` sadece orchestration olarak bırakılır

---

## Bu Yapı Neden Tüm Site İçin Doğru

Bu pattern sonra şuralara da uygulanabilir:

- football team detail
- football compare
- football detailed team stats
- basketball team detail
- basketball compare

Yani bu refactor sadece bir sayfa düzeltmesi değil, site geneli için temel pattern olacak.

---

## Compare İçin Kazanım

Bu yapıdan sonra compare ekranı yaparken hazır parçalar olacak:

- `StatCard`
- `SplitStatsTable`
- `RecentFormStrip`
- `ResultBadge`

Yani compare, sıfırdan yeni UI dünyası kurmayacak.

---

## Detailed Team Stats İçin Kazanım

Daha sonra:

- shots
- xG
- SoT
- passes
- possession

gibi metrikler ayrı panelde gösterilecek.

Panel bazlı yapı olmadığı sürece ana dosya tekrar patlar.

Bu refactor bunu önler.

---

## İlk Başarı Kriteri

Refactor sonrası hedef:

- `page.tsx` → ~100 satır
- `TeamStatisticsPanel.tsx` → 150–250 satır
- `ResultsPanel.tsx` → 100–180 satır
- küçük component'ler → 20–60 satır

---

## Uygulama Kararı

Yeni feature eklemeye devam etmeden önce şu adımlar uygulanmalı:

1. `types.ts + constants.ts + utils/`
2. `server/` fetcher'lar
3. `ResultsPanel` ve `TeamStatisticsPanel`
4. `TeamDetailHeader`
5. `page.tsx` cleanup

Bu, en hızlı ve en az riskli refactor yoludur.
