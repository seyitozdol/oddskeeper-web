"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getCountryFlagUrl } from "@/lib/country-flags";

// TFF 1. Lig kopyasi: TSL modulundeki player-profile-drawer ile ayni acilis
// sekli (sabit overlay + sagdan slide-over). Veri kaynagi tff1 view'lari:
// tff1_player_info_v1 (bilgi), tff1_player_market_value_v1 (deger),
// tff1_pm_player_season_mat (sezon ozeti + secili marketin sezon tablosu).
// Sira/percentile verisi tff1'de yok; o bolumler gosterilmez.

type ProfileInfo = {
  displayName: string;
  teamName: string | null;
  teamId: string | null;
  position: string | null;
  country: string | null;
  age: number | null;
  photoUrl: string | null;
};

type SeasonSummary = {
  appearances: number | null;
  starts: number | null;
  totalMinutes: number | null;
  goals: number | null;
  assists: number | null;
  starterRatePct: number | null;
  seasonLabel: string | null;
};

// Secili marketin metriginin sezon bazinda degeri (Mac | Toplam | Ort.).
type MetricSeason = {
  seasonLabel: string;
  matches: number | null;
  total: number | null;
  perMatch: number | null;
};

function fmtNum(v: number | null, digits = 2): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

const POSITION_SHORT: Record<string, string> = {
  G: "GK",
  D: "DF",
  M: "MF",
  F: "FW",
};

function fmtMarketValue(eur: number | null): string | null {
  if (eur === null || !isFinite(eur) || eur <= 0) return null;
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`;
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`;
  return `€${eur}`;
}

function num(v: number | null): string {
  return v === null || v === undefined ? "—" : String(v);
}

