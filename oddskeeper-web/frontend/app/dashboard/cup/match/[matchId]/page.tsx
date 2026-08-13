import { notFound } from "next/navigation";
import CupMatchDetailPage from "@/features/tsl/resmi/CupMatchDetail";
import { loadCupMatchDetail } from "@/features/tsl/server/cupProfiles";

export const metadata = { title: "Türkiye Kupası · Maç" };

export default async function CupMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await loadCupMatchDetail(matchId);
  if (!data) notFound();
  return <CupMatchDetailPage data={data} />;
}
