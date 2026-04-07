const audienceCards = [
  {
    eyebrow: "Trading Teams",
    title: "Built for faster internal decision support",
    description:
      "Use cleaner structured inputs to reduce friction in research, interpretation, and trading workflows.",
  },
  {
    eyebrow: "Data Providers",
    title: "Designed for repeatable data operations",
    description:
      "Support scalable delivery layers with architecture built for structure, consistency, and downstream use.",
  },
  {
    eyebrow: "Enterprise Partners",
    title: "Ready for broader analytical workflows",
    description:
      "Work from a foundation that supports operational clarity, future modeling, and controlled expansion.",
  },
];

export default function WhoItsForSection() {
  return (
    <section
      id="use-cases"
      className="scroll-mt-24 px-4 pb-16 pt-4 sm:px-6 lg:px-10 lg:pb-24 lg:pt-6"
    >
      <div className="mx-auto max-w-[1420px]">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.24em]">
            Who It&apos;s For
          </p>

          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Designed for teams that need more than dashboards
          </h2>

          <p className="mt-5 max-w-[700px] text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
            The platform is positioned for operational users who need structured
            football intelligence that can support real research, trading, and
            enterprise-level workflows.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-3">
          {audienceCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:rounded-[28px] sm:p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#13b0ff]/20 bg-[#13b0ff]/10 sm:h-12 sm:w-12">
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#13b0ff] to-[#7de8ff] sm:h-5 sm:w-5" />
              </div>

              <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#8bdfff] sm:mt-6 sm:text-[11px] sm:tracking-[0.22em]">
                {card.eyebrow}
              </p>

              <h3 className="mt-4 text-[28px] font-semibold leading-tight text-white sm:text-2xl">
                {card.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-white/60 sm:text-[15px]">
                {card.description}
              </p>

              <div className="mt-6 rounded-2xl border border-white/8 bg-[#0b1524]/70 px-4 py-3 sm:mt-8">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Audience
                </p>
                <p className="mt-2 text-sm font-medium text-white/88">
                  {card.eyebrow}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}