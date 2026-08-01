"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { StatTile, TeamCrest } from "./ui";
import { fmt, formatMatchDate, homeAwayLabel } from "../lib";
import type { PlayerCompStats } from "../unified";

// Birleşik oyuncu profili: BSL yapısı + kulvar (BSL/EL/EC) toggle. Oyuncu birden
// çok kulvarda oynadıysa toggle ile geçilir; tek kulvarda ise toggle gizli.
export default function PlayerProfileTabs({
  name, jerseyNo, teamName, teamSlug, crestUrl, photoUrl, comps,
}: {
  name: string;
  jerseyNo?: string | null;
  teamName?: string | null;
  teamSlug?: string | null;   // BSL yerel logo
  crestUrl?: string | null;   // EL/EC uzak crest
  photoUrl?: string | null;   // oyuncu fotografi (EL/EC image_url); hafif <img>, next/image degil
  comps: PlayerCompStats[];
}) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<string>(comps[0]?.key ?? "bsl");
  const c = comps.find((x) => x.key === active) ?? comps[0];
  if (!c) return null;

  return (
    <div>
      {/* Header (tutarlı) — oyuncu fotografi varsa foto, yoksa takim logosu, o da yoksa forma/harf */}
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} loading="lazy" className="rounded-xl bg-veil object-cover object-top" style={{ width: 52, height: 52 }} />
        ) : teamSlug ? (
          <TeamCrest slug={teamSlug} name={teamName} size={52} />
        ) : crestUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crestUrl} alt={teamName ?? ""} className="object-contain" style={{ width: 52, height: 52 }} />
        ) : (
          <div className="flex items-center justify-center rounded-full bg-veil text-lg font-bold text-ink-2" style={{ width: 52, height: 52 }}>
            {jerseyNo ? `#${jerseyNo}` : name.slice(0, 1)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-ink">{name}</h1>
          <p className="mt-0.5 text-sm text-ink-2">{teamName}</p>
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

      <p className="mt-3 text-[11px] text-ink-3">{c.label} · {c.seasonLabel}{c.teamName ? ` · ${c.teamName}` : ""}</p>

      {/* Per game */}
      <h2 className="mt-4 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.perGame")}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        <StatTile label={t("basketball.games")} value={String(c.games)} />
        <StatTile label={t("basketball.min")} value={fmt(c.mpg)} />
        <StatTile label={t("basketball.ppg")} value={fmt(c.ppg)} tone="accent" />
        <StatTile label={t("basketball.rpg")} value={fmt(c.rpg)} />
        <StatTile label={t("basketball.apg")} value={fmt(c.apg)} />
        <StatTile label={t("basketball.spg")} value={fmt(c.spg)} />
        <StatTile label={t("basketball.bpg")} value={fmt(c.bpg)} />
        <StatTile label={t("basketball.threePg")} value={fmt(c.fg3m_pg)} />
        {c.hasVal ? <StatTile label={t("basketball.valuation")} value={fmt(c.val_pg)} tone="accent" /> : null}
      </div>

      {/* Shooting */}
      <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.shooting")}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        <StatTile label={t("basketball.fgPct")} value={fmt(c.fg_pct)} />
        {c.fg2_pct != null ? <StatTile label="2P%" value={fmt(c.fg2_pct)} /> : null}
        <StatTile label={t("basketball.threePct")} value={fmt(c.fg3_pct)} />
        <StatTile label={t("basketball.ftPct")} value={fmt(c.ft_pct)} />
        {c.efg_pct != null ? <StatTile label={t("basketball.efgPct")} value={fmt(c.efg_pct)} /> : null}
        <StatTile label={t("basketball.tsPct")} value={fmt(c.ts_pct)} tone="accent" />
      </div>

      {/* Advanced (BSL) */}
      {c.hasAdvanced ? (
        <>
          <h2 className="mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.advanced")}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            <StatTile label={t("basketball.usage")} value={fmt(c.usage_pct)} />
            <StatTile label="PTS/36" value={fmt(c.pts_per36)} />
            <StatTile label="REB/36" value={fmt(c.reb_per36)} />
            <StatTile label="AST/36" value={fmt(c.ast_per36)} />
            <StatTile label={t("basketball.pra")} value={fmt(c.pra_pg)} />
            <StatTile label="P+A" value={fmt(c.pa_pg)} />
          </div>
        </>
      ) : null}

      {/* Game log */}
      <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.gameLog")}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2 text-left">{t("basketball.date")}</th>
              <th className="px-2 py-2 text-center">{t("basketball.team")}</th>
              <th className="px-2 py-2 text-left"></th>
              <th className="px-2 py-2 text-left">{t("basketball.opponent")}</th>
              <th className="px-2 py-2 text-right">{t("basketball.min")}</th><th className="px-2 py-2 text-right">PTS</th>
              <th className="px-2 py-2 text-right">REB</th><th className="px-2 py-2 text-right">AST</th><th className="px-2 py-2 text-right">3PM</th>
              <th className="px-2 py-2 text-right">STL</th><th className="px-2 py-2 text-right">BLK</th>
              <th className="px-2 py-2 text-right">{c.hasVal ? t("basketball.valuation") : t("basketball.tsPct")}</th>
            </tr>
          </thead>
          <tbody>
            {c.log.map((m) => (
              <tr key={m.key} className="border-t border-line hover:bg-veil">
                <td className="px-2 py-2 text-ink-3 whitespace-nowrap">{formatMatchDate(m.date ?? "", locale)}</td>
                <td className="px-2 py-2">
                  <span className="flex justify-center" title={m.team_name ?? ""}>
                    {m.team_slug ? (
                      <TeamCrest slug={m.team_slug} name={m.team_name} size={22} />
                    ) : m.team_crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.team_crest} alt={m.team_name ?? ""} className="object-contain" style={{ width: 22, height: 22 }} />
                    ) : null}
                  </span>
                </td>
                <td className="px-2 py-2 text-ink-3">{homeAwayLabel(m.home_away, locale)}</td>
                <td className="px-2 py-2 text-ink whitespace-nowrap">
                  {m.opponent_slug ? (
                    <Link href={`/dashboard/basketball/team/${m.opponent_slug}`} className="hover:text-accent-ink">{m.opponent}</Link>
                  ) : m.opponent}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{fmt(m.minutes)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-ink">{m.points}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.treb}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.assists}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.fg3m}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.steals}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-2">{m.blocks}</td>
                <td className="px-2 py-2 text-right tabular-nums text-accent-ink">{c.hasVal ? m.valuation : fmt(m.ts_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
