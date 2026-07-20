import { getT } from "@/lib/i18n/server";

export default async function FinalCTASection() {
  const t = await getT();

  return (
    <section
      id="contact"
      className="scroll-mt-24 px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8"
    >
      <div className="mx-auto max-w-[1420px]">
        <div className="relative overflow-hidden rounded-xl border border-line bg-card px-5 py-8 text-center backdrop-blur sm:rounded-2xl sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-32 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl sm:h-40 sm:w-72" />
          </div>

          <div className="relative z-10 mx-auto max-w-[760px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent-ink sm:text-[11px] sm:tracking-[0.24em]">
              {t("landing.finalCtaKicker")}
            </p>

            <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink sm:text-3xl lg:text-4xl">
              {t("landing.finalCtaTitle")}
            </h2>

            <p className="mx-auto mt-5 max-w-[620px] text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">
              {t("landing.finalCtaDescription")}
            </p>

            <div className="mt-8">
              <a
                href="mailto:contact@oddskeeper.com"
                className="inline-flex rounded-2xl bg-accent px-7 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
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
