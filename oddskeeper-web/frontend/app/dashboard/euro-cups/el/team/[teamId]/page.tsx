import EuroCupTeamDetail from "@/features/tsl/resmi/EuroCupTeamDetail";

export const metadata = { title: "Takım · Avrupa Ligi" };

export default async function ElTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string; season?: string }>;
}) {
  const { teamId } = await params;
  const { tab, season } = await searchParams;
  return (
    <EuroCupTeamDetail
      teamId={teamId}
      viewPrefix="uel"
      competition="UEFA Avrupa Ligi"
      matchBase="/dashboard/euro-cups/el/match"
      playerBase="/dashboard/euro-cups/el/player"
      teamBase="/dashboard/euro-cups/el/team"
      backBase="/dashboard/euro-cups/el/resmi?season=2026%2F2027&section=teams"
      leagueLogo="/images/leagues/uel.png"
      tab={tab}
      season={season}
    />
  );
}
