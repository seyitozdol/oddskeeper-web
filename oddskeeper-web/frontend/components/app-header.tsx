"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { createClient } from "../lib/supabase/client";
import { useI18n } from "../lib/i18n/LanguageProvider";
import { LOCALES, type Locale } from "../lib/i18n/config";
import { THEMES, type Theme } from "../lib/theme";
import { isNavKeyAllowed, type NavKey } from "../lib/nav-permissions";
import ThemeSelect from "./ThemeSelect";
import { ClipboardList } from "lucide-react";

type AppHeaderProps = {
  userEmail?: string | null;
  theme?: Theme;
  // null = kisitlama yok; dizi = sadece listelenen basliklar gorunur
  allowedNavKeys?: string[] | null;
  isAdmin?: boolean;
};

// TSL kisayolu dogrudan "Resmi" deneyimine gider (ara secim ekrani yok).
const TSL_HUB_HREF =
  "/dashboard/stats-analysis/tsl/resmi?season=2026%2F2027&section=league";

// 1. Lig kisayolu da dogrudan "Resmi" deneyimine gider.
const TFF1_RESMI_HREF =
  "/dashboard/stats-analysis/tff1/resmi?season=2026%2F2027&section=league";

// TBL (Türkiye Basketbol Süper Ligi) lig panosu.
const BASKETBALL_LEAGUE_HREF = "/dashboard/basketball";

// Header'daki lig kisayollari: iki grup — Football (TSL, 1.Lig) ve Basketball
// (BSL, EuroLeague, EuroCup). Simgeler inline SVG mark ya da public logo (logoSrc).
type LeagueItem = {
  key: string;
  navKey: NavKey;
  label: string;
  href: string;
  group: "football" | "basketball" | "volleyball";
  Icon?: (props: { className?: string }) => ReactElement;
  logoSrc?: string;
  competition?: string;
  sport?: string;
};

// Voleybol panosu (Türkiye kadın milli takım).
const VOLLEYBALL_HREF = "/dashboard/volleyball";

// Upcoming Events header markasi: her tema kendi logosuyla (public/images/brand).
// Yazi yerine logo gorunur; masaustunde hover'da "Upcoming Events" metni acilir.
const UPCOMING_LOGO_SRC: Record<Theme, string> = {
  night: "/images/brand/upcoming-events-night.svg",
  "calimla-light": "/images/brand/upcoming-events-calimla-light.svg",
  "calimla-dark": "/images/brand/upcoming-events-calimla-dark.svg",
};

// OddsKeeper markasi: her tema kendi renk varyantiyla (logo iki tonu = temanin
// accent + accent-ink). night=mavi (transparent), calimla-light=duz kirmizi
// (cream), calimla-dark=kirmizi+bakir (brown). Desktop'ta wordmark, mobilde mark.
const BRAND_WORDMARK: Record<Theme, string> = {
  night: "/logos/logo-header-40px@2x.png",
  "calimla-light": "/logos/logo-header-cream-40px@2x.png",
  "calimla-dark": "/logos/logo-header-brown-40px@2x.png",
};
const BRAND_MARK: Record<Theme, string> = {
  night: "/logos/logo-mark-transparent-512.png",
  "calimla-light": "/logos/logo-mark-cream-512.png",
  "calimla-dark": "/logos/logo-mark-brown-512.png",
};

// Tema-bagimli logolar: uc varyanti da render et; aktif olan CSS ile gorunur
// (globals.css [data-theme-show] + display:contents). Boylece tema degisince
// data-theme takasi aninda ve tek karede dogru logoyu gosterir (server refresh
// yok, parca parca indirme yok; hepsi ilk yuklemede on-bellege alinir).
function ThemedBrand() {
  return (
    <>
      {THEMES.map((th) => (
        <span key={th} data-theme-show={th}>
          <Image src={BRAND_MARK[th]} alt="OddsKeeper" width={512} height={512} className="h-8 w-8 object-contain lg:hidden" priority />
          <Image src={BRAND_WORDMARK[th]} alt="OddsKeeper" width={463} height={80} className="hidden h-7 w-auto object-contain lg:block" priority />
        </span>
      ))}
    </>
  );
}

function ThemedUpcomingLogo({ imgClassName, alt }: { imgClassName: string; alt: string }) {
  return (
    <>
      {THEMES.map((th) => (
        <span key={th} data-theme-show={th}>
          <Image src={UPCOMING_LOGO_SRC[th]} alt={alt} width={24} height={24} className={imgClassName} priority />
        </span>
      ))}
    </>
  );
}

