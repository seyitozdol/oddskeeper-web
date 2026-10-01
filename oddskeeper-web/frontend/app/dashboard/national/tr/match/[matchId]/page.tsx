import CupMatchDetail from "../../../../../../features/tsl/resmi/EuroCupMatchDetail";

export const metadata = { title: "Maç Detayı · Türkiye A Milli Takımı" };

export default async function TrNationalMatchPage({
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
      backBase="/dashboard/national/tr?section=results"
      scope="national"
    />
  );
}
