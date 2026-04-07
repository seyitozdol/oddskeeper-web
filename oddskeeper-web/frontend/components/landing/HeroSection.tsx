const metricCards = [
  { label: "Data Reliability", value: "98.4%" },
  { label: "Match Coverage", value: "24/7" },
  { label: "Structured Layers", value: "6" },
];

const barHeights = [46, 68, 54, 82, 60, 74, 58];

const participantRows = [
  { label: "Participant coverage", value: "91%" },
  { label: "Event mapping", value: "Stable" },
  { label: "Analytical output", value: "Scalable" },
];

const bottomStats = [
  { label: "Signal Confidence", value: "82%" },
  { label: "Trend Strength", value: "+14%" },
  { label: "Output Velocity", value: "Fast" },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(19,176,255,0.09),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(36,203,255,0.06),transparent_22%),radial-gradient(circle_at_52%_88%,rgba(13,143,255,0.07),transparent_28%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute left-[8%] top-[16%] h-[220px] w-[220px] rounded-full bg-[#0aa8ff]/10 blur-3xl sm:h-[320px] sm:w-[320px]" />
        <div className="absolute right-[10%] top-[14%] h-[220px] w-[220px] rounded-full bg-[#25c8ff]/10 blur-3xl sm:h-[280px] sm:w-[280px]" />
        <div className="absolute bottom-[-90px] left-1/2 h-[180px] w-[320px] -translate-x-1/2 rounded-full bg-[#0d8fff]/8 blur-3xl sm:h-[260px] sm:w-[520px]" />
      </div>

      <div className="mx-auto grid min-h-[auto] w-full max-w-[1420px] items-center gap-8 px-4 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:pb-10 lg:pt-16">
        <div className="relative z-10 max-w-[620px] lg:pl-2">
          <div className="mb-4 inline-flex items-center rounded-full border border-[#13b0ff]/25 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#8bdfff] sm:mb-5 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.24em]">
            Sports Data Intelligence
          </div>

          <h1 className="max-w-[700px] text-[36px] font-semibold leading-[1.05] text-white sm:text-[48px] lg:text-[64px] xl:text-[68px]">
            Sports data intelligence for betting, trading, and enterprise
            workflows
          </h1>

          <p className="mt-5 max-w-[560px] text-[15px] leading-7 text-white/68 sm:mt-6 sm:text-[17px] sm:leading-8">
            Structured football data, analytical layers, and scalable
            infrastructure designed for trading teams, data providers, and
            enterprise-grade decision workflows.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4">
            <button className="rounded-2xl border border-[#13b0ff]/35 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.02]">
              Request Access
            </button>

            <button className="rounded-2xl border border-white/14 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/10">
              Explore Platform
            </button>
          </div>

          <p className="mt-5 text-sm text-white/45 sm:mt-6">
            Built for structured sports data operations — not noise, not
            guesswork.
          </p>
        </div>

        <div className="relative z-10 mt-2 lg:-ml-4 lg:mt-0">
          <div className="absolute inset-x-8 top-10 h-[78%] rounded-[44px] bg-[#0aa8ff]/8 blur-3xl sm:inset-x-16" />

          <div className="relative mx-auto w-full max-w-[720px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-3 shadow-[0_28px_110px_rgba(0,0,0,0.42)] backdrop-blur sm:rounded-[32px] sm:p-4">
            <div className="rounded-[20px] border border-white/8 bg-[#0a1320]/95 p-4 sm:rounded-[28px] sm:p-5 md:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {metricCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 sm:text-[11px] sm:tracking-[0.22em]">
                      {card.label}
                    </p>
                    <p className="mt-3 text-[24px] font-semibold leading-none text-white sm:text-[28px]">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 sm:text-[11px] sm:tracking-[0.22em]">
                          Analytical Trend
                        </p>
                        <p className="mt-2 text-[20px] font-semibold leading-tight text-white sm:text-[22px]">
                          Match intensity signal
                        </p>
                      </div>

                      <span className="rounded-full border border-[#13b0ff]/20 bg-[#13b0ff]/10 px-3 py-1 text-[11px] text-[#8bdfff]">
                        Live model layer
                      </span>
                    </div>

                    <div className="mt-5 rounded-[20px] border border-white/6 bg-[#08111d] p-4">
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

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 sm:text-[11px] sm:tracking-[0.22em]">
                          Signal Summary
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          Decision support layer
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/62">
                        Active
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {bottomStats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                        >
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                            {stat.label}
                          </p>
                          <p className="mt-2 text-[22px] font-semibold leading-none text-white sm:text-[26px]">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="text-sm leading-6 text-white/60">
                        Structured model outputs designed to reduce noise and
                        support faster trading interpretation.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 sm:text-[11px] sm:tracking-[0.22em]">
                          Team Module
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          Team performance layer
                        </p>
                        <p className="mt-2 max-w-[220px] text-sm leading-6 text-white/52">
                          Match-level structure for faster trading reads
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/62">
                        Ready
                      </span>
                    </div>

                    <div className="mt-4 flex items-end gap-2">
                      {barHeights.map((height, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t-xl bg-gradient-to-t from-[#0d8fff] to-[#63dcff]"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/38 sm:text-[11px] sm:tracking-[0.22em]">
                          Participant & Signal
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          Participant analytics
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/62">
                        Stable
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {participantRows.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <span className="text-sm text-white/70">
                            {row.label}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <span className="text-xs text-white/40">Shots</span>
                        <p className="mt-2 text-lg font-semibold text-white">
                          13.4
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <span className="text-xs text-white/40">xG Trend</span>
                        <p className="mt-2 text-lg font-semibold text-white">
                          +0.38
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[-10px] h-20 bg-gradient-to-b from-transparent to-[#06111f]" />
        </div>
      </div>
    </section>
  );
}