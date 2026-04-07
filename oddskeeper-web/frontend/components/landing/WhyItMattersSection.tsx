const benefitCards = [
  {
    title: "Faster research workflows",
    text: "Reduce time spent cleaning and interpreting scattered match information.",
  },
  {
    title: "Cleaner analytical inputs",
    text: "Work with structured layers that support more reliable downstream analysis.",
  },
  {
    title: "Scalable data architecture",
    text: "Build on a system designed for repeatable growth, not one-off manual handling.",
  },
  {
    title: "Built for operational use",
    text: "Support trading and enterprise teams with outputs designed for real workflows.",
  },
];

export default function WhyItMattersSection() {
  return (
    <section className="px-4 pb-16 pt-4 sm:px-6 lg:px-10 lg:pb-24 lg:pt-6">
      <div className="mx-auto grid max-w-[1420px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="max-w-[620px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.24em]">
            Why It Matters
          </p>

          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Cleaner structure leads to better decisions
          </h2>

          <p className="mt-5 text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
            Weak data structure slows research, creates noisy interpretation,
            and weakens downstream workflows. This platform is built to reduce
            friction, improve clarity, and support more reliable operational
            decision-making.
          </p>

          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-5 sm:mt-8 sm:rounded-[24px]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8bdfff] sm:text-[11px] sm:tracking-[0.22em]">
              Operational Value
            </p>
            <p className="mt-3 text-sm leading-7 text-white/60 sm:text-[15px]">
              Structured football intelligence is only useful when it becomes
              repeatable, readable, and usable across research, modeling, and
              trading workflows.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {benefitCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:rounded-[28px] sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#13b0ff]/20 bg-[#13b0ff]/10 sm:h-11 sm:w-11">
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#13b0ff] to-[#7de8ff]" />
              </div>

              <h3 className="mt-5 text-[28px] font-semibold leading-tight text-white sm:mt-6 sm:text-2xl">
                {card.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-white/60 sm:text-[15px]">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}