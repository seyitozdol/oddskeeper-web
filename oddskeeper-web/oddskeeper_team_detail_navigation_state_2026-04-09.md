# OddsKeeper Team Detail Navigation State — 2026-04-09

## Bu dosyanın amacı
Bu not, team detail tarafında öğrendiğimiz gerçek sayfa akışını ve bugün yapılan navigation düzeltmelerini kalıcı şekilde kaydetmek için hazırlandı.

---

## 1) Gerçek çalışan takım akışı
Team selection ekranında takım kartına tıklanınca kullanılan çalışan link formatı şudur:

```txt
/dashboard/stats-analysis/football/team-stats/detail?team=<team_slug>
```

Örnek:

```txt
/dashboard/stats-analysis/football/team-stats/detail?team=besiktas
```

Önemli karar:
- Bu projede `/teams/[slug]` gibi yeni bir route kurgusu kullanılmayacak.
- Mevcut çalışan query-param yapısı korunacak.
- Team entity navigation bu canonical href üstüne kurulacak.

---

## 2) Team detail mimari bağlamı
Mevcut refactor yaklaşımı şu prensibe dayanıyor:
- `page.tsx` = orchestration layer
- `server/` = data fetch
- `panels/` = tab content
- `components/` = reusable UI parçaları
- `utils/` = formatter / helper
- `types.ts` = ortak type katmanı

Bu yaklaşım korunacak.

---

## 3) Tamamlanan entity navigation işleri

### 3.1 Fixture tab
Fixture tarafında rakip takım navigation'ı çalışır hale getirildi.

Sebep:
- `analytics.team_fixtures_v1` kontratında `opponent_team_slug` zaten vardı.
- `getTeamFixtures.ts` bu alanı select ediyordu.
- `TeamFixtureRow` bu alanı taşıyordu.

Son durum:
- Fixture içindeki rakip takım tıklanabilir.
- Tıklanınca mevcut canonical team detail link formatına gidiyor.

### 3.2 Results tab
Results tarafında ilk deneme kırıldı çünkü backend kontratı eksikti.

Root cause:
- `analytics.team_results_v1` içinde başlangıçta `opponent_team_slug` yoktu.
- Bu yüzden sadece UI değiştirerek Results navigation açılamadı.

Yapılan kalıcı düzeltme:
- `analytics.team_results_v1` view SQL güncellendi.
- View'a `opponent_team_slug` eklendi.
- `getTeamResults.ts` select listesine `opponent_team_slug` eklendi.
- `TeamResultRow` içine `opponent_team_slug` eklendi.
- `ResultsPanel.tsx` içinde opponent hücresi `TeamLink` ile bağlandı.

Son durum:
- Results içindeki rakip takım tıklanabilir.
- Tıklanınca mevcut canonical team detail link formatına gidiyor.

---

## 4) Öğrenilen kritik ders
Bu projede entity navigation kör şekilde route uydurarak yapılmayacak.

Önce kontrol edilecekler:
1. Gerçek çalışan mevcut href formatı ne?
2. İlgili view'da slug alanı gerçekten var mı?
3. Fetcher bu alanı select ediyor mu?
4. Type katmanı bu alanı taşıyor mu?
5. Panel gerçekten link render ediyor mu?

Yani doğru zincir şudur:

```txt
view -> fetcher -> types -> panel -> link helper
```

Bu zincirin tek halkası eksikse navigation ya çalışmaz ya da ekranı kırar.

---

## 5) Squad tarafı için güncel durum
Squad tarafında `player_slug` verisi zaten mevcut.

Mevcut durum:
- `TeamSquadRow` içinde `player_slug` var.
- `getTeamSquad.ts` içinde `player_slug` select ediliyor.
- `SquadPanel.tsx` içinde oyuncu adı şu an plain text.
- Henüz gerçek bir player detail page yok.

Bu yüzden squad tarafında doğru sıra şu olacak:
1. önce player detail page shell oluştur
2. canonical player href formatını belirle
3. `PlayerLink` helper/component oluştur
4. sonra `SquadPanel.tsx` içinde oyuncu adını tıklanabilir yap

Önemli karar:
- Team tarafında öğrendiğimiz gibi, player tarafında da önce route kontratı netleşmeden linkleme yapılmayacak.

---

## 6) Squad için önerilen route yaklaşımı
Henüz player page olmadığı için final karar verilmedi.

Ama mevcut team pattern'ine en uyumlu aday yapı şudur:

```txt
/dashboard/stats-analysis/football/player-stats/detail?player=<player_slug>
```

Bu karar, player detail shell page oluşturulurken kesinleştirilecek.

---

## 7) Bu aşamada stabil çalışan navigation durumu
- Team selection -> Team detail: çalışıyor
- Team detail / Fixture -> opponent team detail: çalışıyor
- Team detail / Results -> opponent team detail: çalışıyor
- Team detail / Squad -> player detail: henüz yok

---

## 8) Sonraki doğru iş
Bir sonraki feature:
- Player detail shell page oluşturmak
- Sonra Squad içinden player entity navigation açmak

Bu sıra bozulmayacak.
