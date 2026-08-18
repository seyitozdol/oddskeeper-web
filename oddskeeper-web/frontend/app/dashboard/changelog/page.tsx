// Yenilikler (changelog) sayfasi. Gorunurlugu admin access'ten yonetilir
// (nav-permissions "changelog" anahtari + proxy path kilidi). Icerik son
// kullaniciya yararini anlatir bicimde ve IKI DILLIDIR (site dili EN/TR'yi
// izler); yeni entry eklerken en+tr birlikte yazilir.

import { TenText } from "@/components/TenBadge";
import { getLocale } from "@/lib/i18n/server";

type L = { en: string; tr: string };

type Entry = {
  date: L;
  title: L;
  tag?: L;
  items: L[];
};

const TAG_NEW: L = { en: "New", tr: "Yeni" };
const TAG_NEW_TOOL: L = { en: "New tool", tr: "Yeni araç" };

const ENTRIES: Entry[] = [
  {
    date: { en: "18 August", tr: "18 Ağustos" },
    title: { en: "Team profiles for European cups", tr: "Avrupa kupaları için takım profilleri" },
    tag: TAG_NEW,
    items: [
      {
        en: "Cup teams are now clickable too. Open a team's profile — Overview (form, an attribute radar versus the competition, per-match averages and season history), Squad and Results — with the same left-side tab menu as other team profiles. A toggle at the top links across to the same team's profile in the other cups and, for Süper Lig sides, to their league profile.",
        tr: "Kupa takımları da artık tıklanabilir. Bir takımın profilini açın — Genel Bakış (form, rakiplere göre yetenek radarı, maç başı ortalamalar ve sezon geçmişi), Kadro ve Sonuçlar — diğer takım profilleriyle aynı sol sekme menüsüyle. Üstteki geçiş menüsü, aynı takımın diğer kupalardaki profiline ve Süper Lig takımları için lig profiline bağlanır.",
      },
    ],
  },
  {
    date: { en: "18 August", tr: "18 Ağustos" },
    title: { en: "Player profiles for European cups", tr: "Avrupa kupaları için oyuncu profilleri" },
    tag: TAG_NEW,
    items: [
      {
        en: "Every player in the Champions, Europa and Conference League is now clickable. From the cup Players list or the rankings, open a full profile with the same left-side tab menu as other profiles — Overview (season stats, an attribute radar versus everyone in the competition, a rating chart), Detailed Stats and Match Log — and each match links straight to its detail page.",
        tr: "Şampiyonlar, Avrupa ve Konferans Ligi'ndeki her oyuncu artık tıklanabilir. Kupa Oyuncular listesinden veya sıralamalardan, diğer profillerle aynı sol sekme menülü tam profili açın — Genel Bakış (sezon istatistikleri, o kupadaki herkese göre yetenek radarı, reyting grafiği), Detaylı İstatistik ve Maç Logu — her maç doğrudan detay sayfasına bağlı.",
      },
      {
        en: "When a player features in more than one of these competitions — or also plays in the Süper Lig — a toggle at the top of the profile links straight across to their profile in each competition, so you can follow the same player everywhere without searching again.",
        tr: "Bir oyuncu bu kupalardan birden fazlasında yer alıyorsa — ya da Süper Lig'de de oynuyorsa — profilin üstündeki bir geçiş menüsü, o oyuncunun her rekabetteki profiline doğrudan bağlanır; böylece aynı oyuncuyu tekrar aramadan her yerde takip edebilirsiniz.",
      },
    ],
  },
  {
    date: { en: "17 August", tr: "17 Ağustos" },
    title: { en: "Player profiles now use the left-side tab menu", tr: "Oyuncu profilleri artık sol sekme menüsünü kullanıyor" },
    items: [
      {
        en: "Player profile pages now use the same left-side tab menu as team profiles — Overview, Detailed Stats, Advanced and Match Log sit in a vertical menu on the left instead of buttons in the top-right corner, so moving between sections is consistent across the site. The separate 'classic view' has been removed.",
        tr: "Oyuncu profil sayfaları artık takım profilleriyle aynı sol sekme menüsünü kullanıyor — Genel Bakış, Detaylı İstatistik, Gelişmiş ve Maç Logu, sağ üstteki butonlar yerine solda dikey bir menüde. Böylece bölümler arası geçiş sitenin her yerinde tutarlı. Ayrı 'klasik görünüm' kaldırıldı.",
      },
    ],
  },
  {
    date: { en: "17 August", tr: "17 Ağustos" },
    title: { en: "Cards metric reworked: red counts double, and bench cards no longer count", tr: "Kart metriği yenilendi: kırmızı iki sayılır ve benchten kartlar sayılmıyor" },
    items: [
      {
        en: "Everywhere a single 'Cards' number is shown (team tables, match stat comparisons, team discipline and the model's card line), it is now yellow + 2×red — a red card weighs as much as two yellows, so the number reflects true match discipline consistently across the site.",
        tr: "Tek bir 'Kart' değeri gösterilen her yerde (takım tabloları, maç istatistik karşılaştırmaları, takım disiplini ve modelin kart çizgisi) artık sarı + 2×kırmızı hesaplanıyor — bir kırmızı iki sarı kadar ağırlık taşıyor, böylece sayı sitenin her yerinde maç disiplinini tutarlı biçimde yansıtıyor.",
      },
      {
        en: "Player yellow and red card totals (Süper Lig and 1. Lig) now only count a card the player was shown while on the pitch. A booking given on the bench or after being substituted off no longer adds to that player's tally, so the card stats match what actually happened during play.",
        tr: "Oyuncu sarı ve kırmızı kart toplamları (Süper Lig ve 1. Lig) artık yalnızca oyuncunun sahadayken gördüğü kartı sayıyor. Yedek kulübesinde ya da oyundan çıktıktan sonra görülen bir kart artık o oyuncunun hanesine eklenmiyor; böylece kart istatistikleri sahada gerçekten olanı yansıtıyor.",
      },
    ],
  },
  {
    date: { en: "17 August", tr: "17 Ağustos" },
    title: { en: "Teams league averages, a reshaped Results tab, and match stats on click", tr: "Takımlar lig ortalaması, yenilenen Sonuçlar sekmesi ve tıklayınca maç istatistikleri" },
    items: [
      {
        en: "The Teams table (Süper Lig and 1. Lig) now has a bottom row showing the league average for the selected metric, across Avg, Last 5, Last 10 and last season (LY), so you can read each team against the league at a glance.",
        tr: "Takımlar tablosu (Süper Lig ve 1. Lig) artık en altta seçili metriğin lig ortalamasını gösteren bir satıra sahip; Avg, Son 5, Son 10 ve geçen sezon (LY) için. Böylece her takımı lig geneline göre bir bakışta okuyabilirsiniz.",
      },
      {
        en: "The Results tab is reshaped: week-by-week results now sit on the left with the most recent week at the top, and a compact standings table (rank, team, played, points) sits on the right. For the full table use the League tab.",
        tr: "Sonuçlar sekmesi yenilendi: hafta hafta sonuçlar artık solda ve en son hafta en üstte; sağda ise kompakt bir puan durumu tablosu (sıra, takım, oynanan, puan) var. Tüm tablo için League sekmesini kullanın.",
      },
      {
        en: "Clicking a finished match now opens its team stats: Shots, On target, Corners, Saves, Tackles, Throw-ins, Goal kicks, Fouls, Cards and Offsides, shown as a home-vs-away comparison. This is now on both Süper Lig and 1. Lig match pages (available for the current season on the Süper Lig side).",
        tr: "Biten bir maça tıklayınca artık takım istatistikleri açılıyor: Şut, İsabetli şut, Korner, Kurtarış, Müdahale, Taç, Kale vuruşu, Faul, Kart ve Ofsayt; ev sahibi ve deplasman karşılaştırması olarak. Bu artık hem Süper Lig hem 1. Lig maç sayfalarında var (Süper Lig tarafında güncel sezon için).",
      },
      {
        en: "The match detail page got a visual pass: the player performance table is now more compact so it fits without a side scrollbar, and the Süper Lig match page now uses the same layout as 1. Lig (team logos, score, stat comparison and player tables).",
        tr: "Maç detay sayfası görsel olarak elden geçti: oyuncu performans tablosu artık daha derli toplu ve yan kaydırma çubuğu olmadan sığıyor; Süper Lig maç sayfası da artık 1. Lig ile aynı düzeni kullanıyor (takım logoları, skor, istatistik karşılaştırması ve oyuncu tabloları).",
      },
    ],
  },
  {
    date: { en: "16 August", tr: "16 Ağustos" },
    title: { en: "Squad players with blank profiles now open with full stats", tr: "Profili boş açılan kadro oyuncuları artık tüm istatistikleriyle açılıyor" },
    items: [
      {
        en: "On team squad panels, many players (new signings and players without an Opta identity — e.g. John Lundstram, Moatasem Al-Musrati) linked to an empty profile: the name and photo showed but season stats and the match log were blank. The squad was linking them by one identity while their stats lived under another. Their identities are now bridged, so clicking a player from the squad opens the correct profile with appearances, minutes, form and match log. This also removes duplicate entries that some players had in team lists.",
        tr: "Takım kadro panellerinde birçok oyuncu (yeni transferler ve Opta kimliği olmayanlar — ör. John Lundstram, Moatasem Al-Musrati) boş profile bağlanıyordu: isim ve fotoğraf geliyor ama sezon istatistikleri ve maç logu boş kalıyordu. Kadro onları bir kimlikle linkliyor, istatistikleri ise başka bir kimlikte duruyordu. Kimlikler artık köprülendi; kadrodan bir oyuncuya tıklayınca doğru profil, maç sayısı, dakikalar, form ve maç loguyla açılıyor. Bu ayrıca bazı oyuncuların takım listelerindeki mükerrer görünmesini de düzeltiyor.",
      },
    ],
  },
  {
    date: { en: "16 August", tr: "16 Ağustos" },
    title: { en: "Standings, cup groups & transfers — a big refresh", tr: "Puan durumu, kupa grupları & transferler — büyük yenileme" },
    items: [
      {
        en: "The league Standings (Süper Lig and 1. Lig) now read like SofaScore: a coloured bar marks each team's zone with a legend underneath — Champions League, Champions League / Europa League / Conference League qualification and relegation for the Süper Lig; direct promotion, play-off and relegation for 1. Lig. Two new columns join the table: GLS (goals for:against, e.g. 77:30) and a Last 5 form strip (W/D/L).",
        tr: "Lig Puan Durumu (Süper Lig ve 1. Lig) artık SofaScore gibi: her takımın bölgesini renkli bir çubuk gösteriyor ve altında açıklaması var — Süper Lig'de Şampiyonlar Ligi, Şampiyonlar Ligi / Avrupa Ligi / Konferans Ligi elemesi ve küme düşme; 1. Lig'de direkt yükselme, play-off ve küme düşme. Tabloya iki kolon eklendi: GLS (attığı:yediği, ör. 77:30) ve Son 5 form şeridi (G/B/M).",
      },
      {
        en: "The Turkish Cup 'Cup Stages' screen drops the round-by-round bar chart. The knockout bracket now sits at the top, and below it the group stage shows a proper standings table (played, won, drawn, lost, goal difference, points) alongside the fixtures.",
        tr: "Türkiye Kupası 'Kupa Aşamaları' ekranından tur-tur bar grafiği kaldırıldı. Eleme bracket'i artık en üstte; altında grup aşaması, maçların yanında gerçek bir puan durumu tablosu (oynanan, galibiyet, beraberlik, mağlubiyet, averaj, puan) gösteriyor.",
      },
      {
        en: "Transfers are now split into Arrivals and Departures, each sorted by fee, and pulled fresh from Transfermarkt for both windows. Every transfer now carries the player's photo and both clubs' badges, and clicking a Süper Lig club opens its profile.",
        tr: "Transferler artık Gelenler ve Ayrılanlar olarak ikiye ayrıldı; her biri bonservise göre sıralı ve her iki pencere için Transfermarkt'tan güncellendi. Her transferde oyuncunun fotoğrafı ve iki kulübün arması var; bir Süper Lig kulübüne tıklayınca profili açılıyor.",
      },
    ],
  },
  {
    date: { en: "16 August", tr: "16 Ağustos" },
    title: { en: "Teams screen is now a table + a dedicated Transfers tab", tr: "Takımlar ekranı artık tablo + ayrı Transferler sekmesi" },
    items: [
      {
        en: "The Teams section (Süper Lig and 1. Lig) replaces the bar charts with a sortable table. Pick a metric from the main market buttons (Shots, SOT, Throw-ins, Saves, Fouls, Corners, Cards, Offsides, Tackles, Goal Kicks) or the dropdown of every other team metric, and toggle Total vs Per-match at the top right. Each row shows the team's Last 5, Last 10 and last-season (LY) average plus its league rank for that metric, with team logos and clickable names.",
        tr: "Takımlar bölümü (Süper Lig ve 1. Lig) bar grafiklerini sıralanabilir bir tabloyla değiştiriyor. Metriği ana market butonlarından (Şut, İsabetli Şut, Taç, Kurtarış, Faul, Korner, Kart, Ofsayt, Müdahale, Kale Vuruşu) ya da diğer tüm takım metriklerinin bulunduğu açılır menüden seç; sağ üstten Toplam ve Maç başına arasında geçiş yap. Her satır takımın o metrikteki Son 5, Son 10 ve geçen sezon (LY) ortalamasını ve lig sırasını gösteriyor; takım logoları ve tıklanabilir isimlerle.",
      },
      {
        en: "Transfers moved out of the Teams screen into their own tab, between Team Rankings and the models. (Süper Lig only — 1. Lig has no transfer data.)",
        tr: "Transferler, Takımlar ekranından çıkıp kendi sekmesine taşındı — Team Rankings ile modeller arasında. (Sadece Süper Lig; 1. Lig'de transfer verisi yok.)",
      },
    ],
  },
  {
    date: { en: "16 August", tr: "16 Ağustos" },
    title: { en: "Fixture pickers: real kick-off times & nearest-first order", tr: "Fikstür seçici: gerçek maç saatleri & en yakın maç üstte" },
    items: [
      {
        en: "Fixtures now carry their real kick-off date and time. The Süper Lig fixture list was using placeholder times (every match at 17:00/18:00) and sometimes the wrong day; it now reads the actual kick-off straight from live match data. 1. Lig already had real times.",
        tr: "Fikstürler artık gerçek maç günü ve saatiyle geliyor. Süper Lig fikstür listesi placeholder saatler kullanıyordu (her maç 17:00/18:00) ve bazen yanlış gün gösteriyordu; artık gerçek başlama saatini doğrudan canlı maç verisinden okuyor. 1. Lig'de saatler zaten gerçekti.",
      },
      {
        en: "In the Match Stats Model and Player Market, the fixture list is now ordered by kick-off with the nearest match at the top (instead of round order), and each match drops to the bottom on its own once it has finished — no more waiting for the whole matchweek to end. Manually added fixtures always stay pinned at the top.",
        tr: "Match Stats Model ve Player Market'te fikstür listesi artık başlama saatine göre, en yakın maç en üstte sıralanıyor (round sırası yerine) ve her maç bittiğinde tek tek en alta iniyor — tüm haftanın bitmesini beklemek yok. Elle eklenen fikstürler her zaman en üstte sabit kalıyor.",
      },
      {
        en: "Player Market fixtures now show their round number (R1, R2 …) in the picker.",
        tr: "Player Market fikstürlerinde artık seçicide hafta numarası (R1, R2 …) görünüyor.",
      },
      {
        en: "In the Fixture ID tab, once a match has kicked off its 1X2 odds fields are locked, so you can't accidentally enter live or stale odds for a match already in play.",
        tr: "Fixture ID sekmesinde bir maç başladığında 1X2 oran alanları kilitleniyor; oynanmakta olan bir maça yanlışlıkla canlı/bayat oran girilemiyor.",
      },
    ],
  },
  {
    date: { en: "15 August", tr: "15 Ağustos" },
    title: { en: "Player Market: current-season Avg is back", tr: "Player Market: güncel sezon Avg'si geri geldi" },
    items: [
      {
        en: "In Player Market, picking a fixture showed only the LY (last-year) average — the current-season Avg column was empty even for teams that had already played, and didn't fill as matches were played. The Avg column was reading from last season's data source, which has no 2026/2027 data. It now reads the current season straight from live match data, so Avg fills in from each team's first match and updates as more are played, across every market in the list.",
        tr: "Player Market'te bir fikstür seçince yalnız LY (geçen yıl) ortalaması geliyordu; güncel sezon Avg kolonu maç oynamış takımlarda bile boştu ve maç oynandıkça dolmuyordu. Avg kolonu geçen sezonun veri kaynağından okuyordu ve orada 2026/2027 verisi yok. Artık güncel sezonu doğrudan canlı maç verisinden okuyor; Avg her takımın ilk maçından itibaren doluyor ve maç oynandıkça güncelleniyor, listedeki her market için.",
      },
      {
        en: "New signings are included too: a player with no Süper Lig history is now linked to the live data by name and date of birth, so their current-season Avg shows even before we have a full profile for them.",
        tr: "Yeni transferler de dahil: Süper Lig geçmişi olmayan oyuncu artık isim ve doğum tarihiyle canlı veriye bağlanıyor, tam profili oluşmadan bile güncel sezon Avg'si görünüyor.",
      },
    ],
  },
  {
    date: { en: "15 August", tr: "15 Ağustos" },
    title: { en: "New-season players no longer go missing", tr: "Yeni sezon oyuncuları artık kaybolmuyor" },
    items: [
      {
        en: "In the season opener (Galatasaray 2-2 Çorum FK) only Osimhen's two goals showed up. Players were being matched to our historical player database, so anyone with no Süper Lig history — new signings and the whole squad of a promoted club — was dropped from every stat page. Çorum's two scorers vanished that way. Every player now gets an identity of their own, so new arrivals appear from their very first match. Season stats, rankings and team pages are rebuilt right after each match instead of waiting for the next day.",
        tr: "Sezonun ilk maçında (Galatasaray 2-2 Çorum FK) sadece Osimhen'in iki golü görünüyordu. Oyuncular geçmiş sezon oyuncu veritabanımızla eşleştiriliyordu; Süper Lig geçmişi olmayan herkes, yani yeni transferler ve yükselen takımın tüm kadrosu, istatistik sayfalarından düşüyordu. Çorum'un iki golcüsü de böyle kaybolmuştu. Artık her oyuncunun kendi kimliği var; yeni gelenler ilk maçlarından itibaren görünüyor. Sezon istatistikleri, sıralamalar ve takım sayfaları da ertesi günü beklemeden maçtan hemen sonra güncelleniyor.",
      },
      {
        en: "Yellow and red cards, xG and xA had also disappeared from Süper Lig pages for every season; they are back.",
        tr: "Süper Lig sayfalarında tüm sezonlarda kaybolan sarı/kırmızı kart, xG ve xA verileri de geri geldi.",
      },
      {
        en: "Squad Audit's \"Missing from us\" list went from 321 players to 10. Every signing Transfermarkt showed but we didn't have is now in their club's squad with a real player card: photo, nationality, height, shirt number, age and market value, filled from SofaScore's current squad lists. This runs daily, so future transfers land on the site without waiting for their first match.",
        tr: "Squad Audit'teki \"Bizde olmayan\" listesi 321 oyuncudan 10'a indi. Transfermarkt'ta olup bizde olmayan her transfer artık kulübünün kadrosunda ve gerçek bir oyuncu kartı var: fotoğraf, uyruk, boy, forma numarası, yaş ve piyasa değeri, SofaScore'un güncel kadro listelerinden dolduruluyor. Bu iş her gün çalışıyor, yani bundan sonraki transferler ilk maçlarını beklemeden siteye giriyor.",
      },
      {
        en: "A team's Player Stats tab now lists everyone who took the field, substitutes included. It used to hide anyone below the league ranking cut-off (30% of the season's highest minutes), which in the opening week meant every player with under 27 minutes vanished from their own club's page. League-wide Player Rankings keep the cut-off, as they should.",
        tr: "Takım sayfasındaki Oyuncu İstatistikleri sekmesi artık sahaya çıkan herkesi listeliyor, sonradan girenler dahil. Önceden lig sıralaması eşiğinin (sezonun en yüksek dakikasının %30'u) altında kalan gizleniyordu; sezonun ilk haftasında bu, 27 dakikanın altında oynayan herkesin kendi kulübünün sayfasından düşmesi demekti. Lig geneli Oyuncu Sıralamaları'nda eşik olması gerektiği gibi duruyor.",
      },
      {
        en: "New players now have full profile pages too: click a name anywhere in the Süper Lig section and you get their photo, nationality, position, shirt number, season stats and match log, exactly like established players. Profile pages also roll over to 2026/2027 as soon as a player takes the field, instead of staying stuck on last season.",
        tr: "Yeni oyuncuların artık tam profil sayfası da var: Süper Lig bölümünde herhangi bir isme tıkladığında fotoğrafı, uyruğu, mevkisi, forma numarası, sezon istatistikleri ve maç logu, eski oyuncularla aynı şekilde geliyor. Profil sayfaları da oyuncu sahaya çıkar çıkmaz 2026/2027'ye geçiyor, geçen sezonda takılı kalmıyor.",
      },
      {
        en: "The Player Stats tab was permanently empty for clubs whose name contains the Turkish dotless 'ı' — Kasımpaşa, Bandırmaspor, Şanlıurfaspor, Aydınspor and others. A name-matching step mishandled that one letter, so those squads never lined up with their own page. Fixed. (A separate timing gap could also leave a team briefly empty right after its match if our secondary source published later; the post-match rebuild now fires from the primary source too, so both sides fill in together.)",
        tr: "Adında Türkçe noktasız 'ı' geçen kulüplerde Oyuncu İstatistikleri sekmesi kalıcı olarak boştu: Kasımpaşa, Bandırmaspor, Şanlıurfaspor, Aydınspor ve diğerleri. Bir isim eşleştirme adımı bu tek harfi yanlış işliyordu, o yüzden bu kadrolar kendi sayfalarıyla hiç eşleşmiyordu. Düzeltildi. (Ayrı bir zamanlama boşluğu da, ikincil kaynağımız geç yayınladığında bir takımı maçının hemen ardından kısa süre boş bırakabiliyordu; maç-sonrası güncelleme artık ana kaynaktan da tetikleniyor, iki taraf birlikte doluyor.)",
      },
      {
        en: "The Player Stats tab on a team's page is much faster. Picking a metric from the dropdown used to take several seconds because each change re-read the entire player database; it now reads only that squad, so the table updates almost instantly.",
        tr: "Takım sayfasındaki Oyuncu İstatistikleri sekmesi çok daha hızlı. Açılır menüden metrik seçmek eskiden birkaç saniye sürüyordu; her değişiklik tüm oyuncu veritabanını yeniden okuyordu. Artık yalnız o kadroyu okuyor, tablo neredeyse anında güncelleniyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Cup Match Stats Model — Saves market & clearer estimates", tr: "Kupa Match Stats Model — Saves marketi & şeffaf tahminler" },
    tag: TAG_NEW,
    items: [
      {
        en: "The Saves market now works in the cup model. Team-level save data isn't reported for cup matches, so for teams without it we estimate saves from the shots on target they face, using the real save rate measured across two seasons of Süper Lig and 1. Lig (about 68% of on-target shots become a save). These estimated figures are clearly flagged with an \"≈ estimate\" note under the market, so you always know which numbers are derived rather than measured.",
        tr: "Kupa modelinde artık Saves marketi çalışıyor. Kupa maçları için takım-seviyesi kurtarış verisi yayınlanmıyor; bu yüzden verisi olmayan takımlarda kurtarışı, yedikleri isabetli şuttan tahmin ediyoruz — Süper Lig ve 1. Lig'in iki sezonundan ölçülen gerçek kurtarış oranıyla (isabetli şutların yaklaşık %68'i kurtarışa dönüyor). Bu tahmini değerler market altında \"≈ tahmini\" notuyla açıkça işaretleniyor; hangi sayının ölçüm değil türetme olduğunu her zaman görürsün.",
      },
      {
        en: "Cup team logos in the Match Stats Model no longer break for lower-league and amateur clubs — they now load from the same source as the rest of the cup.",
        tr: "Match Stats Model'deki kupa takım logoları alt lig ve amatör kulüplerde artık kırık gelmiyor; kupanın geri kalanıyla aynı kaynaktan yükleniyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup — polish & Match Stats Model", tr: "Türkiye Kupası — iyileştirmeler & Match Stats Model" },
    tag: TAG_NEW,
    items: [
      {
        en: "Team logos across Cup Stages now load reliably, match pages show every available statistic (possession, xG, throw-ins, duels, clearances and more), and the cup shows a round-by-round chart instead of a league table (which doesn't fit a knockout). The Match Stats Model is now available for the cup too, built from each team's home/away cup numbers.",
        tr: "Cup Stages'teki takım logoları artık düzgün yükleniyor, maç sayfaları mevcut tüm istatistikleri gösteriyor (topa sahip olma, xG, taç, ikili mücadele, uzaklaştırma ve daha fazlası) ve kupada lig tablosu yerine tur bazlı grafik var (eleme usulüne lig tablosu uymuyor). Match Stats Model artık kupada da var; her takımın ev/deplasman kupa sayılarından kuruluyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup — Players & Rankings", tr: "Türkiye Kupası — Oyuncular & Sıralamalar" },
    tag: TAG_NEW,
    items: [
      {
        en: "The Cup now has Players and Player Rankings tabs, with per-player cup stats (goals, xG, shots, key passes, tackles, duels, and more) pulled match by match. Coverage grows from the quarter-finals back through the group stage; data is still filling in for earlier rounds.",
        tr: "Kupada artık Oyuncular ve Oyuncu Sıralamaları sekmeleri var; oyuncu-başı kupa istatistikleri (gol, xG, şut, kilit pas, top kapma, ikili mücadele ve daha fazlası) maç maç çekiliyor. Kapsam çeyrek finalden grup aşamasına doğru genişliyor; erken turlar için veri hâlâ doluyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup — team & player pages", tr: "Türkiye Kupası — takım & oyuncu sayfaları" },
    tag: TAG_NEW,
    items: [
      {
        en: "Every cup team and player now has a page — including lower-league and amateur clubs that aren't in our leagues — with logos and player photos. Clicking a team or match opens its profile: team pages show results, cup stats and squad; match pages show the full stat comparison (possession, xG, throw-ins, fouls...).",
        tr: "Artık her kupa takımının ve oyuncusunun bir sayfası var — liglerimizde olmayan alt lig ve amatör kulüpler dahil — logolar ve oyuncu fotoğraflarıyla. Takıma ya da maça tıklayınca profili açılıyor: takım sayfalarında sonuçlar, kupa istatistikleri ve kadro; maç sayfalarında tam istatistik karşılaştırması (topa sahip olma, xG, taç, faul...).",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup — first tabs live", tr: "Türkiye Kupası — ilk sekmeler yayında" },
    tag: TAG_NEW,
    items: [
      {
        en: "The Cup section now opens on a Cup Stages view (round-by-round bracket), plus Results, Teams, Team Rankings and Referees — covering the last two seasons, all rounds including group stages. Player-side tabs (Players, Rankings, models) are being prepared next.",
        tr: "Kupa bölümü artık Cup Stages görünümüyle açılıyor (tur tur bracket); ayrıca Results, Teams, Team Rankings ve Referees sekmeleri geldi — son iki sezon, grup aşamaları dahil tüm turlar. Oyuncu tarafı sekmeler (Players, sıralamalar, modeller) sırada.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup section", tr: "Türkiye Kupası bölümü" },
    tag: TAG_NEW,
    items: [
      {
        en: "A new \"Cup\" shortcut has been added to the header (after 1.Lig). The last two seasons of the Turkish Cup (all rounds, including early and group stages) have been loaded with full match statistics.",
        tr: "Header'a (1.Lig'den sonra) yeni bir \"Kupa\" kısayolu eklendi. Türkiye Kupası'nın son iki sezonu (erken ve grup aşamaları dahil tüm turlar) tam maç istatistikleriyle yüklendi.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Season History fix", tr: "Season History düzeltmesi" },
    items: [
      {
        en: "Duplicate season rows (2025/2026 shown twice) are removed, and the \"Current\" badge now follows the calendar season; it will move to 2026/2027 as soon as the new season's first matches arrive.",
        tr: "Mükerrer sezon satırları (iki kez görünen 2025/2026) kaldırıldı; \"Current\" rozeti artık takvim sezonunu izliyor, yeni sezonun ilk maçları gelir gelmez 2026/2027'ye geçecek.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Team fixtures: all competitions", tr: "Takım fikstürü: tüm turnuvalar" },
    tag: TAG_NEW,
    items: [
      {
        en: "The Fixture tab now lists European cup matches too (e.g. Fenerbahçe vs Lyon in the Champions League); Turkish Cup matches will appear the same way when the draw is made.",
        tr: "Fixture sekmesi artık Avrupa kupası maçlarını da listeliyor (ör. Şampiyonlar Ligi'nde Fenerbahçe - Lyon); kura çekilince Türkiye Kupası maçları da aynı şekilde gelecek.",
      },
      {
        en: "Duplicate rows and wrong dates are fixed: each match appears once with its real date and kickoff time.",
        tr: "Mükerrer satırlar ve yanlış tarihler düzeltildi: her maç gerçek tarihi ve başlama saatiyle bir kez görünüyor.",
      },
      {
        en: "Opponent logos and competition logos were added to the list (league, Champions League, Europa League...).",
        tr: "Listeye rakip takım logoları ve turnuva logoları eklendi (lig, Şampiyonlar Ligi, Avrupa Ligi...).",
      },
      {
        en: "The season selector on the Fixture tab is removed; past seasons already live in Results.",
        tr: "Fixture sekmesindeki sezon seçici kaldırıldı; geçmiş sezonlar zaten Results'ta.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Squad Audit", tr: "Kadro Denetimi" },
    tag: TAG_NEW,
    items: [
      {
        en: "A new header icon (right of What's New, open to everyone) opens a 3-tab audit page: players in our squads but not on Transfermarkt, players on Transfermarkt but missing from us, and players without a participant id; TSL + 1. Lig, grouped by team.",
        tr: "Header'a yeni bir ikon geldi (What's New'un sağında, herkese açık): 3 sekmeli denetim sayfası açıyor: bizde olup Transfermarkt'ta olmayanlar, TM'de olup bizde olmayanlar ve participant id'si olmayanlar; TSL + 1. Lig, takım bazında gruplu.",
      },
      {
        en: "The lists refresh automatically after the morning Transfermarkt run.",
        tr: "Listeler sabahki Transfermarkt koşusundan sonra otomatik tazeleniyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: {
      en: "Team pages: Overview, Player Stats and cleanup",
      tr: "Takım sayfaları: Genel Bakış, Oyuncu İstatistikleri ve sadeleşme",
    },
    tag: TAG_NEW,
    items: [
      {
        en: "The team logo and name now sit at the top of the left menu; the separate header box that reloaded on every tab is gone. \"Team Statistics\" is renamed Overview and note-taking lives there (via the hero logo).",
        tr: "Takım logosu ve adı artık sol menünün üstünde; her sekmede yeniden gelen ayrı başlık kutusu kaldırıldı. \"Team Statistics\" sekmesinin adı Genel Bakış oldu; not ekleme oradaki büyük logo üzerinden yapılıyor.",
      },
      {
        en: "New Player Stats tab on both TSL and 1. Lig team pages: pick a metric and season, players sort by it, with photos and nationality flags.",
        tr: "Hem TSL hem 1. Lig takım sayfalarına yeni Oyuncu İstatistikleri sekmesi: metrik ve sezon seç, oyuncular ona göre sıralansın; fotoğraf ve uyruk bayraklarıyla.",
      },
      {
        en: "Classic view is removed; the showcase design is the only team view now.",
        tr: "Classic görünüm kaldırıldı; takım sayfası artık yalnız vitrin tasarımıyla çalışıyor.",
      },
      {
        en: "The TSL and 1. Lig icons in the header also render white on dark themes.",
        tr: "Header'daki TSL ve 1. Lig ikonları da koyu temalarda beyaz görünüyor.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Süper Lig team page: left menu", tr: "Süper Lig takım sayfası: sol menü" },
    items: [
      {
        en: "The Süper Lig team page got the same layout as 1. Lig: all tabs (Team Statistics, Squad, Results, Fixture...) moved into the fixed left mini menu; the \"Back to teams\" button is removed.",
        tr: "Süper Lig takım sayfası da 1. Lig ile aynı düzene geçti: tüm sekmeler (Team Statistics, Squad, Results, Fixture...) sabit sol mini menüye taşındı; \"Back to teams\" butonu kaldırıldı.",
      },
      {
        en: "League logos next to team names are bigger and render flat white on dark themes (colored on light), so they stay readable everywhere.",
        tr: "Takım adının yanındaki lig logoları büyütüldü; koyu temalarda düz beyaz, açık temada renkli görünüyor, her yerde okunur.",
      },
      {
        en: "Left menu items have small icons in the same color as the text.",
        tr: "Sol menü öğelerinin yanında metinle aynı renkte küçük ikonlar var.",
      },
    ],
  },
  {
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "1. Lig team page cleanup", tr: "1. Lig takım sayfası sadeleşti" },
    items: [
      {
        en: "The back button and the \"Trendyol 1. Lig\" pill at the top are removed; the \"TFF 1. Lig\" label above the team name is replaced with the league logo next to the name.",
        tr: "Üstteki geri butonu ve \"Trendyol 1. Lig\" rozeti kaldırıldı; takım adının üzerindeki \"TFF 1. Lig\" yazısı yerine adın yanında lig logosu görünüyor.",
      },
      {
        en: "Overview / Fixtures / Squad / Results moved from top tabs into a small left menu with dividers; it stays fixed in place while switching sections.",
        tr: "Genel Bakış / Fikstür / Kadro / Sonuçlar üst sekmelerden, bölücü çizgili küçük bir sol menüye taşındı; bölümler arasında gezerken yerinde sabit kalıyor.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "Team squad panels", tr: "Takım kadro panelleri" },
    items: [
      {
        en: "The squad tab's left panel grew: a large logo like the team showcase, position distribution badges, total and per-player market value, most valuable player and website link.",
        tr: "Kadro sekmesindeki sol panel genişledi: vitrin sayfasındaki gibi büyük logo, pozisyon dağılımı rozetleri, toplam ve oyuncu başına piyasa değeri, en değerli oyuncu ve site linki.",
      },
      {
        en: "The same squad design came to 1. Lig team pages too: team info panel on the left, player cards with photo, flag, age and market value grouped by position; the season stats table stays below.",
        tr: "Aynı kadro tasarımı 1. Lig takım sayfalarına da geldi: solda takım bilgi paneli, pozisyona gruplu foto/bayrak/yaş/piyasa değeri kartları; sezon istatistik tablosu altta duruyor.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "Squad view redesign", tr: "Kadro görünümü yenilendi" },
    tag: TAG_NEW,
    items: [
      {
        en: "The team squad tab has a new layout: the left third is an always-open team info panel (logo, founded, stadium, capacity, head coach, squad size, average age, foreign players, total market value); the remaining two thirds list the players.",
        tr: "Takım kadro sekmesi yeni düzende: ekranın ilk üçte biri hep açık takım bilgi paneli (logo, kuruluş, stadyum, kapasite, teknik direktör, kadro genişliği, yaş ortalaması, yabancı sayısı, toplam piyasa değeri); kalan iki parça oyuncu listesi.",
      },
      {
        en: "Player cards show photo, nationality flag, position, age, shirt number and Transfermarkt market value, grouped by position.",
        tr: "Oyuncu kartlarında fotoğraf, uyruk bayrağı, mevki, yaş, forma numarası ve Transfermarkt piyasa değeri var; pozisyona göre gruplu.",
      },
      {
        en: "The \"Football Team Stats\" label next to the logo is removed from team pages.",
        tr: "Takım sayfalarında logonun yanındaki \"Football Team Stats\" yazısı kaldırıldı.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "Upcoming Events tweaks", tr: "Yaklaşan Maçlar iyileştirmeleri" },
    items: [
      {
        en: "Priority stars are left-aligned in their column.",
        tr: "Öncelik yıldızları kolonda sola hizalandı.",
      },
      {
        en: "\"Hide low profile\" is now a per-user preference: your choice is saved to your account and restored on every visit, without affecting anyone else.",
        tr: "\"Hide low profile\" artık kullanıcı bazlı bir tercih: seçimin hesabına kaydediliyor ve her girişte geri yükleniyor, başkasının görünümünü etkilemiyor.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "Player Rankings polish", tr: "Player Rankings iyileştirmeleri" },
    items: [
      {
        en: "Player rows now show the player photo and nationality flag (like the Players section), and team logos appear next to team names (Süper Lig + 1. Lig).",
        tr: "Oyuncu satırlarında artık oyuncu fotoğrafı ve bayrağı görünüyor (Players bölümündeki gibi); takım adlarının yanına takım logoları eklendi (Süper Lig + 1. Lig).",
      },
      {
        en: "Metric names in the dropdown are properly translated; Turkish labels like \"Ortalama Reyting\" no longer appear in the English interface.",
        tr: "Metrik adları dropdown'da düzgün çevriliyor; İngilizce arayüzde \"Ortalama Reyting\" gibi Türkçe etiketler artık çıkmıyor.",
      },
      {
        en: "A search box was added above the rankings table; it filters by player or team name as you type.",
        tr: "Sıralama tablosunun üstüne arama kutusu eklendi; yazdıkça oyuncu veya takım adına göre filtreliyor.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "UI and squad fixes", tr: "Arayüz ve kadro düzeltmeleri" },
    items: [
      {
        en: "The bookmaker name is no longer written out anywhere on the site; the green 10 badge is used instead.",
        tr: "Sitede marka adı artık metin olarak geçmiyor; her yerde yeşil 10 rozeti kullanılıyor.",
      },
      {
        en: "Fixed the same team appearing twice in the Player Stats Model player list (Amed) and duplicated squad players (e.g. R. Raveloson / Rayan Raveloson); new signings' bio, market value and last-year stats are merged into a single profile.",
        tr: "Player Stats Model oyuncu listesinde aynı takımın iki kez görünmesi (Amed) ve kadrolardaki mükerrer oyuncular (ör. R. Raveloson / Rayan Raveloson) düzeltildi; yeni transferlerin bilgi, piyasa değeri ve geçen yıl verileri tek profilde birleşti.",
      },
      {
        en: "What's New now follows the site language (EN/TR).",
        tr: "Yenilikler sayfası artık site dilini izliyor (EN/TR).",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: {
      en: "Match Stats Model: match deadline and week archive",
      tr: "Maç İstatistik Modeli: maç deadline'ı ve hafta arşivi",
    },
    tag: TAG_NEW,
    items: [
      {
        en: "The Bets10 odds and fixture id feed stops updating a match once it kicks off: the last pre-match odds are frozen, so live/settled prices (like 1.00) no longer leak into suggestions.",
        tr: "Bets10 oran ve fixture id beslemesi, maç başladıktan sonra o maç için güncellenmiyor: son maç-öncesi oran donuyor, canlı/sonuçlanmış oranlar (1.00 gibi) artık öneriye sızmıyor.",
      },
      {
        en: "On the Fixture tab, suggestions and Apply are hidden for matches that already started; \"Fill from Bets10\" skips them.",
        tr: "Fixture sekmesinde başlamış maçlarda Bets10 önerisi ve Apply gizleniyor; \"Bets10'dan doldur\" bu maçları atlıyor.",
      },
      {
        en: "In the round list, completed weeks (last match already kicked off) drop to the bottom and the tab opens on the first active week. TFF 1. Lig now lists all 37 rounds.",
        tr: "Round listesinde tamamlanan haftalar (son maçın başlama saati geçen) en alta iniyor; sekme ilk aktif haftayla açılıyor. 1. Lig'de artık 37 haftanın tamamı listeleniyor.",
      },
      {
        en: "In the Model tab match list, completed weeks move into an Archive group at the bottom; the first active week's match is selected on open.",
        tr: "Model sekmesindeki maç listesinde tamamlanan haftanın maçları en altta Arşiv grubuna taşınıyor; açılışta ilk aktif haftanın maçı seçili geliyor.",
      },
      {
        en: "Deleting a manual match on the Fixture tab now asks for confirmation (Delete? Yes/No).",
        tr: "Fixture sekmesinde manuel maç silerken artık onay soruluyor (Sil? Evet/Vazgeç).",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: {
      en: "Player Stats Model: persistent status and LY fix",
      tr: "Oyuncu Market Modeli: kalıcı durum ve LY düzeltmesi",
    },
    items: [
      {
        en: "Manually changed player status (Starter/Sub/Out) is now persistent: it survives leaving the page or switching matches (Süper Lig + 1. Lig).",
        tr: "Model'de elle değiştirilen oyuncu durumu (Starter/Sub/Out) artık kalıcı: sayfadan çıkıp girince veya maç değiştirince seçimin korunuyor (Süper Lig + 1. Lig).",
      },
      {
        en: "Fixed last-year averages for new signings: players whose squad identity was updated (e.g. Salah) showed an empty LY Avg; their foreign-season data is reconnected.",
        tr: "Yeni transferlerin geçen yıl ortalaması düzeltildi: kadro kimliği güncellenen oyuncularda (ör. Salah) LY Avg boş görünüyordu, yurt dışı sezon verisi yeniden bağlandı.",
      },
    ],
  },
  {
    date: { en: "12 August", tr: "12 Ağustos" },
    title: { en: "League page: Fixtures panel", tr: "Lig sayfası: Fixtures paneli" },
    items: [
      {
        en: "The Fixtures panel in the League section no longer keeps showing played matches; once a week finishes, the next week's matches are listed automatically.",
        tr: "League bölümündeki Fixtures paneli oynanmış maçları göstermeye devam etmiyor; hafta bitince otomatik olarak bir sonraki haftanın maçları listeleniyor.",
      },
    ],
  },
  {
    date: { en: "11 August", tr: "11 Ağustos" },
    title: {
      en: "Match Stats Model: shot family suggestions",
      tr: "Maç İstatistik Modeli: şut ailesi önerileri",
    },
    tag: TAG_NEW,
    items: [
      {
        en: "When you enter a manual home/away value in the Shot market, the same change ratio is suggested for SOT, Saves and Goal Kick; one click on Apply uses it.",
        tr: "Shot marketinde elle ev/deplasman değeri girince, aynı değişim oranı SOT, Saves ve Goal Kick marketlerine öneri olarak yansıyor; Apply ile tek tıkla uygulanıyor.",
      },
      {
        en: "Direction rule: SOT moves on the same side; Saves and Goal Kick on the opposite side (more home shots means more away keeper saves and away goal kicks).",
        tr: "Yön kuralı: SOT aynı tarafta değişir; Saves ve Goal Kick karşı tarafta (ev şutu artarsa deplasman kalecisinin kurtarışı ve deplasmanın aut vuruşu artar).",
      },
      {
        en: "Suggestions come only from changes in Shot; manual edits in other markets do not create suggestions.",
        tr: "Öneri yalnızca Shot'taki değişiklikten üretilir; başka bir markette elle değişiklik yapmak öneri doğurmaz.",
      },
    ],
  },
  {
    date: { en: "11 August", tr: "11 Ağustos" },
    title: { en: "Basketball team metrics", tr: "Basketbol takım metrikleri" },
    items: [
      {
        en: "Team metrics are now aligned one-to-one with the Excel model: rebound projection is tied to the missed-shot model, last-10-match form blends with the season average, and the points calculation is fixed.",
        tr: "Takım metrikleri Excel modeliyle birebir hizalandı: ribaund tahmini kaçan şut modeline bağlandı, son 10 maç formu sezon ortalamasıyla harmanlanıyor, puan hesabı sabitlendi.",
      },
    ],
  },
  {
    date: { en: "11 August", tr: "11 Ağustos" },
    title: { en: "Speed and player photos", tr: "Hız ve oyuncu fotoğrafları" },
    items: [
      {
        en: "Player Market Model pages are noticeably faster.",
        tr: "Oyuncu Market Modeli sayfaları belirgin hızlandı.",
      },
      {
        en: "Missing player photos are filled in and now served from our own server; player card bios (age, height, position) are completed.",
        tr: "Eksik oyuncu fotoğrafları tamamlandı ve artık kendi sunucumuzdan yükleniyor; oyuncu kartlarındaki biyografi bilgileri (yaş, boy, mevki) dolduruldu.",
      },
      {
        en: "Player cards also list past seasons played abroad.",
        tr: "Oyuncu kartında yurt dışında oynanmış geçmiş sezonlar da listeleniyor.",
      },
      {
        en: "The football team stats page shows only current Süper Lig teams.",
        tr: "Futbol takım istatistikleri sayfasında yalnız güncel Süper Lig takımları görünüyor.",
      },
    ],
  },
  {
    date: { en: "10 August", tr: "10 Ağustos" },
    title: {
      en: "Match Stats Model improvements",
      tr: "Maç İstatistik Modeli iyileştirmeleri",
    },
    items: [
      {
        en: "Config was redesigned: settings are split into 4 sub-tabs with topic-based cards.",
        tr: "Config yeniden tasarlandı: ayarlar 4 alt sekmeye ve konu bazlı kartlara ayrıldı.",
      },
      {
        en: "New Markets sub-tab: per-market line count, under and payback control for 1st/2nd half.",
        tr: "Markets alt sekmesi geldi: her market için 1. yarı / 2. yarı bazında line, under ve payback kontrolü.",
      },
      {
        en: "Manual fixtures support a \"similar team\" mapping for opponents outside the league: run the model for a European tie by mapping the opponent to a league team.",
        tr: "Manuel fikstürde ligde olmayan rakip için \"benzer takım\" eşlemesi: Avrupa maçında rakibi lig takımlarından birine benzeterek modeli çalıştırabiliyorsun.",
      },
    ],
  },
  {
    date: { en: "10 August", tr: "10 Ağustos" },
    title: {
      en: "Player Market Model: in-box/out-box shots",
      tr: "Oyuncu Market Modeli: kutu içi/dışı şut",
    },
    tag: TAG_NEW,
    items: [
      {
        en: "Shot map data is connected: in-box and out-box shots-on-target markets are added (Süper Lig + 1. Lig).",
        tr: "Şut haritası verisi bağlandı: kutu içi ve kutu dışı isabetli şut marketleri eklendi (Süper Lig + 1. Lig).",
      },
      {
        en: "Player cards show SOT in-box/out-box season history.",
        tr: "Oyuncu kartında SOT kutu içi/dışı sezon geçmişi görünüyor.",
      },
      {
        en: "New/Save buttons moved to the top of the market list; a bug in the new-market flow is fixed.",
        tr: "Market listesinde New/Save butonları üste alındı; yeni market oluşturma akışındaki hata düzeltildi.",
      },
    ],
  },
  {
    date: { en: "10 August", tr: "10 Ağustos" },
    title: {
      en: "Showcase design: match and team pages",
      tr: "Vitrin tasarımı: maç ve takım sayfaları",
    },
    items: [
      {
        en: "Match pages and team profiles (Süper Lig + 1. Lig) moved to the new showcase design and it became the default view.",
        tr: "Maç sayfaları ve takım profilleri (Süper Lig + 1. Lig) yeni vitrin tasarımına geçti ve varsayılan görünüm oldu.",
      },
    ],
  },
  {
    date: { en: "10 August", tr: "10 Ağustos" },
    title: {
      en: "Upcoming Events: fourth odds source",
      tr: "Yaklaşan Maçlar: dördüncü oran kaynağı",
    },
    items: [
      {
        en: "BMBets joined the odds comparison; matches now show odds from four sources.",
        tr: "Oran karşılaştırmasına BMBets eklendi; maçlar artık dört kaynaktan gelen oranlarla görünüyor.",
      },
    ],
  },
  {
    date: { en: "10 August", tr: "10 Ağustos" },
    title: { en: "New transfers", tr: "Yeni transferler" },
    items: [
      {
        en: "Squads are compared daily with Transfermarkt: new signings are added automatically and departures are flagged.",
        tr: "Kadrolar her gün Transfermarkt ile kıyaslanıyor: yeni transferler kadroya otomatik ekleniyor, ayrılanlar işaretleniyor.",
      },
      {
        en: "Last-season data for new signings is fetched from foreign leagues; the last-year average in the Player Market Model is no longer empty.",
        tr: "Yeni transferlerin geçen sezon verileri yurt dışı liglerinden çekiliyor; Oyuncu Market Modeli'nde geçen yıl ortalaması boş kalmıyor.",
      },
    ],
  },
  {
    date: { en: "9 August", tr: "9 Ağustos" },
    title: { en: "Menu and page layout", tr: "Menü ve sayfa düzeni" },
    items: [
      {
        en: "The top menu gained a Stats menu and a stats landing page; League Details and the old 1. Lig dashboard are removed.",
        tr: "Üst menüye Stats menüsü ve istatistik ana sayfası geldi; League Details ile eski 1. Lig panosu kaldırıldı.",
      },
      {
        en: "Smart Prediction, Deep Prediction ML and Match Predictions sections are removed.",
        tr: "Smart Prediction, Deep Prediction ML ve Match Predictions bölümleri kaldırıldı.",
      },
    ],
  },
  {
    date: { en: "9 August", tr: "9 Ağustos" },
    title: {
      en: "Player profiles showcase design",
      tr: "Oyuncu profilleri vitrin tasarımı",
    },
    items: [
      {
        en: "Süper Lig and 1. Lig player profiles moved to the new showcase design: rating chart, percentile radar and season comparison.",
        tr: "Süper Lig ve 1. Lig oyuncu profilleri yeni vitrin tasarımına geçti: reyting grafiği, yüzdelik radarı ve sezon karşılaştırması.",
      },
      {
        en: "Player, team and league stats read from a fresher data source; they hit profiles as soon as a match ends.",
        tr: "Oyuncu, takım ve lig istatistikleri daha güncel veri kaynağından okunuyor; maç biter bitmez profillere yansıyor.",
      },
    ],
  },
  {
    date: { en: "9 August", tr: "9 Ağustos" },
    title: { en: "Small improvements", tr: "Küçük iyileştirmeler" },
    items: [
      {
        en: "\"Add to Input\" shows the number of added rows instantly in every model; a warning appears at 0 rows.",
        tr: "\"Add to Input\" butonu her modelde eklenen satır sayısını anlık gösteriyor; 0 satırda uyarı çıkıyor.",
      },
      {
        en: "Daily automatic refresh is set up for Süper Lig squads; transfers reach the site by the next morning.",
        tr: "Süper Lig kadroları için günlük otomatik tazeleme kuruldu; transferler ertesi sabah siteye yansıyor.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Brand and interface", tr: "Marka ve arayüz" },
    items: [
      {
        en: "The OddsKeeper logo and theme-based favicon arrived.",
        tr: "OddsKeeper logosu ve tema bazlı favicon geldi.",
      },
      {
        en: "Theme switching is instant; it applies without a page reload.",
        tr: "Tema geçişi artık anlık; sayfa yenilenmeden uygulanıyor.",
      },
      {
        en: "A Referees tab was added to Süper Lig and 1. Lig: referee list and season stats.",
        tr: "Süper Lig ve 1. Lig'e Referees sekmesi eklendi: hakem listesi ve sezon istatistikleri.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Improvements", tr: "İyileştirmeler" },
    items: [
      {
        en: "Excel exports are now named with fixture name and date/time (e.g. \"Galatasaray - Fenerbahçe_8_8_2026_16_57\"); exporting the same match at different times no longer mixes files up.",
        tr: "Excel'e aktarılan dosyalar artık fikstür adı ve tarih/saat ile adlandırılıyor (ör. \"Galatasaray - Fenerbahçe_8_8_2026_16_57\"); aynı maçı farklı zamanlarda çıkarınca dosyalar birbirine karışmıyor.",
      },
      {
        en: "The history list shows only the selected match's records; other matches' records no longer mix in.",
        tr: "Geçmiş listesi artık yalnızca seçili maçın kayıtlarını gösteriyor; başka maçların kayıtları araya karışmıyor.",
      },
      {
        en: "History records can be deleted from the list: everyone can delete their own, admins can delete all. A confirmation is asked before deleting.",
        tr: "Geçmiş kayıtlarını listeden silebiliyorsun: kendi kayıtlarını herkes, tüm kayıtları adminler. Silmeden önce onay soruluyor.",
      },
      {
        en: "On the Match Stats Model Fixture tab you can create and delete manual matches; typing a team name shows suggestions but free text works too. Manual matches stay at the top of the list across round changes.",
        tr: "Maç İstatistik Modeli Fixture sekmesinde elle maç oluşturup silebiliyorsun; takım adı yazınca öneri çıkıyor ama istediğin ismi de yazabiliyorsun. Manuel maçlar listenin en üstünde ve round değişse de kalıyor.",
      },
      {
        en: "Saving a Config setting asks for confirmation that it will apply permanently.",
        tr: "Config'te bir ayarı kaydederken, kalıcı uygulanacağına dair onay isteniyor.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Match Stats Model", tr: "Maç İstatistik Modeli" },
    tag: TAG_NEW_TOOL,
    items: [
      {
        en: "Your Excel match simulation model is now on the web: pick a fixture, open a market (Shot, SOT, Foul, Corner, Card...), let the model price it; add to Input and export to Excel in one click.",
        tr: "Excel'deki maç simülasyon modelin artık web'de: fikstürü seç, marketi (Shot, SOT, Faul, Korner, Kart...) aç, model oranları hesaplasın; tek tıkla Input'a ekleyip Excel olarak yazdır.",
      },
      {
        en: "Works for both Süper Lig and 1. Lig.",
        tr: "Hem Süper Lig hem 1. Lig için çalışıyor.",
      },
      {
        en: "The model blends the last 4 seasons with weights; you can also mix in \"last x weeks\" form at any ratio (Etki %). Manual home/away/total overrides are supported.",
        tr: "Model son 4 sezonu ağırlıklı harmanlıyor; ayrıca \"son x hafta\" formunu istediğin oranda karıştırabiliyorsun (Etki %). Elle ev/deplasman/toplam girip modeli ezebilirsin.",
      },
      {
        en: "In Card and Foul markets, picking a referee suggests a total based on the referee's card/foul averages.",
        tr: "Kart ve Faul marketlerinde hakem seçince, hakemin kart/faul ortalamasına göre önerilen toplam çıkıyor.",
      },
      {
        en: "The match's Bets10 fixture id and 1X2 odds are wired into the tool; \"refresh odds now\" fetches the latest odds, and a warning badge appears when odds changed.",
        tr: "Maçın Bets10 fikstür id'si ve 1X2 oranı araca bağlandı; \"oranları şimdi yenile\" ile güncel Bets10 oranını çekebiliyorsun, oran değişmişse uyarı rozeti görünüyor.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Model history and restore", tr: "Model geçmişi ve geri yükleme" },
    tag: TAG_NEW,
    items: [
      {
        en: "When you export a match to Excel, everything you entered is saved. Days later, pick that match from the history list next to \"Add to Input\" to bring it back on screen and continue from there.",
        tr: "Bir maça değer girip Excel'e yazdırdığında o an girdiğin her şey kaydediliyor. Günler sonra düzeltmek istediğinde, \"Add to Input\"in solundaki geçmiş listesinden o maçı seçip eski haliyle ekrana geri çağırıp üzerinden devam edebiliyorsun.",
      },
      {
        en: "Each record shows who exported it and when.",
        tr: "Her kayıtta kimin ne zaman yazdırdığı görünüyor.",
      },
      {
        en: "You choose how long records are kept (e.g. 30 days); expired ones are removed automatically.",
        tr: "Kayıtların ne kadar saklanacağını (ör. 30 gün) ayardan belirliyorsun; süresi dolanlar kendiliğinden siliniyor.",
      },
      {
        en: "Match Stats Model only: when you re-export a corrected match, lines you previously sent but no longer use are added to the new file as \"SU\" (suspended) automatically. This can be toggled in settings.",
        tr: "Maç İstatistik Modeli'ne özel: bir maçı düzeltip yeniden yazdırdığında, daha önce gönderdiğin ama artık kullanmadığın line'lar yeni dosyaya otomatik \"SU\" (askı) olarak ekleniyor. Bu davranışı ayardan açıp kapatabiliyorsun.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Upcoming Events", tr: "Yaklaşan Maçlar" },
    items: [
      {
        en: "Matches are starred by importance; you can hide low-profile matches and focus on the important ones first.",
        tr: "Maçlar artık önem puanına göre yıldızlanıyor; önemsiz (düşük profilli) maçları gizleyip önce önemli maçlara odaklanabiliyorsun.",
      },
      {
        en: "Match linking is fixed: cases where odds never showed or attached to the wrong match (especially women's and U19 mix-ups) now show the correct odds.",
        tr: "Maç eşleştirmesi düzeltildi: daha önce oranı hiç görünmeyen ya da yanlış maça bağlanan durumlar (özellikle kadın ve U19 maçlarının karışması) artık doğru oranıyla görünüyor.",
      },
    ],
  },
  {
    date: { en: "8 August", tr: "8 Ağustos" },
    title: { en: "Data freshness", tr: "Veri güncelliği" },
    items: [
      {
        en: "Stats update within about half an hour of full time; extras like xG, xGOT and cards are added too. New transfers' data settles in automatically.",
        tr: "Maç biter bitmez yaklaşık yarım saat içinde istatistikler güncelleniyor; xG, xGOT ve kart gibi ek veriler de ekleniyor. Yeni transfer olan oyuncuların verileri de otomatik yerine oturuyor.",
      },
      {
        en: "bet365 odds arrived for Süper Lig and Turkish Cup matches as well.",
        tr: "Süper Lig ve Türkiye Kupası maçlarına da bet365 oranları geldi.",
      },
    ],
  },
  {
    date: { en: "7 August", tr: "7 Ağustos" },
    title: { en: "Team notes", tr: "Takım notları" },
    items: [
      {
        en: "You can keep notes about teams. A note written on a team profile also shows on that team in the Match Stats Model screen (Süper Lig + 1. Lig).",
        tr: "Takımlar hakkında not tutabiliyorsun. Takım profiline yazdığın not, Maç İstatistik Modeli ekranında da o takımda görünüyor (Süper Lig + 1. Lig).",
      },
    ],
  },
  {
    date: { en: "4 August", tr: "4 Ağustos" },
    title: {
      en: "Player Market Model settings",
      tr: "Oyuncu Market Modeli ayarları",
    },
    items: [
      {
        en: "Distribution weights and player status rules (starter / sub / out inference) are now managed from settings; for both Süper Lig and 1. Lig.",
        tr: "Dağıtım ağırlıkları ve oyuncu durum kuralları (ilk 11 / yedek / kadro dışı çıkarımı) artık ayardan yönetiliyor; hem Süper Lig hem 1. Lig için.",
      },
    ],
  },
  {
    date: { en: "4 August", tr: "4 Ağustos" },
    title: {
      en: "Basketball: EuroLeague and EuroCup",
      tr: "Basketbol: EuroLeague ve EuroCup",
    },
    items: [
      {
        en: "EuroLeague and EuroCup arrived: standings, player/team profiles and match tools.",
        tr: "EuroLeague ve EuroCup eklendi: puan durumu, oyuncu/takım profilleri ve maç araçları.",
      },
      {
        en: "Click a team or player to switch between BSL / EuroLeague / EuroCup.",
        tr: "Bir takıma ya da oyuncuya tıklayıp BSL / EuroLeague / EuroCup arasında geçiş yapabiliyorsun.",
      },
      {
        en: "Players carry position and role tags (Starting 5, Rotation, Departed, New Arrival) and team-leader badges.",
        tr: "Oyuncularda pozisyon ve rol etiketleri (İlk 5, Rotasyon, Ayrıldı, Yeni Katılan) ve takım-lideri rozetleri görünüyor.",
      },
      {
        en: "Model weights (team and player) are editable from settings; new season (2026-27) teams are added.",
        tr: "Model ağırlıkları (takım ve oyuncu) ayardan düzenlenebiliyor; yeni sezon (2026-27) takımları eklendi.",
      },
    ],
  },
  {
    date: { en: "2 August", tr: "2 Ağustos" },
    title: { en: "Volleyball tools", tr: "Voleybol araçları" },
    tag: TAG_NEW_TOOL,
    items: [
      {
        en: "Volleyball tools arrived with a Turkish women's national team focus: match results, player lists (with photos and flags), a two-team market model and player distribution.",
        tr: "Türkiye kadın milli takımı odağıyla voleybol araçları geldi: maç sonuçları, oyuncu listeleri (fotoğraf ve bayrakla), iki takımlı market modeli ve oyuncu dağıtımı.",
      },
      {
        en: "EuroVolley 2026 fixtures are loaded.",
        tr: "EuroVolley 2026 fikstürleri yüklü.",
      },
    ],
  },
];

export default async function ChangelogPage() {
  const locale = await getLocale();
  const pick = (l: L) => (locale === "tr" ? l.tr : l.en);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">
          {locale === "tr" ? "Yenilikler" : "What's New"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {locale === "tr"
            ? "Son güncellemeler ve yeni özellikler."
            : "Latest updates and new features."}
        </p>
      </div>

      <div className="space-y-4">
        {ENTRIES.map((entry) => (
          <article
            key={entry.title.en}
            className="rounded-xl border border-line bg-card p-5"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-line bg-veil px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-2">
                {pick(entry.date)}
              </span>
              <h2 className="text-[15px] font-semibold text-ink">
                {pick(entry.title)}
              </h2>
              {entry.tag ? (
                <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                  {pick(entry.tag)}
                </span>
              ) : null}
            </div>
            <ul className="space-y-1.5">
              {entry.items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-relaxed text-ink-2"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                  <span>
                    <TenText text={pick(item)} />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
