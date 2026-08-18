import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Şampiyonlar Ligi" };

export default async function ClPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { playerId } = await params;
  const { tab } = await searchParams;
  return (
    <EuroCupPlayerDetail
      playerId={playerId}
      viewPrefix="ucl"
      competition="UEFA Şampiyonlar Ligi"
      matchBase="/dashboard/euro-cups/cl/match"
      playerBase="/dashboard/euro-cups/cl/player"
      backBase="/dashboard/euro-cups/cl/resmi?season=2026%2F2027&section=players"
      tab={tab}
    />
  );
}
