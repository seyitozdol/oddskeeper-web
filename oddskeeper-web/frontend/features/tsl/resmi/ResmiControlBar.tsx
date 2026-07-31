"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import {
  RESMI_SECTIONS,
  TSL_BASE_PATH,
  TSL_SEASONS,
  type ResmiSection,
  type TslSeason,
} from "../constants";

const SECTION_KEY: Record<ResmiSection, string> = {
  league: "tsl.sectionLeague",
  players: "tsl.sectionPlayers",
  teams: "tsl.sectionTeams",
  ranking: "tsl.sectionRanking",
};

export default function ResmiControlBar({
  section,
  season,
}: {
  section: ResmiSection;
  season: TslSeason;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();

  const buildQuery = (over: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(over)) next.set(k, v);
    return next.toString();
  };
  const sectionHref = (s: ResmiSection) => `${pathname}?${buildQuery({ section: s })}`;
  const seasonHref = (s: TslSeason) => `${pathname}?${buildQuery({ season: s })}`;

  return (
    <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Sol: lig amblemi + isim + bayrak */}
        <div className="flex items-center gap-3">
          <Link
            href={TSL_BASE_PATH}
            title={t("tsl.backToDesigns")}
            className="flex items-center gap-3"
          >
            <Image
              src="/images/leagues/super-lig.png"
              alt={t("tsl.leagueName")}
              width={34}
              height={34}
              className="tsl-league-mark h-8 w-8 shrink-0 object-contain"
            />
            <span className="text-[15px] font-bold tracking-tight text-ink">
              {t("tsl.leagueName")}
            </span>
            <Image
              src="/images/flags/tr.png"
              alt="TR"
              width={22}
              height={22}
              className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-line"
            />
          </Link>
        </div>

        {/* Sag: sezon */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1">
          {TSL_SEASONS.map((s, i) => {
            const active = s === season;
            return (
              <Link
                key={s}
                href={seasonHref(s)}
                className="relative rounded-lg px-3 py-1.5 text-[12px] font-medium tabular-nums transition"
              >
                {active ? (
                  <motion.span
                    layoutId="resmi-season-pill"
                    className="absolute inset-0 rounded-lg bg-card-2"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                ) : null}
                <span className={`relative ${active ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}>
                  {s}
                  <span className="ml-1.5 text-[9px] uppercase tracking-[0.1em] text-ink-3">
                    {i === 0 ? t("tsl.seasonCurrent") : t("tsl.seasonPast")}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
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
