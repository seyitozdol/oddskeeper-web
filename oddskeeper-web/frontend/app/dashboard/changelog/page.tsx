// Yenilikler (changelog) sayfasi. Gorunurlugu admin access'ten yonetilir
// (nav-permissions "changelog" anahtari + proxy path kilidi). Icerik son
// kullaniciya yararini anlatir bicimde, Turkce.

import { TenText } from "@/components/TenBadge";

type Entry = {
  date: string;
  title: string;
  tag?: string;
  items: string[];
};

const ENTRIES: Entry[] = [
  {
    date: "12 Ağustos",
    title: "Maç İstatistik Modeli: maç deadline'ı ve hafta arşivi",
    tag: "Yeni",
    items: [
      "Bets10 oran ve fixture id beslemesi, maç başladıktan sonra o maç için güncellenmiyor: son maç-öncesi oran donuyor, canlı/sonuçlanmış oranlar (1.00 gibi) artık öneriye sızmıyor.",
      "Fixture sekmesinde başlamış maçlarda Bets10 önerisi ve Apply gizleniyor; \"Bets10'dan doldur\" bu maçları atlıyor.",
      "Round listesinde tamamlanan haftalar (son maçın başlama saati geçen) en alta iniyor; sekme ilk aktif haftayla açılıyor. 1. Lig'de artık 37 haftanın tamamı listeleniyor.",
      "Model sekmesindeki maç listesinde tamamlanan haftanın maçları en altta Arşiv grubuna taşınıyor; açılışta ilk aktif haftanın maçı seçili geliyor.",
      "Fixture sekmesinde manuel maç silerken artık onay soruluyor (Sil? Evet/Vazgeç).",
    ],
  },
  {
    date: "12 Ağustos",
    title: "Oyuncu Market Modeli: kalıcı durum ve LY düzeltmesi",
    items: [
      "Model'de elle değiştirilen oyuncu durumu (Starter/Sub/Out) artık kalıcı: sayfadan çıkıp girince veya maç değiştirince seçimin korunuyor (Süper Lig + 1. Lig).",
      "Yeni transferlerin geçen yıl ortalaması düzeltildi: kadro kimliği güncellenen oyuncularda (ör. Salah) LY Avg boş görünüyordu, yurt dışı sezon verisi yeniden bağlandı.",
    ],
  },
  {
    date: "12 Ağustos",
    title: "Lig sayfası: Fixtures paneli",
    items: [
      "League bölümündeki Fixtures paneli oynanmış maçları göstermeye devam etmiyor; hafta bitince otomatik olarak bir sonraki haftanın maçları listeleniyor.",
    ],
  },
  {
    date: "11 Ağustos",
    title: "Maç İstatistik Modeli: şut ailesi önerileri",
    tag: "Yeni",
    items: [
      "Shot marketinde elle ev/deplasman değeri girince, aynı değişim oranı SOT, Saves ve Goal Kick marketlerine öneri olarak yansıyor; Apply ile tek tıkla uygulanıyor.",
      "Yön kuralı: SOT aynı tarafta değişir; Saves ve Goal Kick karşı tarafta (ev şutu artarsa deplasman kalecisinin kurtarışı ve deplasmanın aut vuruşu artar).",
      "Öneri yalnızca Shot'taki değişiklikten üretilir; başka bir markette elle değişiklik yapmak öneri doğurmaz.",
    ],
  },
  {
    date: "11 Ağustos",
    title: "Basketbol takım metrikleri",
    items: [
      "Takım metrikleri Excel modeliyle birebir hizalandı: ribaund tahmini kaçan şut modeline bağlandı, son 10 maç formu sezon ortalamasıyla harmanlanıyor, puan hesabı sabitlendi.",
    ],
  },
  {
    date: "11 Ağustos",
    title: "Hız ve oyuncu fotoğrafları",
    items: [
      "Oyuncu Market Modeli sayfaları belirgin hızlandı.",
      "Eksik oyuncu fotoğrafları tamamlandı ve artık kendi sunucumuzdan yükleniyor; oyuncu kartlarındaki biyografi bilgileri (yaş, boy, mevki) dolduruldu.",
      "Oyuncu kartında yurt dışında oynanmış geçmiş sezonlar da listeleniyor.",
      "Futbol takım istatistikleri sayfasında yalnız güncel Süper Lig takımları görünüyor.",
    ],
  },
  {
    date: "10 Ağustos",
    title: "Maç İstatistik Modeli iyileştirmeleri",
    items: [
      "Config yeniden tasarlandı: ayarlar 4 alt sekmeye ve konu bazlı kartlara ayrıldı.",
      "Markets alt sekmesi geldi: her market için 1. yarı / 2. yarı bazında line, under ve payback kontrolü.",
      "Manuel fikstürde ligde olmayan rakip için \"benzer takım\" eşlemesi: Avrupa maçında rakibi lig takımlarından birine benzeterek modeli çalıştırabiliyorsun.",
    ],
  },
  {
    date: "10 Ağustos",
    title: "Oyuncu Market Modeli: kutu içi/dışı şut",
    tag: "Yeni",
    items: [
      "Şut haritası verisi bağlandı: kutu içi ve kutu dışı isabetli şut marketleri eklendi (Süper Lig + 1. Lig).",
      "Oyuncu kartında SOT kutu içi/dışı sezon geçmişi görünüyor.",
      "Market listesinde New/Save butonları üste alındı; yeni market oluşturma akışındaki hata düzeltildi.",
    ],
  },
  {
    date: "10 Ağustos",
    title: "Vitrin tasarımı: maç ve takım sayfaları",
    items: [
      "Maç sayfaları ve takım profilleri (Süper Lig + 1. Lig) yeni vitrin tasarımına geçti ve varsayılan görünüm oldu.",
    ],
  },
  {
    date: "10 Ağustos",
    title: "Yaklaşan Maçlar: dördüncü oran kaynağı",
    items: [
      "Oran karşılaştırmasına BMBets eklendi; maçlar artık dört kaynaktan gelen oranlarla görünüyor.",
    ],
  },
  {
    date: "10 Ağustos",
    title: "Yeni transferler",
    items: [
      "Kadrolar her gün Transfermarkt ile kıyaslanıyor: yeni transferler kadroya otomatik ekleniyor, ayrılanlar işaretleniyor.",
      "Yeni transferlerin geçen sezon verileri yurt dışı liglerinden çekiliyor; Oyuncu Market Modeli'nde geçen yıl ortalaması boş kalmıyor.",
    ],
  },
  {
    date: "9 Ağustos",
    title: "Menü ve sayfa düzeni",
    items: [
      "Üst menüye Stats menüsü ve istatistik ana sayfası geldi; League Details ile eski 1. Lig panosu kaldırıldı.",
      "Smart Prediction, Deep Prediction ML ve Match Predictions bölümleri kaldırıldı.",
    ],
  },
  {
    date: "9 Ağustos",
    title: "Oyuncu profilleri vitrin tasarımı",
    items: [
      "Süper Lig ve 1. Lig oyuncu profilleri yeni vitrin tasarımına geçti: reyting grafiği, yüzdelik radarı ve sezon karşılaştırması.",
      "Oyuncu, takım ve lig istatistikleri daha güncel veri kaynağından okunuyor; maç biter bitmez profillere yansıyor.",
    ],
  },
  {
    date: "9 Ağustos",
    title: "Küçük iyileştirmeler",
    items: [
      "\"Add to Input\" butonu her modelde eklenen satır sayısını anlık gösteriyor; 0 satırda uyarı çıkıyor.",
      "Süper Lig kadroları için günlük otomatik tazeleme kuruldu; transferler ertesi sabah siteye yansıyor.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "Marka ve arayüz",
    items: [
      "OddsKeeper logosu ve tema bazlı favicon geldi.",
      "Tema geçişi artık anlık; sayfa yenilenmeden uygulanıyor.",
      "Süper Lig ve 1. Lig'e Referees sekmesi eklendi: hakem listesi ve sezon istatistikleri.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "İyileştirmeler",
    items: [
      "Excel'e aktarılan dosyalar artık fikstür adı ve tarih/saat ile adlandırılıyor (ör. \"Galatasaray - Fenerbahçe_8_8_2026_16_57\"); aynı maçı farklı zamanlarda çıkarınca dosyalar birbirine karışmıyor.",
      "Geçmiş listesi artık yalnızca seçili maçın kayıtlarını gösteriyor; başka maçların kayıtları araya karışmıyor.",
      "Geçmiş kayıtlarını listeden silebiliyorsun: kendi kayıtlarını herkes, tüm kayıtları adminler. Silmeden önce onay soruluyor.",
      "Maç İstatistik Modeli Fixture sekmesinde elle maç oluşturup silebiliyorsun; takım adı yazınca öneri çıkıyor ama istediğin ismi de yazabiliyorsun. Manuel maçlar listenin en üstünde ve round değişse de kalıyor.",
      "Config'te bir ayarı kaydederken, kalıcı uygulanacağına dair onay isteniyor.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "Maç İstatistik Modeli",
    tag: "Yeni araç",
    items: [
      "Excel'deki maç simülasyon modelin artık web'de: fikstürü seç, marketi (Shot, SOT, Faul, Korner, Kart...) aç, model oranları hesaplasın; tek tıkla Input'a ekleyip Excel olarak yazdır.",
      "Hem Süper Lig hem 1. Lig için çalışıyor.",
      "Model son 4 sezonu ağırlıklı harmanlıyor; ayrıca \"son x hafta\" formunu istediğin oranda karıştırabiliyorsun (Etki %). Elle ev/deplasman/toplam girip modeli ezebilirsin.",
      "Kart ve Faul marketlerinde hakem seçince, hakemin kart/faul ortalamasına göre önerilen toplam çıkıyor.",
      "Maçın Bets10 fikstür id'si ve 1X2 oranı araca bağlandı; \"oranları şimdi yenile\" ile güncel Bets10 oranını çekebiliyorsun, oran değişmişse uyarı rozeti görünüyor.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "Model geçmişi ve geri yükleme",
    tag: "Yeni",
    items: [
      "Bir maça değer girip Excel'e yazdırdığında o an girdiğin her şey kaydediliyor. Günler sonra düzeltmek istediğinde, \"Add to Input\"in solundaki geçmiş listesinden o maçı seçip eski haliyle ekrana geri çağırıp üzerinden devam edebiliyorsun.",
      "Her kayıtta kimin ne zaman yazdırdığı görünüyor.",
      "Kayıtların ne kadar saklanacağını (ör. 30 gün) ayardan belirliyorsun; süresi dolanlar kendiliğinden siliniyor.",
      "Maç İstatistik Modeli'ne özel: bir maçı düzeltip yeniden yazdırdığında, daha önce gönderdiğin ama artık kullanmadığın line'lar yeni dosyaya otomatik \"SU\" (askı) olarak ekleniyor. Bu davranışı ayardan açıp kapatabiliyorsun.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "Yaklaşan Maçlar",
    items: [
      "Maçlar artık önem puanına göre yıldızlanıyor; önemsiz (düşük profilli) maçları gizleyip önce önemli maçlara odaklanabiliyorsun.",
      "Maç eşleştirmesi düzeltildi: daha önce oranı hiç görünmeyen ya da yanlış maça bağlanan durumlar (özellikle kadın ve U19 maçlarının karışması) artık doğru oranıyla görünüyor.",
    ],
  },
  {
    date: "8 Ağustos",
    title: "Veri güncelliği",
    items: [
      "Maç biter bitmez yaklaşık yarım saat içinde istatistikler güncelleniyor; xG, xGOT ve kart gibi ek veriler de ekleniyor. Yeni transfer olan oyuncuların verileri de otomatik yerine oturuyor.",
      "Süper Lig ve Türkiye Kupası maçlarına da bet365 oranları geldi.",
    ],
  },
  {
    date: "7 Ağustos",
    title: "Takım notları",
    items: [
      "Takımlar hakkında not tutabiliyorsun. Takım profiline yazdığın not, Maç İstatistik Modeli ekranında da o takımda görünüyor (Süper Lig + 1. Lig).",
    ],
  },
  {
    date: "4 Ağustos",
    title: "Oyuncu Market Modeli ayarları",
    items: [
      "Dağıtım ağırlıkları ve oyuncu durum kuralları (ilk 11 / yedek / kadro dışı çıkarımı) artık ayardan yönetiliyor; hem Süper Lig hem 1. Lig için.",
    ],
  },
  {
    date: "4 Ağustos",
    title: "Basketbol: EuroLeague ve EuroCup",
    items: [
      "EuroLeague ve EuroCup eklendi: puan durumu, oyuncu/takım profilleri ve maç araçları.",
      "Bir takıma ya da oyuncuya tıklayıp BSL / EuroLeague / EuroCup arasında geçiş yapabiliyorsun.",
      "Oyuncularda pozisyon ve rol etiketleri (İlk 5, Rotasyon, Ayrıldı, Yeni Katılan) ve takım-lideri rozetleri görünüyor.",
      "Model ağırlıkları (takım ve oyuncu) ayardan düzenlenebiliyor; yeni sezon (2026-27) takımları eklendi.",
    ],
  },
  {
    date: "2 Ağustos",
    title: "Voleybol araçları",
    tag: "Yeni araç",
    items: [
      "Türkiye kadın milli takımı odağıyla voleybol araçları geldi: maç sonuçları, oyuncu listeleri (fotoğraf ve bayrakla), iki takımlı market modeli ve oyuncu dağıtımı.",
      "EuroVolley 2026 fikstürleri yüklü.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Yenilikler</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          Son güncellemeler ve yeni özellikler.
        </p>
      </div>

      <div className="space-y-4">
        {ENTRIES.map((entry) => (
          <article
            key={entry.title}
            className="rounded-xl border border-line bg-card p-5"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-line bg-veil px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-2">
                {entry.date}
              </span>
              <h2 className="text-[15px] font-semibold text-ink">
                {entry.title}
              </h2>
              {entry.tag ? (
                <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                  {entry.tag}
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
                  <span><TenText text={item} /></span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
