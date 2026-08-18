import { redirectCupPlayerToProfile } from "@/features/tsl/server/cupProfileRedirect";

// Tek-profil birlestirme: eski EL oyuncu URL'i football profiline yonlenir.
export default async function ElPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  await redirectCupPlayerToProfile(
    playerId,
    "/dashboard/euro-cups/el/resmi?season=2026%2F2027&section=players"
  );
}
