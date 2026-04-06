import type { CSSProperties } from "react";

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

const heroSectionStyle: CSSProperties = {
  backgroundColor: "#eef3f8",
  backgroundImage: `
    radial-gradient(circle at 50% 10%, rgba(171, 216, 255, 0.24) 0%, rgba(171, 216, 255, 0.10) 24%, rgba(238, 243, 248, 0) 58%),
    radial-gradient(circle at 50% 58%, rgba(140, 205, 255, 0.16) 0%, rgba(140, 205, 255, 0.08) 22%, rgba(238, 243, 248, 0) 52%),
    url('/images/landing/lp_bck001.png')
  `,
  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
  backgroundPosition: "center 0px, center 420px, center 360px",
  backgroundSize: "100% 520px, 1200px 560px, min(1320px, 94vw) auto",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#eef3f8]">
      <header className="border-b border-[#d9dee7] bg-[#eef3f8]">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8 md:px-10">
          <div className="text-[28px] font-bold tracking-[-0.03em] text-[#222b52] sm:text-[34px]">
            Odds Keeper
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <nav className="flex items-center gap-8 text-[15px] font-medium text-[#5b6480]">
              <button className="transition hover:text-[#1d2752]">Products</button>
              <button className="transition hover:text-[#1d2752]">Pricing</button>
              <button className="transition hover:text-[#1d2752]">TR | EN</button>
            </nav>

            <div className="flex items-center gap-3">
              <button className="rounded-[14px] border border-[#d7deea] bg-white px-5 py-3 text-[14px] font-semibold text-[#44516d] shadow-[0_4px_12px_rgba(31,52,89,0.08)] transition hover:bg-[#f5f8fc]">
                Login
              </button>
              <button className="rounded-[14px] border border-[#d7deea] bg-white px-5 py-3 text-[14px] font-semibold text-[#44516d] shadow-[0_4px_12px_rgba(31,52,89,0.08)] transition hover:bg-[#f5f8fc]">
                Signup
              </button>
            </div>
          </div>

          <button className="rounded-[12px] border border-[#d7deea] bg-white px-4 py-2 text-[13px] font-semibold text-[#44516d] shadow-sm md:hidden">
            Menu
          </button>
        </div>
      </header>

      <section
        className="relative overflow-hidden px-5 pb-20 pt-10 sm:px-8 md:px-10 md:pt-14"
        style={heroSectionStyle}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,0.38),rgba(255,255,255,0)_28%)]" />

        <div className="relative z-10 mx-auto w-full max-w-[1280px] text-center">
          <h1 className="mx-auto max-w-[980px] text-[44px] font-bold leading-[1.04] tracking-[-0.05em] text-[#1d2547] sm:text-[62px] md:text-[88px]">
            Smarter Sports Market
            <br />
            Predictions with ML
          </h1>

          <p className="mx-auto mt-6 max-w-[760px] text-[18px] leading-8 text-[#6b748d] sm:text-[22px]">
            Predict outcomes with high accuracy and dive into unique markets.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button className="min-w-[210px] rounded-[16px] bg-gradient-to-r from-[#72b7ff] to-[#5aa8ff] px-8 py-4 text-[20px] font-semibold text-white shadow-[0_12px_26px_rgba(100,168,255,0.28)] transition hover:scale-[1.02]">
              Start Predicting
            </button>
            <button className="min-w-[210px] rounded-[16px] border border-[#d7deea] bg-white px-8 py-4 text-[20px] font-semibold text-[#4b5876] shadow-[0_6px_18px_rgba(31,52,89,0.08)] transition hover:bg-[#f4f7fb]">
              Get a Demo
            </button>
          </div>

          <div className="h-[520px] sm:h-[620px] md:h-[760px]" />

          <div className="mx-auto mt-[-10px] grid max-w-[1180px] gap-6 md:grid-cols-3 md:gap-7">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[24px] border border-[#dbe2ec] bg-white/88 px-8 pb-10 pt-8 text-center shadow-[0_14px_30px_rgba(37,56,88,0.06)] backdrop-blur-sm md:px-9"
              >
                <div className="mx-auto mb-4 flex h-[220px] w-[220px] items-center justify-center overflow-visible md:h-[260px] md:w-[260px]">
                  <img
                    src={card.image}
                    alt={card.alt}
                    className="h-auto w-full scale-[3.2] object-contain"
                  />
                </div>

                <h2 className="whitespace-pre-line text-[34px] font-semibold leading-[1.03] tracking-[-0.045em] text-[#1e2546] sm:text-[42px] md:text-[48px]">
                  {card.title}
                </h2>

                <p className="mx-auto mt-4 max-w-[300px] text-[17px] leading-8 text-[#707a92] sm:text-[18px] md:text-[19px]">
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