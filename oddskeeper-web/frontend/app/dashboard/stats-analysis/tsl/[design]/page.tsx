import { notFound } from "next/navigation";
import {
  TSL_DEFAULT_SEASON,
  isTslDesign,
  isTslSeason,
  isTslSection,
  type TslDesign,
  type TslSeason,
  type TslSection,
} from "../../../../../features/tsl/constants";
import TslControlBar from "../../../../../features/tsl/shared/TslControlBar";
import SectionTransition from "../../../../../features/tsl/shared/SectionTransition";
import {
  loadLeague,
  loadPlayers,
  loadTeams,
} from "../../../../../features/tsl/server/loaders";
import { renderDesignSection } from "../../../../../features/tsl/designs/render";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const DESIGN_TITLE: Record<string, string> = {
  sahne: "Sahne",
  radar: "Radar",
  panel: "Panel",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ design: string }>;
}) {
  const { design } = await params;
  const name = DESIGN_TITLE[design] ?? "";
  return { title: `TSL ${name} · Süper Lig` };
}

export default async function TslDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ design: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { design: designParam } = await params;
  if (!isTslDesign(designParam)) notFound();
  const design: TslDesign = designParam;

  const sp = await searchParams;
  const seasonRaw = first(sp.season);
  const season: TslSeason = isTslSeason(seasonRaw) ? seasonRaw : TSL_DEFAULT_SEASON;
  const section: TslSection = isTslSection(first(sp.section))
    ? (first(sp.section) as TslSection)
    : "league";
  const metric = first(sp.metric);
  const teamA = first(sp.teamA);
  const teamB = first(sp.teamB);

  // Bolume gore veri yukle
  let content: React.ReactNode = null;
  if (section === "league") {
    const bundle = await loadLeague(season);
    content = renderDesignSection({ design, section, league: bundle });
  } else if (section === "players") {
    const bundle = await loadPlayers(season, metric);
    content = renderDesignSection({ design, section, players: bundle });
  } else {
    const bundle = await loadTeams(season);
    content = renderDesignSection({ design, section, teams: bundle, teamA, teamB });
  }

  return (
    <section className="px-4 pb-14 lg:px-8">
      <TslControlBar design={design} section={section} season={season} />
      <SectionTransition transitionKey={`${design}-${section}-${season}-${metric ?? ""}`}>
        {content}
      </SectionTransition>
    </section>
  );
}
