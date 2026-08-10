"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getCountryFlagUrl } from "@/lib/country-flags";
import { getPlayerDetailHref } from "@/lib/routes";
import { FOREIGN_METRIC_COLS } from "./queries";

// Model ekranindaki oyuncu adina tiklaninca sagdan acilan profil paneli.
// Acilis sekli eski metrik leaderboard drawer'iyla ayni (sabit overlay +
// sagdan slide-over); icerik guncel oyuncu bilgisi + secili sezon ozeti.

type ProfileInfo = {
  displayName: string;
  teamName: string | null;
  teamSlug: string | null;
  position: string | null;
  nationality: string | null;
  age: number | null;
  shirtNumber: number | null;
  photoUrl: string | null;
};

type SeasonSummary = {
  appearances: number | null;
  starts: number | null;
  totalMinutes: number | null;
  goals: number | null;
  assists: number | null;
  starterRatePct: number | string | null;
  seasonLabel: string | null;
};

// Secili marketin metriginin sezon bazinda degeri (gecmis sezon kiyasi).
type MetricSeason = {
  seasonLabel: string;
  perMatch: number | null;
  last5: number | null;
  total: number | null;
  rank: number | null;
  percentile: number | null;
  matches: number | null;
};

function fmtNum(v: number | null, digits = 2): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
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

function pct(v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `${Math.round(n)}%`;
}

