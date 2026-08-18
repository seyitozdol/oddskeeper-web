import { redirectCupPlayerToProfile } from "@/features/tsl/server/cupProfileRedirect";

// Tek-profil birlestirme: eski CL oyuncu URL'i football profiline yonlenir.
export default async function ClPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  await redirectCupPlayerToProfile(
    playerId,
    "/dashboard/euro-cups/cl/resmi?season=2026%2F2027&section=players"
  );
}
