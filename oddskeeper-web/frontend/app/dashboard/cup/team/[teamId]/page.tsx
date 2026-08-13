import { notFound } from "next/navigation";
import CupTeamProfilePage from "@/features/tsl/resmi/CupTeamProfile";
import { loadCupTeamProfile } from "@/features/tsl/server/cupProfiles";

export const metadata = { title: "Türkiye Kupası · Takım" };

export default async function CupTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await loadCupTeamProfile(teamId);
  if (!data) notFound();
  return <CupTeamProfilePage data={data} />;
}