const LEAGUE_ITEMS: LeagueItem[] = [
  { key: "tsl", navKey: "league-tsl", label: "TSL", Icon: TslMark, href: TSL_HUB_HREF, group: "football" },
  { key: "1lig", navKey: "league-1lig", label: "1.Lig", Icon: Lig1Mark, href: TFF1_RESMI_HREF, group: "football" },
  { key: "tbl", navKey: "league-tbl", label: "BSL", Icon: TblMark, href: BASKETBALL_LEAGUE_HREF, group: "basketball", sport: "basketball" },
  { key: "euroleague", navKey: "league-tbl", label: "EL", logoSrc: "/images/leagues/euroleague.svg", href: "/dashboard/euro/euroleague", group: "basketball", sport: "basketball" },
  { key: "eurocup", navKey: "league-tbl", label: "EC", logoSrc: "/images/leagues/eurocup.svg", href: "/dashboard/euro/eurocup", group: "basketball", sport: "basketball" },
  // Logo yerine Türkiye bayrağı + "Volleyball" (kadın milli takım).
  { key: "volleyball", navKey: "volleyball", label: "Volleyball", logoSrc: "/images/flags/tr.png", href: VOLLEYBALL_HREF, group: "volleyball" },
];

// Lig kisayolu markasi (inline SVG ya da public logo).
function LeagueMark({ item }: { item: LeagueItem }) {
  if (item.logoSrc) {
    return <Image src={item.logoSrc} alt={item.label} width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />;
  }
  if (item.Icon) return <item.Icon className="h-4 w-4 shrink-0" />;
  return null;
}

// Yenilikler (What's New) markasi: altigen icinde parilti. currentColor
// kullandigi icin temanin accent rengini otomatik alir (night mavi,
// calimla-light/dark kirmizi); ayri logo dosyasi gerekmez.
function WhatsNewMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path
        d="M12 2.6 20.1 7.3v9.4L12 21.4 3.9 16.7V7.3L12 2.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M11 8.3 Q11 12.2 14.9 12.2 Q11 12.2 11 16.1 Q11 12.2 7.1 12.2 Q11 12.2 11 8.3 Z"
        fill="currentColor"
      />
      <path
        d="M15.4 6.4 Q15.4 8.3 17.3 8.3 Q15.4 8.3 15.4 10.2 Q15.4 8.3 13.5 8.3 Q15.4 8.3 15.4 6.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const LOCALE_LABEL_KEYS: Record<Locale, string> = {
  en: "nav.english",
  tr: "nav.turkish",
};

