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
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:rounded-[28px]">
          <div className="grid overflow-hidden rounded-[18px] sm:rounded-[22px] md:grid-cols-3">
            {items.map((item, index) => (
              <div
                key={item.eyebrowKey}
                className={`bg-white/[0.02] px-4 py-5 text-center sm:px-6 sm:py-6 ${
                  index !== items.length - 1
                    ? "border-b border-white/8 md:border-b-0 md:border-r"
                    : ""
                } border-white/8`}
              >
                <div className="mx-auto mb-3 h-2 w-2 rounded-full bg-[#63dcff] sm:mb-4" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.22em]">
                  {t(item.eyebrowKey)}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58 sm:mt-3">
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
