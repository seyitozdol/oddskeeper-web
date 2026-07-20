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
    <footer className="border-t border-line px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1420px] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-veil">
              <span className="text-sm font-semibold text-accent-ink">
                OK
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-ink">
                OddsKeeper
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-ink-3">
                {t("landing.brandTagline")}
              </span>
            </div>
          </a>

          <p className="mt-3 text-sm leading-6 text-ink-3">
            {t("landing.footerTagline")}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {footerLinks.map((item) => (
            <a
              key={item.labelKey}
              href={item.href}
              className="text-sm text-ink-2 transition hover:text-ink"
            >
              {t(item.labelKey)}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
