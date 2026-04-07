const navItems = [
  { label: "Platform", href: "#platform" },
  { label: "Data Layers", href: "#data-layers" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#06111f]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1420px] items-center justify-between px-4 sm:h-18 sm:px-6 lg:h-20 lg:px-10">
        <a href="#" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#13b0ff]/40 bg-white/5 shadow-[0_0_30px_rgba(19,176,255,0.12)] sm:h-10 sm:w-10">
            <span className="bg-gradient-to-r from-[#13b0ff] to-[#7de8ff] bg-clip-text text-xs font-semibold text-transparent sm:text-sm">
              OK
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide text-white">
              OddsKeeper
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-[11px]">
              Sports Data Intelligence
            </span>
          </div>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-white/70 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <a
            href="#contact"
            className="inline-flex rounded-xl border border-[#13b0ff]/40 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.02]"
          >
            Request Access
          </a>
        </div>

        <details className="relative lg:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white marker:hidden">
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-4 rounded bg-white" />
              <span className="block h-0.5 w-4 rounded bg-white" />
              <span className="block h-0.5 w-4 rounded bg-white" />
            </span>
          </summary>

          <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-[#0b1524]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm text-white/75 transition hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <a
              href="#contact"
              className="mt-3 inline-flex w-full justify-center rounded-xl border border-[#13b0ff]/40 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Request Access
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}