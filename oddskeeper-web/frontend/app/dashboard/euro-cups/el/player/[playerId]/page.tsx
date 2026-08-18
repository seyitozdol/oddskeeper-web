import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Avrupa Ligi" };

export default async function ElPlayerPage({
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
      viewPrefix="uel"
      competition="UEFA Avrupa Ligi"
      matchBase="/dashboard/euro-cups/el/match"
      playerBase="/dashboard/euro-cups/el/player"
      backBase="/dashboard/euro-cups/el/resmi?season=2026%2F2027&section=players"
      tab={tab}
    />
  );
}
