import CupMatchDetail from "../../../../../../features/tsl/resmi/EuroCupMatchDetail";

export const metadata = { title: "Maç Detayı · Şampiyonlar Ligi" };

export default async function ClMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { matchId } = await params;
  const { returnTo } = await searchParams;
  return (
    <CupMatchDetail
      matchId={matchId}
      returnTo={returnTo}
      backBase="/dashboard/euro-cups/cl/resmi?season=2026%2F2027&section=league"
    />
  );
}
