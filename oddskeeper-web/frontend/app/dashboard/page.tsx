import { getT } from "@/lib/i18n/server";

export default async function SmartPredictionPage() {
  const t = await getT();

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="max-w-3xl">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.25em] text-accent-ink">
            {t("nav.smartPrediction")}
          </p>

          <h1 className="text-xl font-semibold text-ink lg:text-2xl">
            {t("dashboardHome.title")}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-2 lg:text-base">
            {t("dashboardHome.description")}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-veil p-5">
            <div className="text-sm font-medium text-ink-2">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-ink">
              {t("dashboardHome.matchFiltersTitle")}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-veil p-5">
            <div className="text-sm font-medium text-ink-2">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-ink">
              {t("dashboardHome.teamInputsTitle")}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-veil p-5">
            <div className="text-sm font-medium text-ink-2">
              {t("dashboardHome.moduleLabel")}
            </div>
            <div className="mt-2 text-lg font-semibold text-ink">
              {t("dashboardHome.quickOutputsTitle")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
