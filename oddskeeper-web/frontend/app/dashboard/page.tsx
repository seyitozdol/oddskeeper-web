import { getT } from "@/lib/i18n/server";

export default async function SmartPredictionPage() {
  const t = await getT();

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,40,0.95),rgba(7,14,24,0.95))] p-8 shadow-[0_0_60px_rgba(34,104,189,0.12)]">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
            {t("nav.smartPrediction")}
          </p>

          <h1 className="text-3xl font-semibold text-white lg:text-5xl">
            {t("dashboardHome.title")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 lg:text-base">
            {t("dashboardHome.description")}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {t("dashboardHome.matchFiltersTitle")}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {t("dashboardHome.teamInputsTitle")}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white/55">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {t("dashboardHome.quickOutputsTitle")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
