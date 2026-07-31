import {
  RESMI_LEADER_METRICS,
  TSL_DEFAULT_SEASON,
  isResmiSection,
  isTslSeason,
  type ResmiSection,
  type TslSeason,
} from "../../../../../features/tsl/constants";
import {
  loadResmiLig,
  loadResmiRanking,
  loadResmiTeams,
} from "../../../../../features/tsl/server/resmiLoaders";
import ResmiControlBar from "../../../../../features/tsl/resmi/ResmiControlBar";
import SectionTransition from "../../../../../features/tsl/shared/SectionTransition";
import ResmiLig from "../../../../../features/tsl/resmi/ResmiLig";
import ResmiRanking from "../../../../../features/tsl/resmi/ResmiRanking";
import ResmiTeams from "../../../../../features/tsl/resmi/ResmiTeams";
import ResmiPlayers from "../../../../../features/tsl/resmi/ResmiPlayers";
import { getPlayerStatsList } from "../../../../../features/player-stats/server/getPlayerStatsList";
import { getTslAdvancedStats } from "../../../../../features/player-stats/server/getTslAdvancedStats";
import { getAllFootballTeamLogos } from "../../../../../lib/football-teams";

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
  const season: TslSeason = isTslSeason(seasonRaw) ? seasonRaw : TSL_DEFAULT_SEASON;
  const section: ResmiSection = isResmiSection(first(sp.section))
    ? (first(sp.section) as ResmiSection)
    : "league";

  const leaderRaw = first(sp.leader);
  const leaderMetric =
    RESMI_LEADER_METRICS.find((m) => m.key === leaderRaw)?.key ?? "goals_total";

  let content: React.ReactNode = null;
  if (section === "league") {
    content = <ResmiLig data={await loadResmiLig(season, leaderMetric)} />;
  } else if (section === "ranking") {
    content = <ResmiRanking data={await loadResmiRanking(season)} />;
  } else if (section === "teams") {
    content = <ResmiTeams data={await loadResmiTeams(season)} />;
  } else {
    const [rows, advancedRows, teamLogos] = await Promise.all([
      getPlayerStatsList(),
      getTslAdvancedStats(),
      getAllFootballTeamLogos(),
    ]);
    content = (
      <ResmiPlayers
        rows={rows}
        advancedRows={advancedRows}
        teamLogos={teamLogos}
        season={season}
      />
    );
  }

  return (
    <section className="px-4 pb-14 lg:px-8">
      <ResmiControlBar section={section} season={season} />
      <SectionTransition transitionKey={`resmi-${section}-${season}-${leaderMetric}`}>
        {content}
      </SectionTransition>
    </section>
  );
}
