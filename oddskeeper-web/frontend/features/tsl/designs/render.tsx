import type { ReactNode } from "react";
import type { TslDesign, TslSection } from "../constants";
import type { LeagueBundle, PlayersBundle, TeamsBundle } from "../server/loaders";

import SahneLeague from "./sahne/SahneLeague";
import SahnePlayers from "./sahne/SahnePlayers";
import SahneTeams from "./sahne/SahneTeams";
import RadarLeague from "./radar/RadarLeague";
import RadarPlayers from "./radar/RadarPlayers";
import RadarTeams from "./radar/RadarTeams";
import PanelLeague from "./panel/PanelLeague";
import PanelPlayers from "./panel/PanelPlayers";
import PanelTeams from "./panel/PanelTeams";

type Args = {
  design: TslDesign;
  section: TslSection;
  league?: LeagueBundle;
  players?: PlayersBundle;
  teams?: TeamsBundle;
  teamA?: string;
  teamB?: string;
};

export function renderDesignSection(args: Args): ReactNode {
  const { design, section, league, players, teams, teamA, teamB } = args;

  if (section === "league" && league) {
    if (design === "sahne") return <SahneLeague data={league} />;
    if (design === "radar") return <RadarLeague data={league} />;
    return <PanelLeague data={league} />;
  }
  if (section === "players" && players) {
    if (design === "sahne") return <SahnePlayers data={players} />;
    if (design === "radar") return <RadarPlayers data={players} />;
    return <PanelPlayers data={players} />;
  }
  if (section === "teams" && teams) {
    if (design === "sahne") return <SahneTeams data={teams} />;
    if (design === "radar") return <RadarTeams data={teams} />;
    return <PanelTeams data={teams} teamA={teamA} teamB={teamB} />;
  }
  return null;
}
