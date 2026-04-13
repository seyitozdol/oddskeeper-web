"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";

type AppHeaderProps = {
  userEmail?: string | null;
};

const FOOTBALL_LEAGUE_DETAIL_HREF =
  "/dashboard/stats-analysis/football/league-stats/detail?competition=S%C3%BCper%20Lig&season=2025%2F2026&tab=overview";

export default function AppHeader({ userEmail }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#07111f]/85 backdrop-blur-md">
      <div className="flex h-20 w-full items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#4da2ff]/30 bg-[#0b1a2b] shadow-[0_0_30px_rgba(77,162,255,0.10)]">
              <span className="bg-gradient-to-br from-[#8fd0ff] via-[#4da2ff] to-[#1b6fff] bg-clip-text text-lg font-bold text-transparent">
                OK
              </span>
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-[0.25em] text-white/55">
                ODDSKEEPER
              </div>
              <div className="text-base font-semibold text-white">
                Prediction Workspace
              </div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-3 md:flex">
          <Link
            href="/dashboard/smart-prediction"
            className={`rounded-2xl border px-5 py-2.5 text-sm font-medium transition ${
              pathname === "/dashboard/smart-prediction"
                ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_25px_rgba(77,162,255,0.15)]"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
            }`}
          >
            Smart Prediction
          </Link>

          <Link
            href="/dashboard/deep-prediction-ml"
            className={`rounded-2xl border px-5 py-2.5 text-sm font-medium transition ${
              pathname === "/dashboard/deep-prediction-ml"
                ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_25px_rgba(77,162,255,0.15)]"
                : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
            }`}
          >
            Deep Prediction ML
          </Link>

          <div className="group relative">
            <Link
              href="/dashboard/stats-analysis"
              className={`flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-medium transition ${
                isStatsActive
                  ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_25px_rgba(77,162,255,0.15)]"
                  : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
              }`}
            >
              <span>Stats & Analysis</span>
              <ChevronDownIcon />
            </Link>

            <div className="pointer-events-none absolute left-0 top-full z-50 pt-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
              <div className="w-[400px] rounded-[24px] border border-white/10 bg-[#121418]/95 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <StatsMenuItem
                  title="Football"
                  subtitle="Türkiye Super League"
                  iconSrc="/icons/football.svg"
                  playerHref="/dashboard/stats-analysis?sport=football&view=player"
                  teamHref="/dashboard/stats-analysis/football/team-stats"
                  leagueHref={FOOTBALL_LEAGUE_DETAIL_HREF}
                />

                <StatsMenuItem
                  title="Basketball"
                  subtitle="Türkiye Basketball Super League"
                  iconSrc="/icons/basketball.svg"
                  playerHref="/dashboard/stats-analysis?sport=basketball&view=player"
                  teamHref="/dashboard/stats-analysis?sport=basketball&view=team"
                />
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/75 transition hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
            title="Language"
          >
            <GlobeIcon />
          </button>

          <button
            type="button"
            className="flex h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/85 transition hover:border-[#4da2ff]/25 hover:bg-[#0e1d30]"
            title={userEmail ?? "User"}
          >
            <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#123255] text-xs text-[#9dd7ff]">
              {initials}
            </span>
            <UserIcon />
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex h-11 items-center gap-2 rounded-2xl border border-[#4da2ff]/25 bg-[#10233b] px-4 text-sm font-medium text-white transition hover:border-[#4da2ff]/45 hover:bg-[#14304f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOutIcon />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      <div className="px-6 pb-3 md:hidden lg:px-10">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/smart-prediction"
            className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
              pathname === "/dashboard/smart-prediction"
                ? "border-[#4da2ff]/40 bg-[#10233b] text-white"
                : "border-white/10 bg-white/[0.03] text-white/72"
            }`}
          >
            Smart Prediction
          </Link>

          <Link
            href="/dashboard/deep-prediction-ml"
            className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
              pathname === "/dashboard/deep-prediction-ml"
                ? "border-[#4da2ff]/40 bg-[#10233b] text-white"
                : "border-white/10 bg-white/[0.03] text-white/72"
            }`}
          >
            Deep Prediction ML
          </Link>

          <Link
            href="/dashboard/stats-analysis"
            className={`rounded-xl border px-4 py-2 text-xs font-medium transition ${
              isStatsActive
                ? "border-[#4da2ff]/40 bg-[#10233b] text-white"
                : "border-white/10 bg-white/[0.03] text-white/72"
            }`}
          >
            Stats & Analysis
          </Link>

          <Link
            href="/dashboard/stats-analysis?sport=football&view=player"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/72"
          >
            Football Player Stats
          </Link>

          <Link
            href="/dashboard/stats-analysis/football/team-stats"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/72"
          >
            Football Team Stats
          </Link>

          <Link
            href={FOOTBALL_LEAGUE_DETAIL_HREF}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/72"
          >
            Football League Details
          </Link>

          <Link
            href="/dashboard/stats-analysis?sport=basketball&view=player"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/72"
          >
            Basketball Player Stats
          </Link>

          <Link
            href="/dashboard/stats-analysis?sport=basketball&view=team"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/72"
          >
            Basketball Team Stats
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
};

function StatsMenuItem({
  title,
  subtitle,
  iconSrc,
  playerHref,
  teamHref,
  leagueHref,
}: StatsMenuItemProps) {
  return (
    <div className="group/item relative">
      <div className="flex items-start gap-4 rounded-[18px] px-4 py-4 transition hover:bg-white/[0.04]">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <Image
            src={iconSrc}
            alt={title}
            width={22}
            height={22}
            className="opacity-85"
          />
        </div>

        <div className="flex-1">
          <div className="text-[17px] font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/45">{subtitle}</div>
        </div>

        <div className="pt-2 text-white/35 transition group-hover/item:text-white/70">
          <ChevronRightIcon />
        </div>
      </div>

      <div className="pointer-events-none absolute left-[calc(100%-10px)] top-0 z-50 pl-4 opacity-0 transition duration-200 group-hover/item:pointer-events-auto group-hover/item:opacity-100">
        <div className="w-[280px] rounded-[22px] border border-white/10 bg-[#121418]/95 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <Link
            href={playerHref}
            className="flex items-start gap-3 rounded-[16px] px-4 py-4 transition hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <Image
                src="/icons/player.svg"
                alt="Player Stats"
                width={20}
                height={20}
                className="opacity-85"
              />
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                Player Stats
              </div>
              <div className="mt-1 text-sm text-white/45">
                Individual player data
              </div>
            </div>
          </Link>

          <Link
            href={teamHref}
            className="flex items-start gap-3 rounded-[16px] px-4 py-4 transition hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <Image
                src="/icons/team.svg"
                alt="Team Stats"
                width={20}
                height={20}
                className="opacity-85"
              />
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                Team Stats
              </div>
              <div className="mt-1 text-sm text-white/45">
                Team-level performance
              </div>
            </div>
          </Link>

          {leagueHref ? (
            <Link
              href={leagueHref}
              className="flex items-start gap-3 rounded-[16px] px-4 py-4 transition hover:bg-white/[0.04]"
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Image
                  src="/icons/team.svg"
                  alt="League Details"
                  width={20}
                  height={20}
                  className="opacity-85"
                />
              </div>

              <div>
                <div className="text-[15px] font-semibold text-white">
                  League Details
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Standings, fixtures, results and leaders
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
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

function UserIcon() {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
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
      className="h-4 w-4"
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

function ChevronRightIcon() {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}