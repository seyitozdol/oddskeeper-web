"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import {
  TSL_BASE_PATH,
  TSL_DESIGNS,
  TSL_SEASONS,
  TSL_SECTIONS,
  type TslDesign,
  type TslSeason,
  type TslSection,
} from "../constants";

const DESIGN_META: Record<TslDesign, { nameKey: string; tagKey: string; dot: string }> = {
  sahne: { nameKey: "tsl.sahneName", tagKey: "tsl.sahneTag", dot: "bg-accent" },
  radar: { nameKey: "tsl.radarName", tagKey: "tsl.radarTag", dot: "bg-pos" },
  panel: { nameKey: "tsl.panelName", tagKey: "tsl.panelTag", dot: "bg-ink-2" },
};

const SECTION_KEY: Record<TslSection, string> = {
  league: "tsl.sectionLeague",
  players: "tsl.sectionPlayers",
  teams: "tsl.sectionTeams",
};

export default function TslControlBar({
  design,
  section,
  season,
}: {
  design: TslDesign;
  section: TslSection;
  season: TslSeason;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();

  // Belirli anahtarlari override ederek yeni query string kur.
  const buildQuery = (over: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(over)) next.set(k, v);
    return next.toString();
  };

  const designHref = (d: TslDesign) => `${TSL_BASE_PATH}/${d}?${buildQuery({})}`;
  const sectionHref = (s: TslSection) =>
    `${pathname}?${buildQuery({ section: s })}`;
  const seasonHref = (s: TslSeason) => `${pathname}?${buildQuery({ season: s })}`;

  return (
    <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Sol: marka + tasarim secici */}
        <div className="flex items-center gap-4">
          <Link
            href={TSL_BASE_PATH}
            className="flex items-center gap-2 text-ink transition hover:text-accent-ink"
            title={t("tsl.backToDesigns")}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-[11px] font-black tracking-tight text-accent-ink">
              TSL
            </span>
          </Link>

          <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1">
            {TSL_DESIGNS.map((d) => {
              const active = d === design;
              const meta = DESIGN_META[d];
              return (
                <Link
                  key={d}
                  href={designHref(d)}
                  className="relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition"
                >
                  {active ? (
                    <motion.span
                      layoutId="tsl-design-pill"
                      className="absolute inset-0 rounded-lg bg-card-2"
                      transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    />
                  ) : null}
                  <span
                    className={`relative flex items-center gap-1.5 ${
                      active ? "text-ink" : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {t(meta.nameKey)}
                    <span className="hidden text-[10px] uppercase tracking-[0.12em] text-ink-3 sm:inline">
                      {t(meta.tagKey)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
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
                    layoutId="tsl-season-pill"
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

      {/* Alt: bolum navigasyonu */}
      <div className="mt-3 flex items-center gap-1">
        {TSL_SECTIONS.map((s) => {
          const active = s === section;
          return (
            <Link
              key={s}
              href={sectionHref(s)}
              className="relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition"
            >
              {active ? (
                <motion.span
                  layoutId="tsl-section-pill"
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
