import {
  RESMI_DEFAULT_SEASON,
  RESMI_LEADER_METRICS,
  isResmiSection,
  isTslSeason,
  type ResmiSection,
  type TslSeason,
} from "../../../../../features/tsl/constants";
import {
  loadResmiLig,
  loadResmiPlayerRankings,
  loadResmiPlayers,
  loadResmiResults,
  loadResmiTeamRankings,
  loadResmiTeams,
} from "../../../../../features/tsl/server/resmiLoaders";
import ResmiControlBar from "../../../../../features/tsl/resmi/ResmiControlBar";
import SectionTransition from "../../../../../features/tsl/shared/SectionTransition";
import ResmiLig from "../../../../../features/tsl/resmi/ResmiLig";
import ResmiResults from "../../../../../features/tsl/resmi/ResmiResults";
import ResmiTeams from "../../../../../features/tsl/resmi/ResmiTeams";
import ResmiPlayers from "../../../../../features/tsl/resmi/ResmiPlayers";
import ResmiPlayerRankings from "../../../../../features/tsl/resmi/ResmiPlayerRankings";
import ResmiTeamRankings from "../../../../../features/tsl/resmi/ResmiTeamRankings";

export const metadata = {
  title: "TSL Resmi · Süper Lig",
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ResmiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const seasonRaw = first(sp.season);
  const season: TslSeason = isTslSeason(seasonRaw) ? seasonRaw : RESMI_DEFAULT_SEASON;
  const section: ResmiSection = isResmiSection(first(sp.section))
    ? (first(sp.section) as ResmiSection)
    : "league";
  const metric = first(sp.metric);

  const leaderRaw = first(sp.leader);
  const leaderMetric =
    RESMI_LEADER_METRICS.find((m) => m.key === leaderRaw)?.key ?? "goals_total";

  let content: React.ReactNode = null;
  if (section === "league") {
    content = <ResmiLig data={await loadResmiLig(season, leaderMetric)} />;
  } else if (section === "results") {
    content = <ResmiResults data={await loadResmiResults(season)} />;
  } else if (section === "teams") {
    content = <ResmiTeams data={await loadResmiTeams(season)} />;
  } else if (section === "playerRankings") {
    content = <ResmiPlayerRankings data={await loadResmiPlayerRankings(season, metric)} />;
  } else if (section === "teamRankings") {
    content = <ResmiTeamRankings data={await loadResmiTeamRankings(season, metric)} />;
  } else {
    content = <ResmiPlayers data={await loadResmiPlayers(season)} />;
  }

  return (
    <section className="px-4 pb-14 lg:px-8">
      <ResmiControlBar section={section} season={season} />
      <SectionTransition transitionKey={`resmi-${section}-${season}-${leaderMetric}-${metric ?? ""}`}>
        {content}
      </SectionTransition>
    </section>
  );
}
