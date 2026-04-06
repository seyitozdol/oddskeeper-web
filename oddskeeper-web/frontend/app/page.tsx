import Image from "next/image";

const featureCards = [
  {
    title: "ML-Powered\nPredictions",
    description:
      "Explore unique and custom sports markets across top competitions.",
    image: "/images/landing/lp_ic001.png",
    alt: "ML-Powered Predictions Icon",
  },
  {
    title: "Unique Sports\nMarkets",
    description:
      "Utilize ML models for highly accurate and reliable sports predictions.",
    image: "/images/landing/lp_ic002.png",
    alt: "Unique Sports Markets Icon",
  },
  {
    title: "Player & Team\nInsights",
    description:
      "Get predictions tailored to specific players and teams.",
    image: "/images/landing/lp_ic003.png",
    alt: "Player and Team Insights Icon",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#e9edf3] px-3 py-4 sm:px-5 sm:py-6 md:px-8">
      <section className="mx-auto w-full max-w-[1120px] overflow-hidden rounded-[22px] border border-[#d9dee7] bg-[#f7f9fc] shadow-[0_10px_30px_rgba(40,56,85,0.06)]">
        <header className="flex items-center justify-between border-b border-[#e4e9f1] px-4 py-4 sm:px-6 md:px-8">
          <div className="text-[24px] font-bold tracking-[-0.03em] text-[#222b52] sm:text-[28px]">
            Odds Keeper
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <nav className="flex items-center gap-6 text-[13px] font-medium text-[#5b6480]">
              <button className="transition hover:text-[#1d2752]">Products</button>
              <button className="transition hover:text-[#1d2752]">Pricing</button>
              <button className="transition hover:text-[#1d2752]">TR | EN</button>
            </nav>

            <div className="flex items-center gap-2">
              <button className="rounded-[10px] border border-[#e1e6ef] bg-white px-4 py-2 text-[12px] font-semibold text-[#50607a] shadow-sm transition hover:bg-[#f4f7fb]">
                TO EN
              </button>
              <button className="rounded-[10px] border border-[#e1e6ef] bg-white px-4 py-2 text-[12px] font-semibold text-[#50607a] shadow-sm transition hover:bg-[#f4f7fb]">
                Şefqfin
              </button>
            </div>
          </div>

          <button className="rounded-[10px] border border-[#e1e6ef] bg-white px-3 py-2 text-[12px] font-semibold text-[#50607a] shadow-sm md:hidden">
            Menu
          </button>
        </header>

        <div className="relative overflow-hidden px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-12 md:px-10 md:pb-12 md:pt-14">
          <div className="pointer-events-none absolute left-[-120px] top-[80px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(144,197,255,0.18)_0%,rgba(144,197,255,0)_68%)]" />
          <div className="pointer-events-none absolute right-[-160px] top-[120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(166,224,255,0.22)_0%,rgba(166,224,255,0)_70%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-[140px] h-[280px] bg-[radial-gradient(ellipse_at_center,rgba(115,185,255,0.16)_0%,rgba(115,185,255,0)_72%)]" />

          <div className="relative z-10 mx-auto max-w-[820px] text-center">
            <h1 className="mx-auto max-w-[760px] text-[34px] font-bold leading-[1.08] tracking-[-0.045em] text-[#1d2547] sm:text-[46px] md:text-[60px]">
              Smarter Sports Market
              <br />
              Predictions with ML
            </h1>

            <p className="mx-auto mt-5 max-w-[700px] text-[15px] leading-7 text-[#6b748d] sm:text-[18px]">
              Predict outcomes with high accuracy and dive into unique markets.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button className="min-w-[180px] rounded-[14px] bg-gradient-to-r from-[#70b6ff] to-[#5aa8ff] px-7 py-4 text-[18px] font-semibold text-white shadow-[0_10px_22px_rgba(100,168,255,0.30)] transition hover:scale-[1.02]">
                Start Predicting
              </button>
              <button className="min-w-[180px] rounded-[14px] border border-[#d8dfeb] bg-white px-7 py-4 text-[18px] font-semibold text-[#4b5876] shadow-sm transition hover:bg-[#f4f7fb]">
                Get a Demo
              </button>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-10 max-w-[920px] md:mt-12">
            <div className="relative overflow-hidden rounded-[28px]">
              <Image
                src="/images/landing/lp_bck001.png"
                alt="Odds Keeper hero visual"
                width={1400}
                height={950}
                priority
                className="h-auto w-full object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-8 grid max-w-[980px] gap-4 md:mt-10 md:grid-cols-3 md:gap-5">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[18px] border border-[#e3e8f0] bg-white/88 px-5 py-6 text-center shadow-[0_10px_24px_rgba(37,56,88,0.06)] backdrop-blur-sm"
              >
                <div className="mx-auto flex h-[62px] w-[62px] items-center justify-center">
                  <Image
                    src={card.image}
                    alt={card.alt}
                    width={62}
                    height={62}
                    className="h-auto w-auto object-contain"
                  />
                </div>

                <h2 className="mt-4 whitespace-pre-line text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#1e2546] sm:text-[30px] md:text-[31px]">
                  {card.title}
                </h2>

                <p className="mx-auto mt-3 max-w-[260px] text-[15px] leading-6 text-[#707a92] sm:text-[16px]">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
