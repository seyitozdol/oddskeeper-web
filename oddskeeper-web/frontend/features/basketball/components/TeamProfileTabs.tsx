"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { StatTile, TeamCrest } from "./ui";
import { fmt, formatMatchDate, homeAwayLabel, normalizePositionCode, positionLabel } from "../lib";
import type { TeamCompStats } from "../unified";

// Birleşik takım profili: BSL yapısı + kulvar (BSL/EL/EC) toggle. Season averages +
// roster + results kulvara göre değişir. Takım tek kulvarda ise toggle gizli.
export default function TeamProfileTabs({
  name, teamSlug, crestUrl, comps,
}: {
  name: string;
  teamSlug?: string | null;
  crestUrl?: string | null;
  comps: TeamCompStats[];
}) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<string>(comps[0]?.key ?? "bsl");
  const c = comps.find((x) => x.key === active) ?? comps[0];
  if (!c) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        {teamSlug ? (
          <TeamCrest slug={teamSlug} name={name} size={56} />
        ) : crestUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crestUrl} alt={name} className="object-contain" style={{ width: 56, height: 56 }} />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-ink">{name}</h1>
          <p className="mt-0.5 text-sm text-ink-2">{c.label} · {c.seasonLabel} · {c.wins}-{c.losses}</p>
        </div>
      </div>

      {/* Kulvar toggle */}
      {comps.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {comps.map((x) => (
            <button
              key={x.key}
              onClick={() => setActive(x.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${x.key === active ? "bg-accent text-white" : "bg-card-2 text-ink-2 hover:bg-veil hover:text-ink"}`}
            >
              <Image src={x.logo} alt={x.label} width={16} height={16} className="h-4 w-4 object-contain" />
              {x.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Season averages */}
      <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.seasonAverages")}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        <StatTile label={t("basketball.played")} value={String(c.games)} />
        <StatTile label={t("basketball.ppg")} value={fmt(c.ppg)} tone="accent" />
        <StatTile label={t("basketball.oppg")} value={fmt(c.oppg)} />
        <StatTile label={t("basketball.diff")} value={fmt(c.point_diff)} />
        <StatTile label={t("basketball.rpg")} value={fmt(c.rpg)} />
        <StatTile label={t("basketball.apg")} value={fmt(c.apg)} />
        <StatTile label={t("basketball.netRtg")} value={fmt(c.net_rtg)} />
        <StatTile label={t("basketball.offRtg")} value={fmt(c.off_rtg)} />
        <StatTile label={t("basketball.defRtg")} value={fmt(c.def_rtg)} />
        <StatTile label={t("basketball.pace")} value={fmt(c.pace)} />
        <StatTile label={t("basketball.threePct")} value={fmt(c.fg3_pct)} />
        <StatTile label={t("basketball.fgPct")} value={fmt(c.fg_pct)} />
      </div>

      {/* Roster */}
      <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.roster")}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead><tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <th className="px-2 py-2 text-left">{t("basketball.player")}</th>
            <th className="px-2 py-2 text-center">{t("basketball.position")}</th>
            <th className="px-2 py-2 text-right">{t("basketball.games")}</th><th className="px-2 py-2 text-right">{t("basketball.min")}</th>
            <th className="px-2 py-2 text-right">{t("basketball.ppg")}</th><th className="px-2 py-2 text-right">{t("basketball.rpg")}</th>
            <th className="px-2 py-2 text-right">{t("basketball.apg")}</th>
            {c.hasVal ? <th className="px-2 py-2 text-right">{t("basketball.valuation")}</th> : null}
          </tr></thead>
          <tbody>
            {c.roster.map((p) => (
              <tr key={p.key} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-2"><Link href={p.href} className="font-medium text-ink hover:text-accent-ink whitespace-nowrap">{p.name}</Link></td>
                <td className="px-2 py-2 text-center">
                  {normalizePositionCode(p.position) ? (
                    <span title={positionLabel(p.position, locale)} className="inline-block rounded bg-veil px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{normalizePositionCode(p.position)}</span>
                  ) : <span className="text-ink-3">-</span>}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{p.games}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.mpg)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">{fmt(p.ppg)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.rpg)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(p.apg)}</td>
                {c.hasVal ? <td className="px-2 py-2 text-right tabular-nums text-accent-ink">{fmt(p.val)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results */}
      <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.results")}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead><tr className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
            <th className="px-2 py-1 text-left">{t("basketball.date")}</th><th className="px-2 py-1 text-left"></th>
            <th className="px-2 py-1 text-left">{t("basketball.opponent")}</th><th className="px-2 py-1 text-right">{t("basketball.result")}</th>
            <th className="px-2 py-1 text-right">{t("basketball.score")}</th>
          </tr></thead>
          <tbody>
            {c.results.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="px-2 py-1 text-ink-3 whitespace-nowrap">{formatMatchDate(m.date ?? "", locale)}</td>
                <td className="px-2 py-1 text-ink-3">{homeAwayLabel(m.home_away, locale)}</td>
                <td className="px-2 py-1 text-ink-2 whitespace-nowrap">
                  {m.opponent_slug ? <Link href={`/dashboard/basketball/team/${m.opponent_slug}`} className="hover:text-accent-ink">{m.opponent}</Link> : m.opponent}
                </td>
                <td className={`px-2 py-1 text-right font-semibold ${m.result === "W" ? "text-pos" : m.result === "L" ? "text-neg" : "text-ink-3"}`}>{m.result}</td>
                <td className="px-2 py-1 text-right tabular-nums text-ink">{m.points}-{m.opp_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
