import { getT } from "@/lib/i18n/server";

export default async function FinalCTASection() {
  const t = await getT();

  return (
    <section
      id="contact"
      className="scroll-mt-24 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-20 lg:pt-8"
    >
      <div className="mx-auto max-w-[1420px]">
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-5 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur sm:rounded-[32px] sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-32 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#13b0ff]/10 blur-3xl sm:h-40 sm:w-72" />
          </div>

          <div className="relative z-10 mx-auto max-w-[760px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.24em]">
              {t("landing.finalCtaKicker")}
            </p>

            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              {t("landing.finalCtaTitle")}
            </h2>

            <p className="mx-auto mt-5 max-w-[620px] text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
              {t("landing.finalCtaDescription")}
            </p>

            <div className="mt-8">
              <a
                href="mailto:contact@oddskeeper.com"
                className="inline-flex rounded-2xl border border-[#13b0ff]/35 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.02]"
              >
                {t("landing.requestAccess")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
