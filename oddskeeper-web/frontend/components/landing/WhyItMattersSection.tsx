import { getT } from "@/lib/i18n/server";

export default async function WhyItMattersSection() {
  const t = await getT();

  const benefitCards = [
    { titleKey: "landing.benefit1Title", textKey: "landing.benefit1Text" },
    { titleKey: "landing.benefit2Title", textKey: "landing.benefit2Text" },
    { titleKey: "landing.benefit3Title", textKey: "landing.benefit3Text" },
    { titleKey: "landing.benefit4Title", textKey: "landing.benefit4Text" },
  ];

  return (
    <section className="px-4 pb-14 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-6">
      <div className="mx-auto grid max-w-[1420px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="max-w-[620px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent-ink sm:text-[11px] sm:tracking-[0.24em]">
            {t("landing.whyMattersKicker")}
          </p>

          <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink sm:text-3xl lg:text-4xl">
            {t("landing.whyMattersTitle")}
          </h2>

          <p className="mt-5 text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">
            {t("landing.whyMattersDescription")}
          </p>

          <div className="mt-6 rounded-xl border border-line bg-card p-5 sm:mt-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent-ink sm:text-[11px] sm:tracking-[0.22em]">
              {t("landing.operationalValueLabel")}
            </p>
            <p className="mt-3 text-sm leading-7 text-ink-2 sm:text-[15px]">
              {t("landing.operationalValueText")}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {benefitCards.map((card) => (
            <div
              key={card.titleKey}
              className="rounded-xl border border-line bg-card p-5 sm:rounded-2xl sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-strong bg-accent-soft sm:h-11 sm:w-11">
                <div className="h-4 w-4 rounded-full bg-accent" />
              </div>

              <h3 className="mt-5 text-xl font-semibold leading-tight text-ink sm:mt-6 sm:text-2xl">
                {t(card.titleKey)}
              </h3>

              <p className="mt-4 text-sm leading-7 text-ink-2 sm:text-[15px]">
                {t(card.textKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
