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
    date: { en: "13 August", tr: "13 Ağustos" },
    title: { en: "Turkish Cup section", tr: "Türkiye Kupası bölümü" },
    tag: TAG_NEW,
    items: [
      {
        en: "A new \"Cup\" shortcut has been added to the header (after 1.Lig). The last two seasons of the Turkish Cup (all rounds, including early and group stages) have been loaded with full match statistics; the fixtures and match content will appear in this section shortly.",
        tr: "Header'a (1.Lig'den sonra) yeni bir \"Kupa\" kısayolu eklendi. Türkiye Kupası'nın son iki sezonu (erken ve grup aşamaları dahil tüm turlar) tam maç istatistikleriyle yüklendi; fikstür ve maç içeriği bu bölümde kısa süre içinde yer alacak.",
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
