"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { fetchBasketballPlayerLog, fetchBasketballPlayerSeason, fetchEuroPlayerSeason, fetchEuroPlayerLog } from "../clientQueries";
import { TeamCrest, StatTile } from "./ui";
import { fmt, positionLabel, normalizePositionCode, formatHeight, playerPhotoUrl } from "../lib";
import type { BktPlayerLogRow, BktPlayerSeasonRow } from "../types";

// competition verilirse (E/U) EL/EC drawer'ı (el_player_* view'ları); yoksa BSL.
export default function BasketballPlayerDrawer({ slug, competition, onClose }: { slug: string; competition?: "E" | "U"; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [season, setSeason] = useState<BktPlayerSeasonRow | null>(null);
  const [log, setLog] = useState<BktPlayerLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const seasonP = competition ? fetchEuroPlayerSeason(slug, competition) : fetchBasketballPlayerSeason(slug);
    const logP = competition ? fetchEuroPlayerLog(slug, competition) : fetchBasketballPlayerLog(slug, 60);
    Promise.all([seasonP, logP]).then(([s, l]) => {
      if (!alive) return;
      setSeason(s); setLog(l); setLoading(false);
    });
    return () => { alive = false; };
  }, [slug, competition]);

  const photoUrl = playerPhotoUrl({ sofascore_player_id: season?.sofascore_player_id, image_url: season?.image_url });

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[720px] overflow-y-auto border-l border-line bg-card p-6 shadow-2xl isolate">
        {/* buyuk soluk oyuncu fotografi — solda filigran */}
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" aria-hidden referrerPolicy="no-referrer" className="pointer-events-none absolute -left-6 top-2 -z-10 w-64 object-contain opacity-[0.07] dark:opacity-[0.10]" />
        ) : null}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {season?.team_slug ? <TeamCrest slug={season.team_slug} name={season.team_name} size={36} url={season.crest_url} /> : null}
            <div>
              <h2 className="text-xl font-semibold text-ink">{season?.player_name ?? slug}</h2>
              <p className="text-sm text-ink-3">
                {season?.team_name}{season?.jersey_no ? ` · #${season.jersey_no}` : ""}
                {normalizePositionCode(season?.position) ? (
                  <span className="text-ink-2"> · {normalizePositionCode(season?.position)}
                    <span className="text-ink-3"> {positionLabel(season?.position, locale)}</span>
                  </span>
                ) : ""}
                {formatHeight(season?.height_cm) ? ` · ${formatHeight(season?.height_cm)}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md border border-line px-3 py-1 text-[12px] text-ink-2 hover:text-ink">{t("basketball.close")}</button>
        </div>

        {loading ? (
          <p className="text-sm text-ink-3">…</p>
        ) : season ? (
          <>
            {/* sezon */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <StatTile label={t("basketball.games")} value={String(season.games)} info={t("basketball.gamesInfo")} />
              <StatTile label={t("basketball.min")} value={fmt(season.mpg)} info={t("basketball.minInfo")} />
              <StatTile label={t("basketball.ppg")} value={fmt(season.ppg)} tone="accent" info={t("basketball.ppgInfo")} />
              <StatTile label={t("basketball.rpg")} value={fmt(season.rpg)} info={t("basketball.rpgInfo")} />
              <StatTile label={t("basketball.apg")} value={fmt(season.apg)} info={t("basketball.apgInfo")} />
              <StatTile label={t("basketball.spg")} value={fmt(season.spg)} info={t("basketball.spgInfo")} />
              <StatTile label={t("basketball.bpg")} value={fmt(season.bpg)} info={t("basketball.bpgInfo")} />
              <StatTile label={t("basketball.fgPct")} value={fmt(season.fg_pct)} info={t("basketball.fgPctInfo")} />
              <StatTile label={t("basketball.threePct")} value={fmt(season.fg3_pct)} info={t("basketball.threePctInfo")} />
              <StatTile label={t("basketball.ftPct")} value={fmt(season.ft_pct)} info={t("basketball.ftPctInfo")} />
              <StatTile label={t("basketball.tsPct")} value={fmt(season.ts_pct)} info={t("basketball.tsPctInfo")} />
              <StatTile label={t("basketball.usage")} value={fmt(season.usage_pct)} info={t("basketball.usageInfo")} />
            </div>

            {/* maç geçmişi */}
            <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.drawerLog")}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[12px]">
                <thead><tr className="border-b border-line text-[9px] uppercase tracking-[0.1em] text-ink-3">
                  <th className="px-2 py-1 text-left">{t("basketball.date")}</th>
                  <th className="px-2 py-1 text-left">{t("basketball.opponent")}</th>
                  <th className="px-2 py-1 text-right">{t("basketball.minutesShort")}</th>
                  <th className="px-2 py-1 text-right">PTS</th><th className="px-2 py-1 text-right">REB</th><th className="px-2 py-1 text-right">AST</th>
                  <th className="px-2 py-1 text-right">3PM</th><th className="px-2 py-1 text-right">2PM</th><th className="px-2 py-1 text-right">FTM</th>
                  <th className="px-2 py-1 text-right">STL</th><th className="px-2 py-1 text-right">BLK</th><th className="px-2 py-1 text-right">TO</th>
                  <th className="px-2 py-1 text-right">PRA</th>
                </tr></thead>
                <tbody>
                  {log.map((m) => (
                    <tr key={m.match_key + m.match_date} className="border-t border-line hover:bg-veil">
                      <td className="px-2 py-0.5 text-ink-3 whitespace-nowrap">{String(m.match_date).slice(0, 10)}</td>
                      <td className="px-2 py-0.5 text-ink-2 whitespace-nowrap">{m.home_away === "Home" ? "" : "@"}{m.opponent_name}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-3">{fmt(m.minutes)}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums font-semibold text-ink">{m.points}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.treb}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.assists}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.fg3m}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.fg2m}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.ftm}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.steals}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.blocks}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-ink-2">{m.turnovers}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums text-accent-ink">{m.pra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">{t("basketball.noData")}</p>
        )}
      </div>
    </div>
  );
}
