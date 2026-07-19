import { getT } from "@/lib/i18n/server";

export default async function StatsAnalysisPage() {
  const t = await getT();

  return (
    <section className="w-full">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,40,0.95),rgba(7,14,24,0.95))] p-8 shadow-[0_0_60px_rgba(34,104,189,0.12)]">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
          {t("statsHub.hubKicker")}
        </p>

        <h1 className="text-3xl font-semibold text-white lg:text-5xl">
          {t("statsHub.hubTitle")}
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 lg:text-base">
          {t("statsHub.hubDescription")}
        </p>
      </div>
    </section>
  );
}
