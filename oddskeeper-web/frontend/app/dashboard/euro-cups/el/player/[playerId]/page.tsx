import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Avrupa Ligi" };

export default async function ElPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return (
    <EuroCupPlayerDetail
      playerId={playerId}
      viewPrefix="uel"
      competition="UEFA Avrupa Ligi"
      matchBase="/dashboard/euro-cups/el/match"
      backBase="/dashboard/euro-cups/el/resmi?season=2026%2F2027&section=players"
    />
  );
}
