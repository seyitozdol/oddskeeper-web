// Yenilikler (changelog) sayfasi. Gorunurlugu admin access'ten yonetilir
// (nav-permissions "changelog" anahtari + proxy path kilidi). Icerik son
// kullaniciya yararini anlatir bicimde, Turkce.

type Entry = {
  date: string;
  title: string;
  tag?: string;
  items: string[];
};

const ENTRIES: Entry[] = [
  {
    date: "6-8 Ağustos",
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
    date: "4 Ağustos",
    title: "Oyuncu Market Modeli ayarları",
    items: [
      "Dağıtım ağırlıkları ve oyuncu durum kuralları (ilk 11 / yedek / kadro dışı çıkarımı) artık ayardan yönetiliyor; hem Süper Lig hem 1. Lig için.",
    ],
  },
  {
    date: "1-4 Ağustos",
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
  {
    date: "2-8 Ağustos",
    title: "Yaklaşan Maçlar",
    items: [
      "Maçlar artık önem puanına göre yıldızlanıyor; önemsiz (düşük profilli) maçları gizleyip önce önemli maçlara odaklanabiliyorsun.",
      "Maç eşleştirmesi düzeltildi: daha önce oranı hiç görünmeyen ya da yanlış maça bağlanan durumlar (özellikle kadın ve U19 maçlarının karışması) artık doğru oranıyla görünüyor.",
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
    date: "7-8 Ağustos",
    title: "Veri güncelliği",
    items: [
      "Maç biter bitmez yaklaşık yarım saat içinde istatistikler güncelleniyor; xG, xGOT ve kart gibi ek veriler de ekleniyor. Yeni transfer olan oyuncuların verileri de otomatik yerine oturuyor.",
      "Süper Lig ve Türkiye Kupası maçlarına da bet365 oranları geldi.",
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
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
