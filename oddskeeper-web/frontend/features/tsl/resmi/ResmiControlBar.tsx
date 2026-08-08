"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import { RESMI_SECTIONS, type ResmiSection } from "../constants";
import type { LeagueConfig } from "../leagues";
import SeasonToggle from "../../../components/SeasonToggle";

const SECTION_KEY: Record<ResmiSection, string> = {
  league: "tsl.sectionLeague",
  players: "tsl.sectionPlayers",
  teams: "tsl.sectionTeams",
  results: "tsl.sectionResults",
  referees: "tsl.sectionReferees",
  playerRankings: "tsl.sectionPlayerRankings",
  teamRankings: "tsl.sectionTeamRankings",
  matchStatsModel: "tsl.sectionMatchStatsModel",
  playerStatsModel: "tsl.sectionPlayerStatsModel",
};

export default function ResmiControlBar({
  config,
  section,
  season,
}: {
  config: LeagueConfig;
  section: ResmiSection;
  season: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const leagueName = t(config.nameKey);

  const buildQuery = (over: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(over)) next.set(k, v);
    return next.toString();
  };
  const sectionHref = (s: ResmiSection) => `${pathname}?${buildQuery({ section: s })}`;

  return (
    <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Sol: lig amblemi + isim + bayrak */}
        <div className="flex items-center gap-3">
          <Link
            href={`${config.basePath}?season=${encodeURIComponent(season)}&section=league`}
            title={leagueName}
            className="flex items-center gap-3"
          >
            <Image
              src={config.logo}
              alt={leagueName}
              width={48}
              height={48}
              className="tsl-league-mark h-11 w-11 shrink-0 object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-ink">
              {leagueName}
            </span>
            <Image
              src="/images/flags/tr.png"
              alt="TR"
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-line"
            />
          </Link>
        </div>

        {/* Sag: sezon (BSL/EL/EC ile ortak SeasonToggle) */}
        <SeasonToggle seasons={config.seasons} current={season} />
      </div>

      {/* Alt: bolumler */}
      <div className="mt-3 flex items-center gap-1">
        {RESMI_SECTIONS.map((s) => {
          const active = s === section;
          return (
            <Link
              key={s}
              href={sectionHref(s)}
              className="relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition"
            >
              {active ? (
                <motion.span
                  layoutId="resmi-section-pill"
                  className="absolute inset-0 rounded-lg bg-accent-soft"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              ) : null}
              <span className={`relative ${active ? "text-accent-ink" : "text-ink-3 hover:text-ink-2"}`}>
                {t(SECTION_KEY[s])}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