function pct(v: number | null): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function PlayerProfileDrawer({
  playerId,
  playerName,
  seasonLabel,
  marketLabel,
  metricKey,
  teamLogos,
  onClose,
}: {
  playerId: string; // sofascore player_id
  playerName: string;
  seasonLabel: string | null;
  marketLabel: string;
  // Secili marketin tff1_pm_player_season_mat kolon adi; "" ise metrik yok.
  metricKey: string;
  teamLogos: Record<string, string>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [marketValue, setMarketValue] = useState<number | null>(null);
  const [metricSeasons, setMetricSeasons] = useState<MetricSeason[]>([]);
  const [loading, setLoading] = useState(true);

  // Escape ile kapat.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Parent bilesenden key={playerId} ile remount edildigi icin baslangic
    // state'i her acilista tazedir; effect yalnizca await sonrasi state yazar.
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const seasonSelect = metricKey
        ? `season_label, team_id, team_name, appearances, starts, minutes, goals, assists, ${metricKey}`
        : "season_label, team_id, team_name, appearances, starts, minutes, goals, assists";

      const [infoRes, seasonsRes, mvRes] = await Promise.all([
        supabase
          .schema("analytics")
          .from("tff1_player_info_v1")
          .select("player_id, player_name, birth_date, country, position, photo_url")
          .eq("player_id", playerId)
          .limit(1),
        supabase
          .schema("analytics")
          .from("tff1_pm_player_season_mat")
          .select(seasonSelect)
          .eq("player_id", playerId)
          .order("season_label", { ascending: false }),
        supabase
          .schema("analytics")
          .from("tff1_player_market_value_v1")
          .select("market_value_eur")
          .eq("player_id", playerId)
          .limit(1),
      ]);

      if (cancelled) return;

      const seasonRows = (seasonsRes.data ?? []) as unknown as Record<string, unknown>[];
      // En yeni sezonun satiri (takim/ozet icin); mat sezon x oyuncu greninde tekil.
      const currentRow =
        seasonRows.find((r) => String(r.season_label) === seasonLabel) ??
        seasonRows[0] ??
        null;

      const ci = (infoRes.data?.[0] ?? null) as Record<string, unknown> | null;
      setInfo({
        displayName: playerName || ((ci?.player_name as string) ?? playerId),
        teamName: (currentRow?.team_name as string) ?? null,
        teamId: currentRow?.team_id != null ? String(currentRow.team_id) : null,
        position: (ci?.position as string) ?? null,
        country: (ci?.country as string) ?? null,
        age: ageFromBirthDate((ci?.birth_date as string) ?? null),
        photoUrl: (ci?.photo_url as string) ?? null,
      });

      // Sezon ozeti: secili sezon (guncel) veri yoksa en son oynanan sezona
      // duser (currentRow zaten seasonRows[0]'a geriler); bos gostermeyiz.
      if (currentRow) {
        const apps = currentRow.appearances != null ? Number(currentRow.appearances) : null;
        const starts = currentRow.starts != null ? Number(currentRow.starts) : null;
        setSummary({
          appearances: apps,
          starts,
          totalMinutes: currentRow.minutes != null ? Number(currentRow.minutes) : null,
          goals: currentRow.goals != null ? Number(currentRow.goals) : null,
          assists: currentRow.assists != null ? Number(currentRow.assists) : null,
          starterRatePct:
            apps != null && apps > 0 && starts != null ? (starts / apps) * 100 : null,
          seasonLabel: String(currentRow.season_label),
        });
      }

      const mv = (mvRes.data?.[0] ?? null) as Record<string, unknown> | null;
      setMarketValue((mv?.market_value_eur as number) ?? null);

      // Secili marketin metrigi icin sezon tablosu: Mac | Toplam | Ort.
      // Ort. = toplam / appearances (appearances 0 ise null).
      if (metricKey) {
        const seasons: MetricSeason[] = seasonRows.map((r) => {
          const apps = Number(r.appearances ?? 0);
          const total =
            r[metricKey] !== null && r[metricKey] !== undefined
              ? Number(r[metricKey])
              : null;
          return {
            seasonLabel: String(r.season_label),
            matches: apps || null,
            total,
            perMatch: total !== null && apps > 0 ? total / apps : null,
          };
        });
        // En yeni sezon once (sorgu zaten desc; garanti icin tekrar sirala).
        seasons.sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
        setMetricSeasons(seasons);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [playerId, playerName, seasonLabel, metricKey]);

  const flag = info?.country ? getCountryFlagUrl(info.country) : null;
  const teamLogo = info?.teamId ? teamLogos[info.teamId] : undefined;
  const positionShort = info?.position
    ? POSITION_SHORT[info.position] ?? info.position
    : null;
  const mvLabel = fmtMarketValue(marketValue);
  const detailHref = `/dashboard/tff-1-lig/player/${encodeURIComponent(playerId)}`;

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Overlay */}
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto border-l border-line bg-card shadow-[-20px_0_60px_rgba(0,0,0,0.35)]">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {info?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.photoUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[15px] font-semibold text-ink-2">
                {(info?.displayName ?? playerName ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-ink">
                {info?.displayName ?? playerName}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-2">
                {teamLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={teamLogo} alt="" className="h-4 w-4 object-contain" />
                )}
                <span className="truncate">{info?.teamName ?? "—"}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line bg-veil px-2.5 py-1 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-3">
              {t("common.loading")}
            </div>
          ) : (
            <>
              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                {positionShort && (
                  <span className="rounded-md border border-line bg-veil px-2 py-1 text-[12px] text-ink-2">
                    {t("common.position")}: <span className="font-medium text-ink">{positionShort}</span>
                  </span>
                )}
                {info?.age != null && (
                  <span className="rounded-md border border-line bg-veil px-2 py-1 text-[12px] text-ink-2">
                    {t("playerMarket.profileAge")}: <span className="font-medium text-ink">{info.age}</span>
                  </span>
                )}
                {info?.country && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-veil px-2 py-1 text-[12px] text-ink-2">
                    {flag && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flag} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
                    )}
                    <span className="font-medium text-ink">{info.country}</span>
                  </span>
                )}
              </div>

              {/* Market value */}
              {mvLabel && (
                <div className="mt-3 rounded-lg border border-line bg-veil px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    {t("playerMarket.profileMarketValue")}
                  </div>
                  <div className="text-[16px] font-bold text-ink">{mvLabel}</div>
                </div>
              )}

              {/* Season summary */}
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-ink-3">
                    {t("playerMarket.profileSeasonSummary")}
                  </span>
                  {(summary?.seasonLabel ?? seasonLabel) && (
                    <span className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3">
                      {summary?.seasonLabel ?? seasonLabel}
                    </span>
                  )}
                </div>

                {summary ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label={t("playerMarket.profileAppearances")} value={num(summary.appearances)} />
                    <Stat label={t("playerMarket.profileStarts")} value={num(summary.starts)} />
                    <Stat label={t("playerMarket.profileStarterRate")} value={pct(summary.starterRatePct)} />
                    <Stat label={t("playerMarket.profileMinutes")} value={num(summary.totalMinutes)} />
                    <Stat label={t("playerMarket.profileGoals")} value={num(summary.goals)} />
                    <Stat label={t("playerMarket.profileAssists")} value={num(summary.assists)} />
                  </div>
                ) : (
                  <div className="rounded-lg border border-line bg-veil px-3 py-4 text-center text-[12px] text-ink-3">
                    {t("playerMarket.noProfileData")}
                  </div>
                )}
              </div>

              {/* Secili marketin metrigi: sezon bazinda kiyas */}
              {metricKey && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
                    {t("playerMarket.metricBySeasonTitle", { metric: marketLabel })}
                  </div>

                  {metricSeasons.length === 0 ? (
                    <div className="rounded-lg border border-line bg-veil px-3 py-4 text-center text-[12px] text-ink-3">
                      {t("playerMarket.metricNoData")}
                    </div>
                  ) : (
                    <>
                      {/* Sezon basina Mac | Toplam | Ort. (en yeni sezon ustte, vurgulu) */}
                      <div className="overflow-hidden rounded-lg border border-line">
                        <table className="w-full border-collapse text-[12px]">
                          <thead className="bg-card-2 text-[10px] uppercase tracking-[0.08em] text-ink-3">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-medium">
                                {t("playerMarket.metricSeasonCol")}
                              </th>
                              <th className="px-2 py-1.5 text-right font-medium">
                                {t("playerMarket.metricMatches")}
                              </th>
                              <th className="px-2 py-1.5 text-right font-medium">
                                {t("playerMarket.metricTotal")}
                              </th>
                              <th className="px-2 py-1.5 text-right font-medium">
                                {t("playerMarket.avgLabel")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {metricSeasons.map((s, i) => (
                              <tr
                                key={s.seasonLabel}
                                className={`border-t border-line ${
                                  i === 0 ? "bg-veil/50" : ""
                                }`}
                              >
                                <td
                                  className={`px-2 py-1.5 tabular-nums ${
                                    i === 0
                                      ? "font-semibold text-ink"
                                      : "text-ink-2"
                                  }`}
                                >
                                  {s.seasonLabel}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">
                                  {num(s.matches)}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">
                                  {fmtNum(s.total)}
                                </td>
                                <td className="px-2 py-1.5 text-right font-medium tabular-nums text-ink">
                                  {fmtNum(s.perMatch)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {metricSeasons.length === 1 && (
                        <div className="mt-2 text-[11px] leading-snug text-ink-3">
                          {t("playerMarket.metricOnlyCurrentNote")}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Full profile link */}
              <Link
                href={detailHref}
                target="_blank"
                className="mt-4 flex items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
              >
                {t("playerMarket.openFullProfile")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-veil px-2 py-2 text-center">
      <div className="text-[15px] font-bold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
    </div>
  );
}
