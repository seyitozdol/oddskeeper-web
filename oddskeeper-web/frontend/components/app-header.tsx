"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useI18n } from "../lib/i18n/LanguageProvider";
import { LOCALES, type Locale } from "../lib/i18n/config";
import type { Theme } from "../lib/theme";
import ThemeSelect from "./ThemeSelect";

type AppHeaderProps = {
  userEmail?: string | null;
  theme?: Theme;
};

const FOOTBALL_LEAGUE_DETAIL_HREF =
  "/dashboard/stats-analysis/football/league-stats/detail?competition=S%C3%BCper%20Lig&season=2025%2F2026&tab=overview";

const LOCALE_LABEL_KEYS: Record<Locale, string> = {
  en: "nav.english",
  tr: "nav.turkish",
};

export default function AppHeader({
  userEmail,
  theme = "night",
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const initials = userEmail ? userEmail.slice(0, 1).toUpperCase() : "U";
  const isStatsActive = pathname.startsWith("/dashboard/stats-analysis");

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
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-card-2">
              <span className="text-[13px] font-bold text-accent-ink">OK</span>
            </div>
            <span className="hidden text-sm font-semibold tracking-[0.14em] text-ink lg:block">
              ODDSKEEPER
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/dashboard/smart-prediction"
              className={navLinkClass(pathname === "/dashboard/smart-prediction")}
            >
              {t("nav.smartPrediction")}
            </Link>

            <Link
              href="/dashboard/deep-prediction-ml2"
              className={navLinkClass(
                pathname === "/dashboard/deep-prediction-ml2"
              )}
            >
              {t("nav.deepPredictionMl")}
            </Link>

            <Link
              href="/dashboard/match-predictions"
              className={navLinkClass(
                pathname === "/dashboard/match-predictions"
              )}
            >
              {t("nav.matchPredictions")}
            </Link>

            <Link
              href="/dashboard/player-market-prediction"
              className={navLinkClass(
                pathname === "/dashboard/player-market-prediction"
              )}
            >
              {t("nav.playerMarket")}
            </Link>

            <div className="group relative">
              <Link
                href="/dashboard/stats-analysis"
                className={`flex items-center gap-1.5 ${navLinkClass(
                  isStatsActive
                )}`}
              >
                <span>{t("nav.statsAnalysis")}</span>
                <ChevronDownIcon />
              </Link>

              <div className="pointer-events-none absolute left-0 top-full z-50 pt-2 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="w-[360px] rounded-xl border border-line bg-card p-2 shadow-lg">
                  <StatsMenuItem
                    title={t("nav.football")}
                    subtitle={t("nav.footballSubtitle")}
                    iconSrc="/icons/football.svg"
                    playerHref="/dashboard/stats-analysis/football/player-stats"
                    teamHref="/dashboard/stats-analysis/football/team-stats"
                    leagueHref={FOOTBALL_LEAGUE_DETAIL_HREF}
                    playerRankingsHref="/dashboard/stats-analysis/football/player-stats/metric"
                    teamRankingsHref="/dashboard/stats-analysis/football/team-stats/metric"
                  />

                  <StatsMenuItem
                    title={t("nav.basketball")}
                    subtitle={t("nav.basketballSubtitle")}
                    iconSrc="/icons/basketball.svg"
                    playerHref="/dashboard/stats-analysis?sport=basketball&view=player"
                    teamHref="/dashboard/stats-analysis?sport=basketball&view=team"
                  />
                </div>
              </div>
            </div>
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
          <Link
            href="/dashboard/smart-prediction"
            className={navLinkClass(pathname === "/dashboard/smart-prediction")}
          >
            {t("nav.smartPrediction")}
          </Link>

          <Link
            href="/dashboard/deep-prediction-ml2"
            className={navLinkClass(
              pathname === "/dashboard/deep-prediction-ml2"
            )}
          >
            {t("nav.deepPredictionMl")}
          </Link>

          <Link
            href="/dashboard/stats-analysis"
            className={navLinkClass(isStatsActive)}
          >
            {t("nav.statsAnalysis")}
          </Link>

          <Link
            href="/dashboard/stats-analysis/football/player-stats"
            className={navLinkClass(false)}
          >
            {t("nav.footballPlayerStats")}
          </Link>

          <Link
            href="/dashboard/stats-analysis/football/team-stats"
            className={navLinkClass(false)}
          >
            {t("nav.footballTeamStats")}
          </Link>

          <Link href={FOOTBALL_LEAGUE_DETAIL_HREF} className={navLinkClass(false)}>
            {t("nav.footballLeagueDetails")}
          </Link>

          <Link
            href="/dashboard/stats-analysis/football/player-stats/metric"
            className={navLinkClass(false)}
          >
            {t("nav.playerRankings")}
          </Link>

          <Link
            href="/dashboard/stats-analysis/football/team-stats/metric"
            className={navLinkClass(false)}
          >
            {t("nav.teamRankings")}
          </Link>
        </div>
      </div>
    </header>
  );
}

type StatsMenuItemProps = {
  title: string;
  subtitle: string;
  iconSrc: string;
  playerHref: string;
  teamHref: string;
  leagueHref?: string;
  playerRankingsHref?: string;
  teamRankingsHref?: string;
};

function StatsMenuItem({
  title,
  subtitle,
  iconSrc,
  playerHref,
  teamHref,
  leagueHref,
  playerRankingsHref,
  teamRankingsHref,
}: StatsMenuItemProps) {
  const { t } = useI18n();

  const links = [
    { href: playerHref, label: t("nav.playerStats") },
    { href: teamHref, label: t("nav.teamStats") },
    ...(leagueHref ? [{ href: leagueHref, label: t("nav.leagueDetails") }] : []),
    ...(playerRankingsHref
      ? [{ href: playerRankingsHref, label: t("nav.playerRankings") }]
      : []),
    ...(teamRankingsHref
      ? [{ href: teamRankingsHref, label: t("nav.teamRankings") }]
      : []),
  ];

  return (
    <div className="rounded-lg p-2 transition hover:bg-veil">
      <div className="flex items-center gap-2.5 px-1 pb-1.5">
        <Image
          src={iconSrc}
          alt={title}
          width={16}
          height={16}
          className="opacity-85"
        />
        <div>
          <span className="text-[13px] font-semibold text-ink">{title}</span>
          <span className="ml-2 text-[11px] text-ink-3">{subtitle}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-line bg-veil px-2.5 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
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

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
