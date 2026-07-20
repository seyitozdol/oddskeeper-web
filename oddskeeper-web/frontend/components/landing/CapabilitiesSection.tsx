import { getT } from "@/lib/i18n/server";

export default async function CapabilitiesSection() {
  const t = await getT();

  const capabilities = [
    {
      eyebrowKey: "landing.capMatchTeamEyebrow",
      titleKey: "landing.capMatchTeamTitle",
      descriptionKey: "landing.capMatchTeamDescription",
    },
    {
      eyebrowKey: "landing.capPlayerLayersEyebrow",
      titleKey: "landing.capPlayerLayersTitle",
      descriptionKey: "landing.capPlayerLayersDescription",
    },
    {
      eyebrowKey: "landing.capPipelineEyebrow",
      titleKey: "landing.capPipelineTitle",
      descriptionKey: "landing.capPipelineDescription",
    },
  ];

  return (
    <section
      id="platform"
      className="scroll-mt-24 px-4 pb-14 pt-12 sm:px-6 lg:px-10 lg:pb-20 lg:pt-16"
    >
      <div className="mx-auto max-w-[1420px]">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent-ink sm:text-[11px] sm:tracking-[0.24em]">
            {t("landing.capabilitiesKicker")}
          </p>

          <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink sm:text-3xl lg:text-4xl">
            {t("landing.capabilitiesTitle")}
          </h2>

          <p className="mt-5 max-w-[680px] text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">
            {t("landing.capabilitiesDescription")}
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:mt-10 lg:grid-cols-3">
          {capabilities.map((item) => (
            <div
              key={item.titleKey}
              className="group rounded-xl border border-line bg-card p-5 transition hover:border-line-strong hover:bg-card-2 sm:rounded-2xl sm:p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong bg-accent-soft sm:h-12 sm:w-12">
                <div className="h-4 w-4 rounded-full bg-accent sm:h-5 sm:w-5" />
              </div>

              <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-ink sm:mt-6 sm:text-[11px] sm:tracking-[0.22em]">
                {t(item.eyebrowKey)}
              </p>

              <h3 className="mt-4 text-xl font-semibold leading-tight text-ink sm:text-2xl">
                {t(item.titleKey)}
              </h3>

              <p className="mt-4 text-sm leading-7 text-ink-2 sm:text-[15px]">
                {t(item.descriptionKey)}
              </p>

              <div className="mt-6 rounded-2xl border border-line bg-card-2 p-4 sm:mt-8">
                <div className="flex items-end gap-2">
                  <div className="h-8 flex-1 rounded-t-xl bg-accent sm:h-10" />
                  <div className="h-12 flex-1 rounded-t-xl bg-accent sm:h-16" />
                  <div className="h-9 flex-1 rounded-t-xl bg-accent sm:h-12" />
                  <div className="h-14 flex-1 rounded-t-xl bg-accent sm:h-20" />
                  <div className="h-10 flex-1 rounded-t-xl bg-accent sm:h-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
