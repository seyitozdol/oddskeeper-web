import EuroCupPlayerDetail from "@/features/tsl/resmi/EuroCupPlayerDetail";

export const metadata = { title: "Oyuncu · Konferans Ligi" };

export default async function ConfPlayerPage({
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
      viewPrefix="uecl"
      competition="UEFA Konferans Ligi"
      matchBase="/dashboard/euro-cups/conf/match"
      playerBase="/dashboard/euro-cups/conf/player"
      backBase="/dashboard/euro-cups/conf/resmi?season=2026%2F2027&section=players"
      tab={tab}
    />
  );
}
