# Basketbol modeli — çalışma defteri anatomisi (v38)

Kaynak: `Basketbol Player Team_v38.xlsm` (20 sayfa, 43 VBA modülü, ~9.4 MB).
Alan: Türkiye Basketbol Süper Ligi (BSL), 2025-26 sezonu, 16 takım.
Amaç: maç kutu-skorlarından oyuncu ve takım bazlı bahis oranları (over/under, handikap, money line, total) üretmek.

Bu belge; sayfaları, veri modelini ve arkasındaki matematiği kayıt altına alır. Supabase `basketball.*` şeması ve web tarafı bunun üzerine kurulacak.

---

## 1. Uçtan uca akış

```
   (elle yapıştırılan maç kutu-skoru)
              │  VBA: OyuncuDatasiAktar_Append / TeamTotalAktar
              ▼
   HAM TABLOLAR:  tblPlayer (oyuncu-maç)   tblTeam (takım-maç)
              │  + Lists (kadro), Fixture, Table2025-2026, Criteria, MarketTemplate
              ▼
   MODEL (worksheet LET/LAMBDA + Monte-Carlo):
      • TeamPTSModel  → takım toplam / handikap / ML / over-under
      • TeamProps     → takım prop marketleri (Home/Away/Total × 12 market)
      • PlayerCalc    → oyuncu prop marketleri (21 oyuncu × market)
      • TakimOzet(_v2), TakimOyuncu, Sheet2 → scouting/özet panolar
              │  VBA: Export_PlayerLines_To_PlayerOutPut_v4 / Append_TeamOutput_From_Tables
              ▼
   DÜZ ÇIKTI:  PlayerOutPut, TeamOutput  (bahis platformuna yüklenecek satırlar)
```

Payback = overround/vig katsayısı. Oranlar `Payback / olasılık` ile fiyatlanır (H1=0.96 total, H2/C1=0.915 ML/oyuncu).

---

## 2. Sayfalar (20)

| Sayfa | Durum | Rol |
|---|---|---|
| **Player** | görünür | HAM: oyuncu-maç kutu skoru (`tblPlayer` A2:BB6039, ~6037 satır). A-AA ham, AB-BB türev metrik. |
| **Team** | görünür | HAM: takım-maç toplamları (`tblTeam` A2:AL506, ~504 satır). |
| **Lists** | görünür | Kadro (`tblPlayers`: takım, oyuncu, market participant id) + dropdown listeleri. |
| **Fixture** | görünür | Oynanacak maçlar (Hafta, Mac metni, Fixture ID, Home, Away). |
| **MarketTemplate** | görünür | Market adı → platform şablon kodu (`MTemp` B2:C49). |
| **Criteria** | gizli | Kalifikasyon eşikleri: Min Dk 10, Min Sayı 10, Min Asist 5, Min Rib 4. |
| **Headers** | gizli | Sözlük (kısaltma → Türkçe açıklama). |
| **Sheet4** | gizli | Takım→oyuncu roster listesi (281 satır, dropdown kaynağı). |
| **Table2025 - 2026** | gizli | Head-to-head final skor matrisi (home×away, lig ortalaması S/AC satırları buradan). |
| **TeamPTSModel** | görünür | Takım toplam-puan modeli + 1000 Monte-Carlo (satır 30-1029). |
| **TeamProps** | görünür | Takım prop motoru: 12 market × Home/Away/Total; 33 ladder tablosu (4000 MC her biri). |
| **PlayerCalc** | görünür | Oyuncu prop motoru: 21 oyuncu tablosu (Player1..21), her biri 4000 MC ladder. |
| **TakimOzet / TakimOzet_v2** | gizli | Takım özet panosu (PPG, OPP PPG, RPG, OffRtg/DefRtg, Poss/Game, volatilite, shot selection index, son-5). |
| **TakimOyuncu** | görünür | Takım kadrosu sıralama aracı (oyuncu başına toplam/oran, sortlanabilir). |
| **PlayerOutPut** | görünür | DÜZ ÇIKTI: oyuncu bahis satırları (FixtureID, MarketTemplate, Participant, Line, Over/Under fiyat). |
| **TeamOutput** | görünür | DÜZ ÇIKTI: takım bahis satırları. |
| **Main** | görünür | Tek-maç oyuncu görüntüleme paneli. |
| **Sheet2** | görünür | Pivot (çeyrek bazlı şut). |
| **LogoBank** | görünür | Logo saklama (boş/yardımcı). |

