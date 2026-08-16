import {
  RESMI_LEADER_METRICS,
  isResmiSection,
  type ResmiSection,
} from "../constants";
import type { LeagueConfig } from "../leagues";
import {
  loadResmiCupStages,
  loadResmiLig,
  loadResmiReferees,
  loadResmiPlayerRankings,
  loadResmiPlayers,
  loadResmiResults,
  loadResmiTeamRankings,
  loadResmiTeamsTable,
  loadResmiTransfers,
} from "../server/resmiLoaders";
import ResmiControlBar from "./ResmiControlBar";
import SectionTransition from "../shared/SectionTransition";
import ResmiCupStages from "./ResmiCupStages";
import ResmiLig from "./ResmiLig";
import ResmiResults from "./ResmiResults";
import ResmiReferees from "./ResmiReferees";
import ResmiTeamsTable from "./ResmiTeamsTable";
import ResmiTransfers from "./ResmiTransfers";
import ResmiPlayers from "./ResmiPlayers";
import ResmiPlayerRankings from "./ResmiPlayerRankings";
import ResmiTeamRankings from "./ResmiTeamRankings";
import ResmiMatchStatsModel from "./ResmiMatchStatsModel";
// Player Stats Model: eski "Player Participant Tools" aracı lig kaynağına göre
// gömülür. TSL futbol logolarını, 1. Lig tff1 logolarını kullanır.
import TslPlayerMarket from "@/app/dashboard/player-market-prediction/PlayerMarketPredictionPage";
import Tff1PlayerMarket from "@/app/dashboard/tff-1-lig/player-market/PlayerMarketPredictionPage";
import { getAllFootballTeamLogos } from "@/lib/football-teams";
import { getTff1TeamLogos } from "@/features/tff1/server/getTff1Stats";
import { getNavAccess } from "@/lib/nav-access-server";
import { isNavKeyAllowed } from "@/lib/nav-permissions";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Kupa: oyuncu tarafı sekmeleri (Players/Rankings/MSM/PSM) Faz 5'te doldurulacak.
async function CupComingSoon(): Promise<React.ReactNode> {
  const { getLocale } = await import("@/lib/i18n/server");
  const locale = await getLocale();
  const tr = locale === "tr";
  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-line bg-card p-6 text-center text-[13px] text-ink-2">
      {tr
        ? "Bu bölüm kupa oyuncu verisi hazırlandıkça yakında eklenecek."
        : "This section will be added soon, as cup player data is prepared."}
    </div>
  );
}

// Player Stats Model içeriği: lig kaynağına göre ilgili Player Participant Tools
// aracını (toggle olmadan) render eder. Logolar server tarafında yüklenir.
async function renderPlayerStatsModel(config: LeagueConfig): Promise<React.ReactNode> {
  if (config.source === "tsl") {
    const teamLogos = await getAllFootballTeamLogos();
    return <TslPlayerMarket teamLogos={teamLogos} />;
  }
  const logoRows = await getTff1TeamLogos();
  const teamLogos: Record<string, string> = {};
  for (const row of logoRows) {
    if (row.logo_url) teamLogos[row.team_id] = row.logo_url;
  }
  return <Tff1PlayerMarket teamLogos={teamLogos} />;
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
  const rawSection = isResmiSection(first(sp.section)) ? (first(sp.section) as ResmiSection) : config.defaultSection;
  // Sadece bu lig için tanımlı sekmeler geçerli; değilse varsayılana düş.
  const section: ResmiSection = config.sections.includes(rawSection) ? rawSection : config.defaultSection;
  const metric = first(sp.metric);
  const leaderMetric = RESMI_LEADER_METRICS.find((m) => m.key === first(sp.leader))?.key ?? "goals_total";

  // Kupada Players + Rankings + MSM hazır. PSM (Player Participant Tools) henüz değil.
  const cupPending = config.source === "cup" && section === "playerStatsModel";

  let content: React.ReactNode = null;
  if (cupPending) content = <CupComingSoon />;
  else if (section === "cupStages") content = <ResmiCupStages data={await loadResmiCupStages(config, season)} />;
  else if (section === "league") content = <ResmiLig data={await loadResmiLig(config, season, leaderMetric)} />;
  else if (section === "results") content = <ResmiResults data={await loadResmiResults(config, season)} />;
  else if (section === "referees") content = <ResmiReferees data={await loadResmiReferees(config, season)} />;
  else if (section === "teams") content = <ResmiTeamsTable data={await loadResmiTeamsTable(config, season)} />;
  else if (section === "transfers") content = <ResmiTransfers data={await loadResmiTransfers(config, season)} />;
  else if (section === "playerRankings")
    content = <ResmiPlayerRankings data={await loadResmiPlayerRankings(config, season, metric)} />;
  else if (section === "teamRankings")
    content = <ResmiTeamRankings data={await loadResmiTeamRankings(config, season, metric)} />;
  else if (section === "matchStatsModel") {
    const access = await getNavAccess();
    content = (
      <ResmiMatchStatsModel
        league={config.source}
        isAdmin={access.isAdmin}
        canGSheet={isNavKeyAllowed("msm-gsheet", access.allowedKeys)}
      />
    );
  }
  else if (section === "playerStatsModel") content = await renderPlayerStatsModel(config);
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
