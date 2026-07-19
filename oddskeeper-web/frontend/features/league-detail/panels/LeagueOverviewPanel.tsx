import MatchLink from "@/components/links/MatchLink";
import TeamLink from "@/components/links/TeamLink";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type {
  LeagueFixtureRow,
  LeagueOverviewRow,
  LeagueResultRow,
  LeagueStandingRow,
} from "../types";

type LeagueOverviewPanelProps = {
  overview: LeagueOverviewRow | null;
  standings?: LeagueStandingRow[];
  results?: LeagueResultRow[];
  fixtures?: LeagueFixtureRow[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${formatNumber(value, 1)}%`;
}

function formatPctPoint(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const absValue = Math.abs(value);
  return `${formatNumber(absValue, 1)} pp`;
}

function formatTime(
  t: Translator,
  kickoffTimeKnown: boolean,
  kickoffTimeText: string | null | undefined
) {
  if (!kickoffTimeKnown || !kickoffTimeText) {
    return t("leagueDetail.tbd");
  }

  return kickoffTimeText;
}

function getResultTone(resultCode: LeagueResultRow["result_code"]) {
  if (resultCode === "H") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (resultCode === "A") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }

  if (resultCode === "D") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

function SnapshotCard({
  label,
  value,
  subvalue,
  accent = "neutral",
}: {
  label: string;
  value: string;
  subvalue?: string;
  accent?: "neutral" | "positive" | "accent" | "warning";
}) {
  const toneClass =
    accent === "positive"
      ? "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))]"
      : accent === "accent"
        ? "border-sky-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.02))]"
        : accent === "warning"
          ? "border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.02))]"
          : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-white">{value}</div>
      {subvalue ? <div className="mt-1 text-[11px] text-white/55">{subvalue}</div> : null}
    </div>
  );
}

function MiniSplitCard({
  label,
  value,
  subvalue,
  toneClass,
}: {
  label: string;
  value: string;
  subvalue?: string;
  toneClass: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {subvalue ? <div className="mt-1 text-[11px] text-white/50">{subvalue}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function formatResultCode(resultCode: LeagueResultRow["result_code"]) {
  if (resultCode === "H") return "H";
  if (resultCode === "A") return "A";
  if (resultCode === "D") return "D";
  return "—";
}

function perGame(total: number, played: number) {
  if (!played) return "—";
  return formatNumber(total / played, 2);
}

export async function LeagueOverviewPanel({
  overview,
  standings = [],
  results = [],
  fixtures = [],
}: LeagueOverviewPanelProps) {
  const t = await getT();

  const topAttack = [...standings]
    .sort((a, b) => {
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.rank - b.rank;
    })
    .slice(0, 5);

  const bestDefence = [...standings]
    .filter((row) => row.played > 0)
    .sort((a, b) => {
      if (a.goals_against !== b.goals_against) return a.goals_against - b.goals_against;
      return a.rank - b.rank;
    })
    .slice(0, 5);

  const bestForm = [...standings]
    .sort((a, b) => {
      if (b.last5_points !== a.last5_points) return b.last5_points - a.last5_points;
      return a.rank - b.rank;
    })
    .slice(0, 5);

  const latestResults = [...results]
    .sort((a, b) => {
      const aTime = a.match_datetime ? new Date(a.match_datetime).getTime() : 0;
      const bTime = b.match_datetime ? new Date(b.match_datetime).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 4);

  const nextFixtures = [...fixtures]
    .sort((a, b) => {
      const aTime = a.fixture_datetime
        ? new Date(a.fixture_datetime).getTime()
        : a.fixture_date
          ? new Date(a.fixture_date).getTime()
          : Number.MAX_SAFE_INTEGER;
      const bTime = b.fixture_datetime
        ? new Date(b.fixture_datetime).getTime()
        : b.fixture_date
          ? new Date(b.fixture_date).getTime()
          : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 4);

  const leader = standings[0] ?? null;
  const runnerUp = standings[1] ?? null;
  const titleGap = leader && runnerUp ? leader.points - runnerUp.points : null;
  const homeEdge =
    overview?.home_win_pct !== null &&
    overview?.home_win_pct !== undefined &&
    overview?.away_win_pct !== null &&
    overview?.away_win_pct !== undefined
      ? overview.home_win_pct - overview.away_win_pct
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          label={t("leagueDetail.completedMatches")}
          value={formatNumber(overview?.completed_matches ?? results.length, 0)}
          subvalue={t("leagueDetail.latestLabel", {
            date: formatDate(overview?.latest_match_datetime),
          })}
          accent="accent"
        />
        <SnapshotCard
          label={t("leagueDetail.upcomingFixtures")}
          value={formatNumber(overview?.upcoming_fixtures ?? fixtures.length, 0)}
          subvalue={t("leagueDetail.nextLabel", {
            date: formatDate(
              overview?.next_fixture_datetime ?? overview?.next_fixture_date
            ),
          })}
          accent="warning"
        />
        <SnapshotCard
          label={t("leagueDetail.goalsPerMatch")}
          value={formatNumber(overview?.goals_per_match, 2)}
          subvalue={t("leagueDetail.totalGoalsLabel", {
            count: formatNumber(overview?.total_goals, 0),
          })}
          accent="positive"
        />
        <SnapshotCard
          label={t("leagueDetail.titleGap")}
          value={
            titleGap === null
              ? "—"
              : t("leagueDetail.titleGapPts", { count: titleGap })
          }
          subvalue={
            leader && runnerUp
              ? t("leagueDetail.titleGapTeams", {
                  leader: leader.team_name,
                  runnerUp: runnerUp.team_name,
                })
              : t("leagueDetail.titleGapUnavailable")
          }
        />
      </div>

      <SectionCard title={t("leagueDetail.outcomeSplitTitle")}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MiniSplitCard
            label={t("leagueDetail.homeWins")}
            value={formatPct(overview?.home_win_pct)}
            toneClass="border-emerald-500/20 bg-emerald-500/10"
          />
          <MiniSplitCard
            label={t("leagueDetail.draws")}
            value={formatPct(overview?.draw_pct)}
            toneClass="border-amber-500/20 bg-amber-500/10"
          />
          <MiniSplitCard
            label={t("leagueDetail.awayWins")}
            value={formatPct(overview?.away_win_pct)}
            toneClass="border-sky-500/20 bg-sky-500/10"
          />
          <MiniSplitCard
            label={t("leagueDetail.homeEdge")}
            value={formatPctPoint(homeEdge)}
            subvalue={t("leagueDetail.homeEdgeSubvalue")}
            toneClass="border-white/10 bg-white/[0.03]"
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("leagueDetail.bestForm")}>
          <div className="space-y-2">
            {bestForm.length === 0 ? (
              <div className="text-sm text-white/55">{t("leagueDetail.noTableData")}</div>
            ) : (
              bestForm.map((row, index) => (
                <div key={`form-${row.team_source_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {t("leagueDetail.formRank", { index: index + 1, rank: row.rank })}
                    </div>
                    <div className="truncate text-sm font-medium text-white">
                      {row.team_slug ? (
                        <TeamLink teamSlug={row.team_slug} className="transition hover:text-white hover:underline" title={row.team_name}>
                          {row.team_name}
                        </TeamLink>
                      ) : (
                        row.team_name
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {t("leagueDetail.ptsSuffix", { count: row.last5_points })}
                    </div>
                    <div className="text-[11px] text-white/45">{row.form_last5 || "—"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={t("leagueDetail.mostProductiveAttacks")}>
          <div className="space-y-2">
            {topAttack.length === 0 ? (
              <div className="text-sm text-white/55">{t("leagueDetail.noAttackRanking")}</div>
            ) : (
              topAttack.map((row, index) => (
                <div key={`attack-${row.team_source_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {t("leagueDetail.attackRank", { index: index + 1, rank: row.rank })}
                    </div>
                    <div className="truncate text-sm font-medium text-white">
                      {row.team_slug ? (
                        <TeamLink teamSlug={row.team_slug} className="transition hover:text-white hover:underline" title={row.team_name}>
                          {row.team_name}
                        </TeamLink>
                      ) : (
                        row.team_name
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {t("leagueDetail.gfSuffix", { count: row.goals_for })}
                    </div>
                    <div className="text-[11px] text-white/45">
                      {t("leagueDetail.gfPerMatch", { value: perGame(row.goals_for, row.played) })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={t("leagueDetail.bestDefensiveRecords")}>
          <div className="space-y-2">
            {bestDefence.length === 0 ? (
              <div className="text-sm text-white/55">{t("leagueDetail.noDefenceRanking")}</div>
            ) : (
              bestDefence.map((row, index) => (
                <div key={`defence-${row.team_source_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {t("leagueDetail.defenceRank", { index: index + 1, rank: row.rank })}
                    </div>
                    <div className="truncate text-sm font-medium text-white">
                      {row.team_slug ? (
                        <TeamLink teamSlug={row.team_slug} className="transition hover:text-white hover:underline" title={row.team_name}>
                          {row.team_name}
                        </TeamLink>
                      ) : (
                        row.team_name
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {t("leagueDetail.gaSuffix", { count: row.goals_against })}
                    </div>
                    <div className="text-[11px] text-white/45">
                      {t("leagueDetail.gaPerMatch", { value: perGame(row.goals_against, row.played) })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("leagueDetail.latestResultsTitle")}>
          <div className="space-y-2">
            {latestResults.length === 0 ? (
              <div className="text-sm text-white/55">{t("leagueDetail.noResultsAvailable")}</div>
            ) : (
              latestResults.map((row) => (
                <div key={`result-${row.source_match_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">{formatDate(row.match_datetime ?? row.match_date)}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white">
                      <span className="truncate">
                        {row.home_team_slug ? (
                          <TeamLink teamSlug={row.home_team_slug} className="transition hover:text-white hover:underline" title={row.home_team_name ?? undefined}>
                            {row.home_team_name ?? "—"}
                          </TeamLink>
                        ) : (
                          row.home_team_name ?? "—"
                        )}
                      </span>
                      <span className="text-white/45">{t("leagueDetail.vsLabel")}</span>
                      <span className="truncate">
                        {row.away_team_slug ? (
                          <TeamLink teamSlug={row.away_team_slug} className="transition hover:text-white hover:underline" title={row.away_team_name ?? undefined}>
                            {row.away_team_name ?? "—"}
                          </TeamLink>
                        ) : (
                          row.away_team_name ?? "—"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MatchLink sourceMatchId={row.source_match_id} className="text-sm font-semibold text-white transition hover:text-white hover:underline" title={t("leagueDetail.openMatchDetail")}>
                      {row.home_score ?? "—"} - {row.away_score ?? "—"}
                    </MatchLink>
                    <span className={`inline-flex min-w-[56px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getResultTone(row.result_code)}`}>
                      {formatResultCode(row.result_code)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title={t("leagueDetail.nextFixturesTitle")}>
          <div className="space-y-2">
            {nextFixtures.length === 0 ? (
              <div className="text-sm text-white/55">{t("leagueDetail.noOpenFixtures")}</div>
            ) : (
              nextFixtures.map((row) => (
                <div key={`fixture-${row.fixture_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                      {row.round_number
                        ? t("leagueDetail.weekLabel", { number: row.round_number })
                        : "—"}{" "}
                      • {formatDate(row.fixture_datetime ?? row.fixture_date)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white">
                      <span className="truncate">
                        {row.home_team_slug ? (
                          <TeamLink teamSlug={row.home_team_slug} className="transition hover:text-white hover:underline" title={row.home_team_name ?? undefined}>
                            {row.home_team_name ?? "—"}
                          </TeamLink>
                        ) : (
                          row.home_team_name ?? "—"
                        )}
                      </span>
                      <span className="text-white/45">{t("leagueDetail.vsLabel")}</span>
                      <span className="truncate">
                        {row.away_team_slug ? (
                          <TeamLink teamSlug={row.away_team_slug} className="transition hover:text-white hover:underline" title={row.away_team_name ?? undefined}>
                            {row.away_team_name ?? "—"}
                          </TeamLink>
                        ) : (
                          row.away_team_name ?? "—"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {formatTime(t, row.kickoff_time_known, row.kickoff_time_text)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