---

## 3. Ham veri şeması

### 3.1 tblPlayer (Player sayfası) — oyuncu-maç kutu skoru

Ham kolonlar (A-AA):

| Kol | Ad | Anlam |
|---|---|---|
| A | No | Forma no |
| B | Oyuncu | Oyuncu adı (kimlik anahtarı) |
| C | Sure | Süre `s:dd:ss` (VBA `DurationToSeconds` saniyeye çevirir) |
| D | Sayi | Toplam sayı (puan) |
| E/F/G | 2AG Basari / 2AG / 2AG % | 2'lik isabet / deneme / % |
| H/I/J | 3AG Basari / 3AG / 3AG % | 3'lük isabet / deneme / % |
| K/L/M | SA Basari / SA AG / SA % | Serbest atış isabet / deneme / % |
| N/O/P | HR / SR / TR | Hücum reb / Savunma reb / Toplam reb |
| Q | As | Asist |
| R | TK | Top kaybı (turnover) |
| S | Tc | Top çalma (steal) |
| T/U | BLK / YBLK | Blok / yenilen blok |
| V/W | FA / YFA | Alınan faul / yapılan faul |
| X | Oyuncu Takimi | Oyuncunun takımı |
| Y | Mac | Maç metni ("A - B") |
| Z | Mac Tarihi | Tarih |
| AA | Mac Haftasi | Hafta (1..32) |

Türev kolonlar (AB-BB, formülle): Dakika (ondalık dk), MacTarih_Num, IlkMac_Takim/Lig, YeniFlag (yeni oyuncu), KatkiVar, ContributionGameNo, **Usage Score / Usage% / UsageNum / UsageMins**, **Poss_player** (`2AG+3AG - HR + TK + 0.44*SA_AG` benzeri hücum sahipliği), TeamMins (200 = 5×40dk), MinShare, **PPM** (sayı/dk), TeamPPM, EffMod, Impact, **FGPtc** (toplam saha isabet %), SAPct2. Bunlar usage/verimlilik türevleri; kullanıcı arayüzünde ve modelde sürücü.

### 3.2 tblTeam (Team sayfası) — takım-maç toplamları

Ham (A-W): Takim, Home-Away, Mac, Sayi, 2AG Basari/2AG/2AG%, 3AG…, SA…, HR/SR/TR, As, TK, Tc, BLK, YBLK, FA, YFA, Mac Tarihi, Mac Haftasi.
Türev (X-AL): Rakip, MacTarih_Num, Home/Away (0/1), **OppSayi** (rakip sayısı, netrating için), **Poss** (`2AG+3AG - HR + TK + 0.44*SA_AG`), **NetRat** (Sayi-OppSayi), Home, **AGC/BAGC/AGPct** (toplam saha deneme/isabet/%), **MissFG/MissFG2/MissFG3** (kaçan 2'lik/3'lük/serbest — rebound modelinin girdisi).

### 3.3 Referans/konfig

- **Lists / tblPlayers**: (Oyuncu Takimi, Oyuncu, Market Participant id) — kadro + platform katılımcı kimliği.
- **Fixture**: (Hafta, Mac, Fixture ID, Home Team, Away Team) — model bir fikstürü "seçer".
- **Table2025-2026**: home×away final skor matrisi + lig ort. satırları (S/AC = takım scored/conceded avg).
- **Criteria**: Min Dk 10, Min Sayı 10, Min Asist 5, Min Rib 4 (leaderboard/kalifikasyon).
- **MarketTemplate / MTemp**: market → platform kodu haritası (aşağıda tam liste).

---

## 4. Market kataloğu (MarketTemplate)

**Oyuncu marketleri** (PlayerOutPut):

| Market | Kod | | Market | Kod |
|---|---|---|---|---|
| Sayi (puan) | PPOINTS | | SayiRibAs (P+R+A) | PPTSRBAST |
| Ribaund | PREB | | FGMadePct | PFGLSM |
| Asist | PAST | | 2PMade | P2PTSM |
| 3Pts | P3PTM | | FTPct | PTFTRWM |
| SayiRib (P+R) | PPTSREB | | FTMade | PFTRWM |
| SayiAs (P+A) | PPTSAST | | TopKaybi/TopCalma/Blok | PTURNOVR/PSTL/PBLCK |

