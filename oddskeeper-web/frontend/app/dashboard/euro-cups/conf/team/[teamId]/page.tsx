import EuroCupTeamDetail from "@/features/tsl/resmi/EuroCupTeamDetail";

export const metadata = { title: "Takım · Konferans Ligi" };

export default async function ConfTeamPage({
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
      viewPrefix="uecl"
      competition="UEFA Konferans Ligi"
      matchBase="/dashboard/euro-cups/conf/match"
      playerBase="/dashboard/euro-cups/conf/player"
      teamBase="/dashboard/euro-cups/conf/team"
      backBase="/dashboard/euro-cups/conf/resmi?season=2026%2F2027&section=teams"
      leagueLogo="/images/leagues/uecl.png"
      tab={tab}
      season={season}
    />
  );
}
