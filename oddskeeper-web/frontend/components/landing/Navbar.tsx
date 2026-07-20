import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function Navbar() {
  const t = await getT();

  const navItems = [
    { label: t("landing.navPlatform"), href: "#platform" },
    { label: t("landing.navDataLayers"), href: "#data-layers" },
    { label: t("landing.navUseCases"), href: "#use-cases" },
    { label: t("landing.navContact"), href: "#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1420px] items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-veil sm:h-10 sm:w-10">
            <span className="text-xs font-semibold text-accent-ink sm:text-sm">
              OK
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide text-ink">
              OddsKeeper
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-3 sm:text-[11px]">
              {t("landing.brandTagline")}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-ink-2 transition hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#contact"
            className="inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
          >
            {t("landing.requestAccess")}
          </a>

          <Link
            href="/sign-up"
            className="inline-flex rounded-xl border border-line bg-veil px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-card-2"
          >
            {t("landing.signUp")}
          </Link>

          <Link
            href="/sign-in"
            className="inline-flex rounded-xl border border-line bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-veil"
          >
            {t("landing.signIn")}
          </Link>
        </div>

        <details className="relative lg:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-veil text-ink marker:hidden">
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-4 rounded bg-ink" />
              <span className="block h-0.5 w-4 rounded bg-ink" />
              <span className="block h-0.5 w-4 rounded bg-ink" />
            </span>
          </summary>

          <div className="absolute right-0 mt-3 w-64 rounded-xl border border-line bg-card p-3 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm text-ink-2 transition hover:bg-veil hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <a
                href="#contact"
                className="inline-flex w-full justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent"
              >
                {t("landing.requestAccess")}
              </a>

              <Link
                href="/sign-up"
                className="inline-flex w-full justify-center rounded-xl border border-line bg-veil px-4 py-2.5 text-sm font-semibold text-ink"
              >
                {t("landing.signUp")}
              </Link>

              <Link
                href="/sign-in"
                className="inline-flex w-full justify-center rounded-xl border border-line bg-transparent px-4 py-2.5 text-sm font-semibold text-ink"
              >
                {t("landing.signIn")}
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
