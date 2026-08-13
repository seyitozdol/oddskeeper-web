import { notFound } from "next/navigation";
import CupPlayerProfilePage from "@/features/tsl/resmi/CupPlayerProfile";
import { loadCupPlayerProfile } from "@/features/tsl/server/cupProfiles";

export const metadata = { title: "Türkiye Kupası · Oyuncu" };

export default async function CupPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const data = await loadCupPlayerProfile(playerId);
  if (!data) notFound();
  return <CupPlayerProfilePage data={data} />;
}
