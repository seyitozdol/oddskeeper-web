import Image from "next/image";
import type { CSSProperties } from "react";

const featureCards = [
  {
    title: "ML-Powered
Predictions",
    description:
      "Explore unique and custom sports markets across top competitions.",
    image: "/images/landing/lp_ic001.png",
    alt: "ML-Powered Predictions Icon",
  },
  {
    title: "Unique Sports
Markets",
    description:
      "Utilize ML models for highly accurate and reliable sports predictions.",
    image: "/images/landing/lp_ic002.png",
    alt: "Unique Sports Markets Icon",
  },
  {
    title: "Player & Team
Insights",
    description:
      "Get predictions tailored to specific players and teams.",
    image: "/images/landing/lp_ic003.png",
    alt: "Player and Team Insights Icon",
  },
];

const heroBgStyle: CSSProperties = {
  backgroundImage: `
    radial-gradient(circle at 50% 8%, rgba(162, 213, 255, 0.22), rgba(162, 213, 255, 0) 38%),
    radial-gradient(circle at 50% 60%, rgba(170, 224, 255, 0.14), rgba(170, 224, 255, 0) 48%),
    url('/images/landing/lp_bck001.png')
  `,
  backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
  backgroundPosition: 'center top, center 58%, center 330px',
  backgroundSize: '100% 520px, 1100px 500px, min(1200px, 92vw) auto',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#eef3f8]" style={heroBgStyle}>
      <header className="relative z-20 border-b border-[#d9dee7] bg-transparent">
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

      <section className="relative overflow-hidden px-5 pb-14 pt-10 sm:px-8 md:px-10 md:pb-20 md:pt-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(135,198,255,0.14),rgba(238,243,248,0)_34%)]" />
        <div className="pointer-events-none absolute left-[-180px] top-[120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(166,214,255,0.10)_0%,rgba(166,214,255,0)_70%)]" />
        <div className="pointer-events-none absolute right-[-180px] top-[140px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(171,225,255,0.14)_0%,rgba(171,225,255,0)_70%)]" />

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

          <div className="mx-auto mt-[-40px] grid max-w-[1180px] gap-5 md:mt-[-20px] md:grid-cols-3 md:gap-7">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[24px] border border-[#dbe2ec] bg-white/88 px-8 py-8 text-center shadow-[0_14px_30px_rgba(37,56,88,0.06)] backdrop-blur-sm md:px-9 md:py-10"
              >
                <div className="mx-auto -mt-2 mb-2 flex h-[220px] w-[220px] items-center justify-center overflow-visible md:h-[260px] md:w-[260px]">
                  <Image
                    src={card.image}
                    alt={card.alt}
                    width={260}
                    height={260}
                    className="h-auto w-full scale-[2.9] object-contain"
                  />
                </div>

                <h2 className="mt-2 whitespace-pre-line text-[34px] font-semibold leading-[1.03] tracking-[-0.045em] text-[#1e2546] sm:text-[42px] md:text-[48px]">
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
