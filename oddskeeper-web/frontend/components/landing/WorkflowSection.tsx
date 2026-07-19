import { getT } from "@/lib/i18n/server";

export default async function WorkflowSection() {
  const t = await getT();

  const steps = [
    {
      number: "01",
      titleKey: "landing.workflowStep1Title",
      descriptionKey: "landing.workflowStep1Description",
    },
    {
      number: "02",
      titleKey: "landing.workflowStep2Title",
      descriptionKey: "landing.workflowStep2Description",
    },
    {
      number: "03",
      titleKey: "landing.workflowStep3Title",
      descriptionKey: "landing.workflowStep3Description",
    },
    {
      number: "04",
      titleKey: "landing.workflowStep4Title",
      descriptionKey: "landing.workflowStep4Description",
    },
  ];

  return (
    <section
      id="data-layers"
      className="scroll-mt-24 px-4 pb-16 pt-4 sm:px-6 lg:px-10 lg:pb-24 lg:pt-6"
    >
      <div className="mx-auto max-w-[1420px]">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.24em]">
            {t("landing.workflowKicker")}
          </p>

          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            {t("landing.workflowTitle")}
          </h2>

          <p className="mt-5 max-w-[700px] text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
            {t("landing.workflowDescription")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 xl:mt-12 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:rounded-[28px] sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#63dcff]">
                    {step.number}
                  </span>

                  <div className="h-3 w-3 rounded-full bg-[#63dcff]" />
                </div>

                <h3 className="mt-5 text-[30px] font-semibold leading-tight text-white sm:mt-6 sm:text-2xl">
                  {t(step.titleKey)}
                </h3>

                <p className="mt-4 text-sm leading-7 text-white/60 sm:text-[15px]">
                  {t(step.descriptionKey)}
                </p>

                <div className="mt-6 rounded-2xl border border-white/8 bg-[#0b1524]/70 px-4 py-3 sm:mt-8">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    {t("landing.workflowLayerLabel")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/88">
                    {t(step.titleKey)}
                  </p>
                </div>
              </div>

              {index !== steps.length - 1 && (
                <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-[#13b0ff]/50 to-transparent xl:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
