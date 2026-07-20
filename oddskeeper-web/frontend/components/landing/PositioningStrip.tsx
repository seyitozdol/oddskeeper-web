import { getT } from "@/lib/i18n/server";

export default async function PositioningStrip() {
  const t = await getT();

  const items = [
    {
      eyebrowKey: "landing.posStructuredDataEyebrow",
      textKey: "landing.posStructuredDataText",
    },
    {
      eyebrowKey: "landing.posTradingAnalyticsEyebrow",
      textKey: "landing.posTradingAnalyticsText",
    },
    {
      eyebrowKey: "landing.posEnterpriseArchEyebrow",
      textKey: "landing.posEnterpriseArchText",
    },
  ];

  return (
    <section className="relative z-10 -mt-2 px-4 pb-6 sm:px-6 lg:-mt-4 lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-[1420px]">
        <div className="rounded-xl border border-line bg-card-2 p-2 backdrop-blur sm:rounded-2xl">
          <div className="grid overflow-hidden rounded-xl md:grid-cols-3">
            {items.map((item, index) => (
              <div
                key={item.eyebrowKey}
                className={`bg-card px-4 py-5 text-center sm:px-6 sm:py-6 ${
                  index !== items.length - 1
                    ? "border-b border-line md:border-b-0 md:border-r"
                    : ""
                } border-line`}
              >
                <div className="mx-auto mb-3 h-2 w-2 rounded-full bg-accent sm:mb-4" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent-ink sm:text-[11px] sm:tracking-[0.22em]">
                  {t(item.eyebrowKey)}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-2 sm:mt-3">
                  {t(item.textKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
