import { getT } from "@/lib/i18n/server";

export default async function Footer() {
  const t = await getT();

  const footerLinks = [
    { labelKey: "landing.navPlatform", href: "#platform" },
    { labelKey: "landing.navDataLayers", href: "#data-layers" },
    { labelKey: "landing.navUseCases", href: "#use-cases" },
    { labelKey: "landing.navContact", href: "#contact" },
  ];

  return (
    <footer className="border-t border-white/8 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1420px] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#13b0ff]/40 bg-white/5 shadow-[0_0_30px_rgba(19,176,255,0.12)]">
              <span className="bg-gradient-to-r from-[#13b0ff] to-[#7de8ff] bg-clip-text text-sm font-semibold text-transparent">
                OK
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-white">
                OddsKeeper
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                {t("landing.brandTagline")}
              </span>
            </div>
          </a>

          <p className="mt-3 text-sm leading-6 text-white/45">
            {t("landing.footerTagline")}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {footerLinks.map((item) => (
            <a
              key={item.labelKey}
              href={item.href}
              className="text-sm text-white/55 transition hover:text-white"
            >
              {t(item.labelKey)}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
