import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Konferans Ligi" };

export default async function ConfPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return (
    <EuroCupPlayerDetail
      playerId={playerId}
      viewPrefix="uecl"
      competition="UEFA Konferans Ligi"
      matchBase="/dashboard/euro-cups/conf/match"
      backBase="/dashboard/euro-cups/conf/resmi?season=2026%2F2027&section=players"
    />
  );
}