**Takım marketleri** (TeamOutput): `{Home,Away} × {FT (HFTM/AFTM), 3PT (H3PFGM/APFGM), TR (HOMEREB/AWAYREB), HR (…OREB), SR (…DREB), As (HOMEA/AWAYA)}` + `Total × {As, TR, HR, SR, 3PT, FTM, 2PM, BLK, Turnover, Steal, FGM}` (şu an "Test …" kodlu, taslak) + TeamPTSModel'den total/handikap/ML/over-under.

---

## 5. Matematik

### 5.1 Ortak Monte-Carlo motoru (tüm marketler)

Her market için mantık aynı:

1. **Ortalama (mean)** ve **standart sapma (std)** belirlenir.
2. **N simülasyon** çekilir: değer ~ `Normal(mean, std)` (oyuncu: 4000, takım prop: 4000, takım total: 1000). Prop'larda tam sayıya yuvarlanır (`ROUND(NORM.INV(RAND(),mean,std),0)`).
3. **Line ladder**: alt sınır `MAX(0.5, FLOOR(MEDIAN(sims)-2.5, 1) + 0.5)`, sonra +1 artışla 15 satır (…, x.5).
4. Her line için **Over olasılığı** = `COUNTIF(sims > line) / N`.
5. **Fiyat**: `Over = Payback / P(over)`, `Under = Payback / (1 - P(over))` (IFERROR ile 999/0 kapağı).

Yani "model" özünde her market için `Normal(mean, std)` dağılımının ampirik over/under olasılıklarını payback ile fiyatlamaktır.

### 5.2 TeamPTSModel — takım toplam / handikap / ML

**Beklenen puan (xG), rakibe göre ayarlı:**
```
xG_home = Σ_sezon  weight_s × ((Off_home × Def_away / lgAvgA) + (Def_away × Off_home / lgAvgH)) / 2
```
(`X18/X42/X67/X89/X111` = sezon blokları; `M` kolonu = sezon ağırlığı, şu an yalnız 2024-25 = 1). Klasik "takım hücumu × rakip savunması / lig ortalaması" (log5 benzeri), iki yönlü simetrikleştirilmiş. `E5=home xG`, `F5=away xG`, `H5=total=E5+F5`.

**1000 Monte-Carlo (satır 30-1029, B28=1000):**
```
home_i = NORMINV(RAND(), xG_home, std_home)      std: Table2025-2026 std kolonu (VLOOKUP)
away_i = NORMINV(RAND(), xG_away, std_away)
margin_i = (favori işaretli) home_i - away_i
total_i  = home_i + away_i
```
- **Handikap**: her çizgi için `P(cover) = COUNTIF(margin > çizgi)/1000`; ML fiyat = `Payback_ML(0.915) / P`. Poisson.Dist ile çapraz kontrol (`G33=POISSON.DIST(margin, handikap, TRUE)`).
- **Total Over/Under**: çizgiler `H5-3 … H5+…`; fiyat = `Payback(0.96) / (COUNTIF(total > çizgi)/1000)`.
- **Money Line**: `E8 = Payback_ML / P(home cover 0)`, `F8 = Payback_ML/(1-E8)`.

### 5.3 TeamProps — takım prop marketleri

Sol özet blok (her takım, Home/Away/Total ayrı), satır başına market:

| Kolon | İçerik |
|---|---|
| **C (AVG)** | Sezon ortalaması: `SUMIFS(tblTeam[stat],Takim)/COUNTIFS(...)` |
| **D (Std)** | Standart sapma (elle/tarihsel girilir) |
| **E (Model)** | Rakibe-ayarlı projeksiyon. Pts = TeamPTSModel!E5. Asist = `(Trader_Pts/AVG_Pts)×Last10_Asist`. OReb = `AVG(MissFG2)×0.28×(Trader_Pts/AVG_Pts)`. DReb = rakip `MissFG2×0.72×…`. TR = OReb+DReb. 2PM/3PM = `(Trader_Pts/AVG_Pts)×Last10`. |
| **F (Last 10 Weight)** | Son 10 maç ağırlıklı ortalama (form) |
| **G (Trader)** | Trader'ın seçtiği **nihai mean** — simülasyona giren değer |

12 market: Pts, Asist, Total/Off/Def Rebound, 3PT Made, FT% Made, 2PMade, Blok, Turnover, Steal, FGMadePct.
Her market×{Home,Away,Total} için 33 ladder tablosu (`HomeAs`, `HomeTR`, … `TotalFGM`): `Normal(G=Trader, D=Std)` 4000 MC → 15-line ladder → payback fiyat. AVG/Model/Last10 kolonları trader'ın G'yi seçmesine yardımcı karar-desteğidir.

