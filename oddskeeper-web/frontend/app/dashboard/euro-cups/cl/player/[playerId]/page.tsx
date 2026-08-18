import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Şampiyonlar Ligi" };

export default async function ClPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return (
    <EuroCupPlayerDetail
      playerId={playerId}
      viewPrefix="ucl"
      competition="UEFA Şampiyonlar Ligi"
      matchBase="/dashboard/euro-cups/cl/match"
      backBase="/dashboard/euro-cups/cl/resmi?season=2025%2F2026&section=players"
    />
  );
}