export default function AppHeader({
  userEmail,
  theme = "night",
  allowedNavKeys = null,
  isAdmin = false,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const initials = userEmail ? userEmail.slice(0, 1).toUpperCase() : "U";
  const isUpcomingActive = pathname.startsWith("/dashboard/upcoming-events");
  const isChangelogActive = pathname.startsWith("/dashboard/changelog");
  const isAdminActive = pathname.startsWith("/dashboard/admin");

  const isLeagueActive = (item: (typeof LEAGUE_ITEMS)[number]) => {
    if (item.key === "tsl") {
      return pathname.startsWith("/dashboard/stats-analysis/tsl");
    }
    if (item.key === "1lig") {
      return pathname.startsWith("/dashboard/stats-analysis/tff1");
    }
    if (item.key === "tbl") {
      return pathname.startsWith("/dashboard/basketball");
    }
    if (item.key === "euroleague") {
      return pathname.startsWith("/dashboard/euro/euroleague");
    }
    if (item.key === "eurocup") {
      return pathname.startsWith("/dashboard/euro/eurocup");
    }
    if (item.key === "volleyball") {
      return pathname.startsWith("/dashboard/volleyball");
    }
    return false;
  };

  const can = (key: NavKey) => isNavKeyAllowed(key, allowedNavKeys);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      const supabase = createClient();
      await supabase.auth.signOut();

      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsSigningOut(false);
    }
  }

  const navLinkClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
      active
        ? "bg-card-2 text-ink"
        : "text-ink-2 hover:bg-veil hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="OddsKeeper">
            {/* Mobilde kare marka, masaüstünde wordmark; tüm tema varyantları
                DOM'da, aktif olan CSS ile anlık gösterilir */}
            <ThemedBrand />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {can("upcoming-events") ? (
              <Link
                href="/dashboard/upcoming-events"
                title={t("nav.upcomingEvents")}
                aria-label={t("nav.upcomingEvents")}
                className={`ue-trigger group/ue flex items-center ${navLinkClass(
                  isUpcomingActive
                )}`}
              >
                <ThemedUpcomingLogo
                  imgClassName="ue-logo h-6 w-6 shrink-0 rounded-full object-contain"
                  alt={t("nav.upcomingEvents")}
                />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/ue:ml-2 group-hover/ue:max-w-[160px] group-hover/ue:opacity-100">
                  {t("nav.upcomingEvents")}
                </span>
              </Link>
            ) : null}

            {(["football", "basketball", "volleyball"] as const).map((grp) => {
              const items = LEAGUE_ITEMS.filter((item) => item.group === grp && can(item.navKey));
              if (items.length === 0) return null;
              return (
                <div key={grp} className="flex items-center gap-1 border-l border-line pl-2">
                  {items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center gap-1.5 ${navLinkClass(isLeagueActive(item))}`}
                    >
                      <LeagueMark item={item} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              );
            })}

            {can("changelog") ? (
              <Link
                href="/dashboard/changelog"
                aria-label={t("nav.changelog")}
                title={t("nav.changelog")}
                className={`flex items-center ${navLinkClass(isChangelogActive)}`}
              >
                <WhatsNewMark className="h-5 w-5 shrink-0 text-accent" />
              </Link>
            ) : null}

            {/* Kadro denetimi: herkese acik, izin gate'i yok. */}
            <Link
              href="/dashboard/squad-audit"
              aria-label={t("nav.squadAudit")}
              title={t("nav.squadAudit")}
              className={`flex items-center ${navLinkClass(pathname.startsWith("/dashboard/squad-audit"))}`}
            >
              <ClipboardList className="h-5 w-5 shrink-0" />
            </Link>

            {isAdmin ? (
              <Link
                href="/dashboard/admin/users"
                className={navLinkClass(isAdminActive)}
              >
                {t("nav.admin")}
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeSelect currentTheme={theme} />

          <div className="group relative">
            <button
              type="button"
              onClick={() => setIsLangOpen((prev) => !prev)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-veil px-2.5 text-ink-2 transition hover:border-line-strong hover:text-ink"
              title={t("nav.language")}
            >
              <GlobeIcon />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                {locale}
              </span>
            </button>

            <div
              className={`absolute right-0 top-full z-50 pt-2 transition duration-200 ${
                isLangOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
              }`}
            >
              <div className="w-[160px] rounded-xl border border-line bg-card p-1.5 shadow-lg">
                {LOCALES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setLocale(option);
                      setIsLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] transition hover:bg-veil ${
                      locale === option
                        ? "font-semibold text-ink"
                        : "text-ink-2"
                    }`}
                  >
                    <span>{t(LOCALE_LABEL_KEYS[option])}</span>
                    {locale === option ? <CheckIcon /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-veil text-[12px] font-semibold text-accent-ink"
            title={userEmail ?? "User"}
          >
            {initials}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-veil px-3 text-[13px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOutIcon />
            <span className="hidden sm:block">
              {isSigningOut ? t("nav.signingOut") : t("nav.signOut")}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 pb-2 md:hidden">
        <div className="flex flex-wrap gap-1.5">
          {can("upcoming-events") ? (
            <Link
              href="/dashboard/upcoming-events"
              aria-label={t("nav.upcomingEvents")}
              className={`ue-trigger flex items-center gap-2 ${navLinkClass(
                isUpcomingActive
              )}`}
            >
              <ThemedUpcomingLogo
                imgClassName="ue-logo h-[22px] w-[22px] shrink-0 rounded-full object-contain"
                alt={t("nav.upcomingEvents")}
              />
              <span>{t("nav.upcomingEvents")}</span>
            </Link>
          ) : null}

          {LEAGUE_ITEMS.filter((item) => can(item.navKey)).map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-1.5 ${navLinkClass(
                isLeagueActive(item)
              )}`}
            >
              <LeagueMark item={item} />
              <span>{item.label}</span>
            </Link>
          ))}

          {can("changelog") ? (
            <Link
              href="/dashboard/changelog"
              aria-label={t("nav.changelog")}
              title={t("nav.changelog")}
              className={`flex items-center ${navLinkClass(isChangelogActive)}`}
            >
              <WhatsNewMark className="h-5 w-5 shrink-0 text-accent" />
            </Link>
          ) : null}

          <Link
            href="/dashboard/squad-audit"
            aria-label={t("nav.squadAudit")}
            title={t("nav.squadAudit")}
            className={`flex items-center ${navLinkClass(pathname.startsWith("/dashboard/squad-audit"))}`}
          >
            <ClipboardList className="h-5 w-5 shrink-0" />
          </Link>

          {isAdmin ? (
            <Link
              href="/dashboard/admin/users"
              className={navLinkClass(isAdminActive)}
            >
              {t("nav.admin")}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// Gercek lig amblemleri (SofaScore görselleri, repoda). TBL hala inline SVG.
function TslMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/leagues/super-lig.png"
      alt="TSL"
      width={16}
      height={16}
      className={`${className ?? ""} tsl-league-mark object-contain`}
    />
  );
}

function Lig1Mark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/leagues/tff-1-lig.png"
      alt="1.Lig"
      width={16}
      height={16}
      className={`${className ?? ""} tsl-league-mark object-contain`}
    />
  );
}

// BSL amblemi: /images/leagues/bsl.svg (resmi BSL topu buraya konunca değişir)
function TblMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/leagues/bsl.svg"
      alt="BSL"
      width={16}
      height={16}
      className={`${className ?? ""} object-contain`}
    />
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