### 5.4 PlayerCalc — oyuncu prop marketleri

Sürücü blok: Payback (C1=0.915), seçili Fixture (C2/C3), Home/Away (C4), rakip (C5), **Expectancy** (C7 = rakibin bu markette verdiği ortalama), Market Sec (C8: Sayi/Ribaund/Asist/3Pts/kombolar), Team Rebound AVG (C6). B11:B31 = seçili takımın kadrosu (≤21 oyuncu).

Her oyuncu için `C36:C4035` = 4000 simülasyon (oyuncunun geçmiş dağılımından, minutes/usage ve rakip-expectancy ile ayarlı mean+std). 21 `PlayerN` tablosu (D34:H48 …) her biri:
- **Line** `D35 = MAX(0.5, FLOOR(MEDIAN(sims)-2.5,1)+0.5)`, +1 artış
- **Count** `= COUNTIF(sims > line)`; **X (prob)** `= Count/4000`
- **Over** `= Payback/prob`; **Under** `= Payback/(1-prob)`

### 5.5 Türev metrikler (usage / pace / rating)

- **Possession** (takım/oyuncu): `2AG + 3AG - HR(oreb) + TK(turnover) + 0.44×SA_AG` (standart formül varyantı).
- **Usage%**: oyuncunun takım possession'ındaki payı (UsageNum = `Sayi + 0.7×(2AG+3AG) + …`).
- **PPM**: sayı/dakika. **NetRat**: Sayi - OppSayi. **OffRtg/DefRtg**: TakimOzet'te 100 poss başına.
- **Shot Selection Index, Volatilite, Son-5 form**: TakimOzet panolarında scouting amaçlı.

---

## 6. VBA (43 modül) — ne yapıyor

- **Ingest**: `OyuncuDatasiAktar_Append` (Module1/5) yapıştırılan oyuncu bloklarını parse edip tblPlayer'a ekler; `TeamTotalAktar[_Fast]` (Module2/6) takım toplamlarını tblTeam'e. `DurationToSeconds` süre parse. `GetPlayerNameInBlock`, `IsSplitStatColumn` yardımcılar.
- **Export**: `Export_PlayerLines_To_PlayerOutPut` v1→v4 (Module7-12, en güncel v4/Module12): 21 PlayerN tablosundan mid-line'ı (`min |Over-Under| farkı`) + komşularını seçer, market kurallarına göre line-offset (Normal / OverOnly / FixedOver / OverOnly_NoUnder) uygular, düz satır yazar. `Append_TeamOutput_From_Tables` (Module14): 33 TeamProps tablosu + TeamPTSModel → TeamOutput; `DetermineMidLine_MinOverUnderDiff`, `BuildMarketTemplateMap`. `Export_PlayerOutPut_To_NewWorkbook` (Module13): ayrı dosyaya aktarım.
- Model matematiği VBA'da DEĞİL; worksheet LET/LAMBDA + Monte-Carlo'da. VBA yalnız veri giriş/çıkışını taşır.

---

## 7. Migrasyon için özet (Supabase `basketball.*`)

**Taşınacak HAM veri** (yeniden türetilemez): tblPlayer, tblTeam, tblPlayers (kadro), Fixture, Table2025-2026 (h2h skor), Criteria, MarketTemplate.
**Yeniden türetilebilir** (analytics view / pipeline ile): TeamPTSModel, TeamProps, PlayerCalc, TakimOzet, TakimOyuncu, PlayerOutPut, TeamOutput.

Futbol tarafıyla paralel mimari önerisi:
- `basketball.player_match_stats` ← tblPlayer (ham kolonlar; türevler view'da)
- `basketball.team_match_stats` ← tblTeam
- `basketball.teams`, `basketball.players` (dim) ← Lists/Sheet4
- `basketball.fixtures` ← Fixture
- `basketball.market_templates` ← MarketTemplate
- `basketball.head_to_head` ← Table2025-2026 (opsiyonel; view'dan da türetilebilir)
- `analytics.bb_*` view'ları → usage/pace/rating + Monte-Carlo projeksiyon (ya da pipeline/edge fonksiyonu).

Veri profili: 16 takım, 240 maç, 301 oyuncu, hafta 1-32, 2025-26 sezonu.