export default function PlayerProfileDrawer({
  playerSlug,
  playerName,
  playerSourceId,
  seasonLabel,
  marketLabel,
  metricKey,
  teamLogos,
  onClose,
}: {
  playerSlug: string;
  playerName: string;
  playerSourceId: string;
  seasonLabel: string | null;
  marketLabel: string;
  // Secili marketin metrik anahtari; "" ise metrik yok, "log:<kolon>" ise
  // player_log_season_avg_v1'den okunur (bkz. queries.ts MARKET_OPTIONS).
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
    // Parent bilesenden key={playerSlug} ile remount edildigi icin baslangic
    // state'i (loading=true, null) her acilista tazedir; effect yalnizca
    // await sonrasi state yazar (senkron reset yok).
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const [infoRes, profileRes, mvRes] = await Promise.all([
        supabase
          .schema("analytics")
          .from("player_current_info_v1")
          .select(
            "player_name, full_name, first_name, current_team_name, current_team_slug, position, nationality, age, shirt_number, photo_url"
          )
          .eq("player_slug", playerSlug)
          .limit(1),
        // Sezon ozeti: secili sezon (guncel) veri yoksa (sezon basi) en son
        // oynanan sezona duser; bos "veri yok" gostermek yerine anlamli kalir.
        supabase
          .schema("analytics")
          .from("player_profile_v1")
          .select(
            "appearances, starts, total_minutes, goals, assists, starter_rate_pct, season_label, team_name"
          )
          .eq("player_slug", playerSlug)
          .order("season_label", { ascending: false })
          .limit(6),
        supabase
          .schema("analytics")
          .from("player_market_value_v1")
          .select("market_value_eur")
          .eq("player_slug", playerSlug)
          .limit(1),
      ]);

      if (cancelled) return;

      const ci = (infoRes.data?.[0] ?? null) as Record<string, unknown> | null;
      if (ci) {
        setInfo({
          displayName:
            playerName ||
            (ci.full_name as string) ||
            (ci.player_name as string) ||
            playerSlug,
          teamName: (ci.current_team_name as string) ?? null,
          teamSlug: (ci.current_team_slug as string) ?? null,
          position: (ci.position as string) ?? null,
          nationality: (ci.nationality as string) ?? null,
          age: (ci.age as number) ?? null,
          shirtNumber: (ci.shirt_number as number) ?? null,
          photoUrl: (ci.photo_url as string) ?? null,
        });
      } else {
        setInfo({
          displayName: playerName || playerSlug,
          teamName: null,
          teamSlug: null,
          position: null,
          nationality: null,
          age: null,
          shirtNumber: null,
          photoUrl: null,
        });
      }

      const profileRows = (profileRes.data ?? []) as Record<string, unknown>[];
      let pr =
        profileRows.find((r) => String(r.season_label) === seasonLabel) ??
        profileRows[0] ??
        null;
      // Yeni transfer: bizim profil view'unda sezon yoksa yurt disi sezon
      // ozetine dus (mac/gol/asist/dakika; ilk-11 bilgisi yurt disinda yok).
      if (!pr && playerSourceId) {
        const { data: fp } = await supabase
          .schema("analytics")
          .from("player_foreign_season_v1")
          .select("season_label, appearances, minutes_played, goals, assists")
          .eq("player_key", playerSourceId)
          .order("season_label", { ascending: false })
          .limit(1);
        const f = (fp?.[0] ?? null) as Record<string, unknown> | null;
        if (f) {
          const m = Number(f.appearances ?? 0);
          pr = {
            appearances: m,
            starts: null,
            total_minutes: f.minutes_played,
            goals: f.goals != null ? Number(f.goals) * m : null,
            assists: f.assists != null ? Number(f.assists) * m : null,
            starter_rate_pct: null,
            season_label: f.season_label,
          } as Record<string, unknown>;
        }
      }
      if (pr) {
        setSummary({
          appearances: (pr.appearances as number) ?? null,
          starts: (pr.starts as number) ?? null,
          totalMinutes: (pr.total_minutes as number) ?? null,
          goals: (pr.goals as number) ?? null,
          assists: (pr.assists as number) ?? null,
          starterRatePct: (pr.starter_rate_pct as number | string) ?? null,
          seasonLabel: (pr.season_label as string) ?? seasonLabel,
        });
      }

      const mv = (mvRes.data?.[0] ?? null) as Record<string, unknown> | null;
      setMarketValue((mv?.market_value_eur as number) ?? null);

      // Secili marketin metrigi icin sezon bazinda degerler (gecmis sezon
      // kiyasi). Metrik view'lari player_source_id + TAKIM gren'inde oldugundan
      // sezon icinde 2 takimda oynayan oyuncuda ayni sezon birden cok satir
      // gelir; sezon bazinda birlestiririz (toplam/mac topla, mac basi = maca
      // agirlikli ort, sira en iyi/en cok macli stint'ten).
      if (metricKey && playerSourceId) {
        type Acc = {
          total: number;
          matches: number;
          pmNum: number;
          pmDen: number;
          last5: number | null;
          last5Matches: number;
          rank: number | null;
        };
        const bySeason = new Map<string, Acc>();
        const ensure = (s: string): Acc => {
          let e = bySeason.get(s);
          if (!e) {
            e = { total: 0, matches: 0, pmNum: 0, pmDen: 0, last5: null, last5Matches: -1, rank: null };
            bySeason.set(s, e);
          }
          return e;
        };

        if (metricKey.startsWith("shots:")) {
          // Shotmap turevleri (SOT In/Out Box): sezon gecmisi
          // player_shot_zones_season_v1'den (mac-basi ortalama doner;
          // toplam = ort x mac). TSL oyuncu id'si opta uzayinda.
          const field = metricKey.slice(6);
          const { data: shotRows } = await supabase
            .schema("analytics")
            .from("player_shot_zones_season_v1")
            .select(`season_label, matches, ${field}`)
            .eq("opta_player_id", playerSourceId);
          for (const row of (shotRows ?? []) as unknown as Record<
            string,
            unknown
          >[]) {
            const e = ensure(String(row.season_label));
            const m = Number(row.matches ?? 0);
            const val = row[field] != null ? Number(row[field]) : null;
            e.matches += m;
            if (val != null) {
              e.pmNum += val * m;
              e.pmDen += m;
              e.total += val * m;
            }
          }
        } else if (metricKey.startsWith("log:")) {
          const field = metricKey.slice(4);
          const { data: logRows } = await supabase
            .schema("analytics")
            .from("player_log_by_season_v1")
            .select(`season_label, matches, ${field}`)
            .eq("player_source_id", playerSourceId);
          for (const row of (logRows ?? []) as unknown as Record<
            string,
            unknown
          >[]) {
            const e = ensure(String(row.season_label));
            const m = Number(row.matches ?? 0);
            const val = row[field] != null ? Number(row[field]) : null;
            e.matches += m;
            // log view'da alan maç-başı ortalamadır; toplam ~ ort * maç.
            if (val != null) {
              e.pmNum += val * m;
              e.pmDen += m;
              e.total += val * m;
            }
          }
        } else {
          // player_metric_by_season_v1'in GUNCEL sezon kolu leaderboard'i
          // ranking_pool (ALL_PLAYERS + OUTFIELD/GK) bazinda tuttugundan her oyuncu
          // ayni sezonda 2 satirla gelir ve toplamlar (mac/deger) IKIYE KATLANIR.
          // Cozum: leaderboard'da bulunan (guncel) sezonlari tek havuzdan
          // (ALL_PLAYERS) okuruz — sezon x takim greninde tekil, sezon ici transfer
          // hala toplanir. Gecmis sezonlar (leaderboard'da olmayanlar) by_season'dan
          // gelir; orada havuz katlanmasi yok. by_season anon'a acik, history view'i
          // degil — bu yuzden gecmisi ondan cekmeyiz.
          const [curRes, allRes] = await Promise.all([
            supabase
              .schema("analytics")
              .from("player_metric_leaderboard_current")
              .select(
                "season_label, per_match_value, last5_value, total_value, league_rank, sample_matches"
              )
              .eq("player_source_id", playerSourceId)
              .eq("metric_key", metricKey)
              .eq("ranking_pool", "ALL_PLAYERS"),
            supabase
              .schema("analytics")
              .from("player_metric_by_season_v1")
              .select(
                "season_label, per_match_value, last5_value, total_value, league_rank, sample_matches"
              )
              .eq("player_source_id", playerSourceId)
              .eq("metric_key", metricKey),
          ]);

          const accumulate = (rows: Record<string, unknown>[]) => {
            for (const row of rows) {
              const e = ensure(String(row.season_label));
              const m = Number(row.sample_matches ?? 0);
              e.total += Number(row.total_value ?? 0);
              e.matches += m;
              const pm = row.per_match_value != null ? Number(row.per_match_value) : null;
              if (pm != null) {
                e.pmNum += pm * m;
                e.pmDen += m;
              }
              if (m > e.last5Matches) {
                e.last5Matches = m;
                e.last5 = row.last5_value != null ? Number(row.last5_value) : null;
              }
              const rk = row.league_rank != null ? Number(row.league_rank) : null;
              if (rk != null && (e.rank == null || rk < e.rank)) e.rank = rk;
            }
          };

          const curRows = (curRes.data ?? []) as Record<string, unknown>[];
          const leaderboardSeasons = new Set(
            curRows.map((r) => String(r.season_label))
          );
          accumulate(curRows);
          // by_season'dan yalnizca leaderboard'da OLMAYAN (gecmis) sezonlar; guncel
          // sezonlar zaten yukarida havuz-tekil olarak eklendi (katlanma onlenir).
          accumulate(
            ((allRes.data ?? []) as Record<string, unknown>[]).filter(
              (r) => !leaderboardSeasons.has(String(r.season_label))
            )
          );
        }

        // Yurt disi (yeni transfer) sezonlari: bizim kaynaklarda OLMAYAN
        // sezonlar player_foreign_season_v1'den eklenir (mac-basi ortalama;
        // toplam = ort x mac). Yalniz eslenebilir metriklerde.
        const foreignCol = FOREIGN_METRIC_COLS[metricKey];
        if (foreignCol) {
          const { data: fRows } = await supabase
            .schema("analytics")
            .from("player_foreign_season_v1")
            .select(`season_label, appearances, ${foreignCol}`)
            .eq("player_key", playerSourceId);
          for (const row of (fRows ?? []) as unknown as Record<string, unknown>[]) {
            const sl = String(row.season_label);
            if (bySeason.has(sl)) continue; // bizim veri oncelikli
            const m = Number(row.appearances ?? 0);
            const avg = row[foreignCol] != null ? Number(row[foreignCol]) : null;
            if (!m || avg == null) continue;
            bySeason.set(sl, {
              total: avg * m, matches: m, pmNum: avg * m, pmDen: m,
              last5: null, last5Matches: -1, rank: null,
            });
          }
        }

        const seasons: MetricSeason[] = [...bySeason.entries()].map(
          ([seasonLabel, e]) => ({
            seasonLabel,
            matches: e.matches || null,
            total: e.total ? e.total : null,
            perMatch: e.pmDen > 0 ? e.pmNum / e.pmDen : null,
            last5: e.last5,
            rank: e.rank,
            percentile: null,
          })
        );
        // En yeni sezon once.
        seasons.sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
        if (!cancelled) setMetricSeasons(seasons);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [playerSlug, playerName, seasonLabel, metricKey, playerSourceId]);

  const flag = info?.nationality ? getCountryFlagUrl(info.nationality) : null;
  const teamLogo = info?.teamSlug ? teamLogos[info.teamSlug] : undefined;
  const positionShort = info?.position
    ? POSITION_SHORT[info.position] ?? info.position
    : null;
  const mvLabel = fmtMarketValue(marketValue);
  const detailHref = getPlayerDetailHref(playerSlug);

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
                {info?.shirtNumber != null && (
                  <span className="rounded-md border border-line bg-veil px-2 py-1 text-[12px] text-ink-2">
                    #<span className="font-medium text-ink">{info.shirtNumber}</span>
                  </span>
                )}
                {info?.nationality && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-veil px-2 py-1 text-[12px] text-ink-2">
                    {flag && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flag} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
                    )}
                    <span className="font-medium text-ink">{info.nationality}</span>
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
                      {/* WhoScored tarzi sezon tablosu: sezon basina maç / toplam
                          / maç başı ortalama (en yeni sezon ustte, vurgulu) */}
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

                      {(metricSeasons[0].rank != null ||
                        metricSeasons[0].last5 != null) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
                          {metricSeasons[0].rank != null && (
                            <span>
                              {t("playerMarket.metricRank")}:{" "}
                              <span className="font-medium text-ink-2">
                                #{metricSeasons[0].rank}
                              </span>
                            </span>
                          )}
                          {metricSeasons[0].last5 != null && (
                            <span>
                              {t("playerMarket.metricLast5")}:{" "}
                              <span className="font-medium text-ink-2">
                                {fmtNum(metricSeasons[0].last5)}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

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
              {detailHref && (
                <Link
                  href={detailHref}
                  target="_blank"
                  className="mt-4 flex items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
                >
                  {t("playerMarket.openFullProfile")}
                </Link>
              )}
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
