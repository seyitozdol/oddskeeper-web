import {
  RESMI_LEADER_METRICS,
  isResmiSection,
  type ResmiSection,
} from "../constants";
import type { LeagueConfig } from "../leagues";
import {
  loadResmiLig,
  loadResmiPlayerRankings,
  loadResmiPlayers,
  loadResmiResults,
  loadResmiTeamRankings,
  loadResmiTeams,
} from "../server/resmiLoaders";
import ResmiControlBar from "./ResmiControlBar";
import SectionTransition from "../shared/SectionTransition";
import ResmiLig from "./ResmiLig";
import ResmiResults from "./ResmiResults";
import ResmiTeams from "./ResmiTeams";
import ResmiPlayers from "./ResmiPlayers";
import ResmiPlayerRankings from "./ResmiPlayerRankings";
import ResmiTeamRankings from "./ResmiTeamRankings";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ResmiExperience({
  config,
  sp,
}: {
  config: LeagueConfig;
  sp: Record<string, string | string[] | undefined>;
}) {
  const seasonRaw = first(sp.season);
  const season = seasonRaw && config.seasons.includes(seasonRaw) ? seasonRaw : config.defaultSeason;
  const section: ResmiSection = isResmiSection(first(sp.section)) ? (first(sp.section) as ResmiSection) : "league";
  const metric = first(sp.metric);
  const leaderMetric = RESMI_LEADER_METRICS.find((m) => m.key === first(sp.leader))?.key ?? "goals_total";

  let content: React.ReactNode = null;
  if (section === "league") content = <ResmiLig data={await loadResmiLig(config, season, leaderMetric)} />;
  else if (section === "results") content = <ResmiResults data={await loadResmiResults(config, season)} />;
  else if (section === "teams") content = <ResmiTeams data={await loadResmiTeams(config, season)} />;
  else if (section === "playerRankings")
    content = <ResmiPlayerRankings data={await loadResmiPlayerRankings(config, season, metric)} />;
  else if (section === "teamRankings")
    content = <ResmiTeamRankings data={await loadResmiTeamRankings(config, season, metric)} />;
  else content = <ResmiPlayers data={await loadResmiPlayers(config, season)} />;

  return (
    <section className="px-4 pb-14 lg:px-8">
      <ResmiControlBar config={config} section={section} season={season} />
      <SectionTransition transitionKey={`${config.source}-${section}-${season}-${leaderMetric}-${metric ?? ""}`}>
        {content}
      </SectionTransition>
    </section>
  );
}
