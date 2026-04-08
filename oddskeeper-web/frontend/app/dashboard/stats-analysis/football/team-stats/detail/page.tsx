import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../../../../lib/supabase/server";
import { getFootballTeamBySlug } from "../../../../../../lib/football-teams";

type TeamDetailPageProps = {
  searchParams: Promise<{
    team?: string;
    tab?: string;
  }>;
};

const VALID_TABS = ["team-statistics", "squad", "fixture", "results"] as const;

type ValidTab = (typeof VALID_TABS)[number];

type TeamProfileRow = {
  team_slug: string;
  display_name: string;
  founded_year: number | null;
  stadium_name: string | null;
  head_coach: string | null;
  website_url: string | null;
  capacity: number | null;
  market_value_display: string | null;
};

type TeamResultRow = {
  team_slug: string;
  team_source_id: string;
  team_name: string;
  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;
  is_home: boolean;
  is_away: boolean;
  opponent_name: string | null;
  opponent_source_team_id: string | null;
  team_score: number | null;
  opponent_score: number | null;
  score_display: string | null;
  result_code: "W" | "D" | "L" | null;
  result_points: number | null;
  venue: string | null;
};

function getValidTab(tab?: string): ValidTab {
  if (tab && VALID_TABS.includes(tab as ValidTab)) {
    return tab as ValidTab;
  }

  return "team-statistics";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCapacity(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

function getMetaValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function getWebsiteLabel(value: string | null | undefined) {
  if (!value) return "—";

  try {
    const normalized =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;

    const url = new URL(normalized);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function getResultBadgeClass(resultCode: TeamResultRow["result_code"]) {
  if (resultCode === "W") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (resultCode === "D") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  if (resultCode === "L") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  }

  return "border-white/10 bg-white/[0.03] text-white/60";
}

async function getTeamProfile(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("ref")
    .from("team_profiles")
    .select(
      `
        team_slug,
        display_name,
        founded_year,
        stadium_name,
        head_coach,
        website_url,
        capacity,
        market_value_display
      `
    )
    .eq("team_slug", teamSlug)
    .maybeSingle<TeamProfileRow>();

  if (error) {
    console.error("team profile fetch error:", error);
    return null;
  }

  return data;
}

async function getTeamResults(teamSlug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("team_results_v1")
    .select(
      `
        team_slug,
        team_source_id,
        team_name,
        source_match_id,
        competition,
        match_datetime,
        is_home,
        is_away,
        opponent_name,
        opponent_source_team_id,
        team_score,
        opponent_score,
        score_display,
        result_code,
        result_points,
        venue
      `
    )
    .eq("team_slug", teamSlug)
    .order("match_datetime", { ascending: false })
    .returns<TeamResultRow[]>();

  if (error) {
    console.error("team results fetch error:", error);
    return [];
  }

  return data ?? [];
}

function CompactInfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

export default async function TeamDetailPage({
  searchParams,
}: TeamDetailPageProps) {
  const resolvedSearchParams = await searchParams;
  const teamSlug = resolvedSearchParams.team;
  const activeTab = getValidTab(resolvedSearchParams.tab);

  if (!teamSlug) {
    notFound();
  }

  const localTeam = await getFootballTeamBySlug(teamSlug);

  if (!localTeam) {
    notFound();
  }

  const [teamProfile, teamResults] = await Promise.all([
    getTeamProfile(teamSlug),
    activeTab === "results" ? getTeamResults(teamSlug) : Promise.resolve([]),
  ]);

  const tabs: { key: ValidTab; label: string }[] = [
    { key: "team-statistics", label: "Team Statistics" },
    { key: "squad", label: "Squad" },
    { key: "fixture", label: "Fixture" },
    { key: "results", label: "Results" },
  ];

  return (
    <section className="w-full">
      <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] px-4 py-3 shadow-[0_0_22px_rgba(34,104,189,0.04)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-[#08111d] p-2">
                <Image
                  src={localTeam.logoPath}
                  alt={localTeam.name}
                  width={48}
                  height={48}
                  className="h-auto max-h-[48px] w-auto max-w-[48px] object-contain"
                />
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[#7cbcff]">
                  Football Team Stats
                </p>

                <h1 className="truncate text-[28px] font-semibold leading-none text-white lg:text-[32px]">
                  {teamProfile?.display_name ?? localTeam.name}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const showResultsCount =
                tab.key === "results" && activeTab === "results" && teamResults.length > 0;

              return (
                <Link
                  key={tab.key}
                  href={`/dashboard/stats-analysis/football/team-stats/detail?team=${localTeam.slug}&tab=${tab.key}`}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? "border-[#4da2ff]/40 bg-[#10233b] text-white shadow-[0_0_14px_rgba(77,162,255,0.08)]"
                      : "border-white/10 bg-white/[0.03] text-white/72 hover:border-[#4da2ff]/25 hover:bg-[#0e1d30] hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>

                  {showResultsCount && (
                    <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11px] leading-none text-white/80">
                      {teamResults.length}
                    </span>
                  )}
                </Link>
              );
            })}

            <Link
              href="/dashboard/stats-analysis/football/team-stats"
              className="ml-0 inline-flex rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70 transition hover:border-[#4da2ff]/30 hover:bg-[#0e1d30] hover:text-white xl:ml-3"
            >
              ← Back to teams
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.90),rgba(5,10,18,0.96))] p-3 shadow-[0_0_16px_rgba(34,104,189,0.03)]">
        {activeTab === "results" && (
          <div>
            {teamResults.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
                No result data found for this team.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[14px] border border-white/10">
                <table className="min-w-full border-collapse">
                  <thead className="bg-white/[0.03]">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-white/38">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Competition</th>
                      <th className="px-4 py-2 font-medium">H/A</th>
                      <th className="px-4 py-2 font-medium">Opponent</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                      <th className="px-4 py-2 font-medium">Venue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {teamResults.map((row) => (
                      <tr
                        key={row.source_match_id}
                        className="border-t border-white/10 text-[13px] text-white/80 transition hover:bg-white/[0.018]"
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          {formatDate(row.match_datetime)}
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap text-white/60">
                          {row.competition ?? "—"}
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-[2px] text-[10px] font-medium text-white/72">
                            {row.is_home ? "Home" : "Away"}
                          </span>
                        </td>

                        <td className="px-4 py-2 min-w-[210px]">
                          {row.opponent_name ?? "—"}
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap font-semibold text-white">
                          {row.score_display ?? "—"}
                        </td>

                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex min-w-[28px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold ${getResultBadgeClass(
                              row.result_code
                            )}`}
                          >
                            {row.result_code ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-2 min-w-[210px] text-white/60">
                          {row.venue ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "team-statistics" && (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <CompactInfoCard
                label="Founded"
                value={getMetaValue(teamProfile?.founded_year)}
              />
              <CompactInfoCard
                label="Stadium"
                value={getMetaValue(teamProfile?.stadium_name)}
              />
              <CompactInfoCard
                label="Head Coach"
                value={getMetaValue(teamProfile?.head_coach)}
              />
              <CompactInfoCard
                label="Website"
                value={getWebsiteLabel(teamProfile?.website_url)}
              />
              <CompactInfoCard
                label="Capacity"
                value={formatCapacity(teamProfile?.capacity ?? null)}
              />
              <CompactInfoCard
                label="Market Value"
                value={getMetaValue(teamProfile?.market_value_display)}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
              Team Statistics panel will be connected next.
            </div>
          </div>
        )}

        {activeTab === "squad" && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
            Squad panel will be connected next.
          </div>
        )}

        {activeTab === "fixture" && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
            Fixture panel will be connected after the fixtures table is created.
          </div>
        )}
      </div>
    </section>
  );
}