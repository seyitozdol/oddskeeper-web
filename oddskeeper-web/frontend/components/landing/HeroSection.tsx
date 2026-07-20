import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const barHeights = [46, 68, 54, 82, 60, 74, 58];

export default async function HeroSection() {
  const t = await getT();

  const metricCards = [
    { labelKey: "landing.metricDataReliability", value: "98.4%" },
    { labelKey: "landing.metricMatchCoverage", value: "24/7" },
    { labelKey: "landing.metricStructuredLayers", value: "6" },
  ];

  const participantRows = [
    { labelKey: "landing.participantCoverage", value: "91%" },
    { labelKey: "landing.eventMapping", value: t("landing.statusStable") },
    { labelKey: "landing.analyticalOutput", value: t("landing.statusStable") },
  ];

  const bottomStats = [
    { labelKey: "landing.statSignalConfidence", value: "82%" },
    { labelKey: "landing.statTrendStrength", value: "+14%" },
    { labelKey: "landing.statOutputVelocity", value: t("landing.statusFast") },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,var(--accent-soft),transparent_26%),radial-gradient(circle_at_82%_18%,var(--accent-soft),transparent_22%),radial-gradient(circle_at_52%_88%,var(--accent-soft),transparent_28%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute left-[8%] top-[16%] h-[220px] w-[220px] rounded-full bg-accent/10 blur-3xl sm:h-[320px] sm:w-[320px]" />
        <div className="absolute right-[10%] top-[14%] h-[220px] w-[220px] rounded-full bg-accent/10 blur-3xl sm:h-[280px] sm:w-[280px]" />
        <div className="absolute bottom-[-90px] left-1/2 h-[180px] w-[320px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl sm:h-[260px] sm:w-[520px]" />
      </div>

      <div className="mx-auto grid min-h-[auto] w-full max-w-[1420px] items-center gap-8 px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:pb-8 lg:pt-14">
        <div className="relative z-10 max-w-[620px] lg:pl-2">
          <div className="mb-4 inline-flex items-center rounded-full border border-line-strong bg-veil px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-accent-ink sm:mb-5 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.24em]">
            {t("landing.brandTagline")}
          </div>

          <h1 className="max-w-[700px] text-3xl font-semibold leading-[1.05] text-ink sm:text-4xl lg:text-5xl xl:text-6xl">
            {t("landing.heroTitle")}
          </h1>

          <p className="mt-5 max-w-[560px] text-[15px] leading-7 text-ink-2 sm:mt-6 sm:text-[17px] sm:leading-8">
            {t("landing.heroDescription")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4">
            <a
              href="#contact"
              className="inline-flex justify-center rounded-2xl bg-accent px-6 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
            >
              {t("landing.requestAccess")}
            </a>

            <Link
              href="/sign-in"
              className="inline-flex justify-center rounded-2xl border border-line bg-veil px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-card-2"
            >
              {t("landing.explorePlatform")}
            </Link>
          </div>

          <p className="mt-5 text-sm text-ink-3 sm:mt-6">
            {t("landing.heroFootnote")}
          </p>
        </div>

        <div className="relative z-10 mt-2 lg:-ml-4 lg:mt-0">
          <div className="absolute inset-x-8 top-10 h-[78%] rounded-full bg-accent/10 blur-3xl sm:inset-x-16" />

          <div className="relative mx-auto w-full max-w-[720px] rounded-xl border border-line bg-card-2 p-3 backdrop-blur sm:rounded-2xl sm:p-4">
            <div className="rounded-xl border border-line bg-card p-4 sm:rounded-2xl sm:p-5 md:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {metricCards.map((card) => (
                  <div
                    key={card.labelKey}
                    className="rounded-2xl border border-line bg-card-2 p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:text-[11px] sm:tracking-[0.22em]">
                      {t(card.labelKey)}
                    </p>
                    <p className="mt-3 text-[24px] font-semibold leading-none text-ink sm:text-[28px]">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-line bg-card-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:text-[11px] sm:tracking-[0.22em]">
                          {t("landing.analyticalTrendLabel")}
                        </p>
                        <p className="mt-2 text-[20px] font-semibold leading-tight text-ink sm:text-[22px]">
                          {t("landing.matchIntensitySignal")}
                        </p>
                      </div>

                      <span className="rounded-full border border-line-strong bg-accent-soft px-3 py-1 text-[11px] text-accent-ink">
                        {t("landing.liveModelLayer")}
                      </span>
                    </div>

                    <div className="mt-5 rounded-xl border border-line bg-field p-4">
                      <svg
                        viewBox="0 0 340 140"
                        className="h-32 w-full sm:h-36"
                        fill="none"
                      >
                        <defs>
                          <linearGradient
                            id="chartStrokeMain"
                            x1="0"
                            y1="0"
                            x2="340"
                            y2="0"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop stopColor="#13b0ff" />
                            <stop offset="1" stopColor="#7de8ff" />
                          </linearGradient>

                          <linearGradient
                            id="chartFillMain"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="140"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop stopColor="rgba(19,176,255,0.22)" />
                            <stop offset="1" stopColor="rgba(19,176,255,0)" />
                          </linearGradient>
                        </defs>

                        <path
                          d="M10 112 C45 108, 62 100, 86 88 S137 92, 164 74 S218 76, 244 54 S296 58, 328 28"
                          stroke="url(#chartStrokeMain)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />

                        <path
                          d="M10 112 C45 108, 62 100, 86 88 S137 92, 164 74 S218 76, 244 54 S296 58, 328 28 L328 140 L10 140 Z"
                          fill="url(#chartFillMain)"
                        />

                        <circle cx="86" cy="88" r="4" fill="#13b0ff" />
                        <circle cx="164" cy="74" r="4" fill="#13b0ff" />
                        <circle cx="244" cy="54" r="4" fill="#13b0ff" />
                        <circle cx="328" cy="28" r="5" fill="#7de8ff" />
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-card-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:text-[11px] sm:tracking-[0.22em]">
                          {t("landing.signalSummaryLabel")}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-ink">
                          {t("landing.decisionSupportLayer")}
                        </p>
                      </div>

                      <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                        {t("landing.statusActive")}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {bottomStats.map((stat) => (
                        <div
                          key={stat.labelKey}
                          className="rounded-xl border border-line bg-card p-4"
                        >
                          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
                            {t(stat.labelKey)}
                          </p>
                          <p className="mt-2 text-[22px] font-semibold leading-none text-ink sm:text-[26px]">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-line bg-card px-4 py-3">
                      <p className="text-sm leading-6 text-ink-2">
                        {t("landing.modelOutputsDescription")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-line bg-card-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:text-[11px] sm:tracking-[0.22em]">
                          {t("landing.teamModuleLabel")}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-ink">
                          {t("landing.teamPerformanceLayer")}
                        </p>
                        <p className="mt-2 max-w-[220px] text-sm leading-6 text-ink-3">
                          {t("landing.teamPerformanceDescription")}
                        </p>
                      </div>

                      <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                        {t("landing.statusReady")}
                      </span>
                    </div>

                    <div className="mt-4 flex items-end gap-2">
                      {barHeights.map((height, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t-xl bg-accent"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-card-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:text-[11px] sm:tracking-[0.22em]">
                          {t("landing.participantSignalLabel")}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-ink">
                          {t("landing.participantAnalyticsTitle")}
                        </p>
                      </div>

                      <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                        {t("landing.statusStable")}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {participantRows.map((row) => (
                        <div
                          key={row.labelKey}
                          className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-3"
                        >
                          <span className="text-sm text-ink-2">
                            {t(row.labelKey)}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-line bg-card p-3">
                        <span className="text-xs text-ink-3">
                          {t("landing.shotsLabel")}
                        </span>
                        <p className="mt-2 text-lg font-semibold text-ink">
                          13.4
                        </p>
                      </div>

                      <div className="rounded-xl border border-line bg-card p-3">
                        <span className="text-xs text-ink-3">
                          {t("landing.xgTrendLabel")}
                        </span>
                        <p className="mt-2 text-lg font-semibold text-ink">
                          +0.38
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[-10px] h-20 bg-gradient-to-b from-transparent to-canvas" />
        </div>
      </div>
    </section>
  );
}
