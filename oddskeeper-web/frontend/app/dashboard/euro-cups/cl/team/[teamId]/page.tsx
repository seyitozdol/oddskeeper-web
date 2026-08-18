import EuroCupTeamDetail from "@/features/tsl/resmi/EuroCupTeamDetail";

export const metadata = { title: "Takım · Şampiyonlar Ligi" };

export default async function ClTeamPage({
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
      viewPrefix="ucl"
      competition="UEFA Şampiyonlar Ligi"
      matchBase="/dashboard/euro-cups/cl/match"
      playerBase="/dashboard/euro-cups/cl/player"
      teamBase="/dashboard/euro-cups/cl/team"
      backBase="/dashboard/euro-cups/cl/resmi?season=2026%2F2027&section=teams"
      leagueLogo="/images/leagues/ucl.png"
      tab={tab}
      season={season}
    />
  );
}
