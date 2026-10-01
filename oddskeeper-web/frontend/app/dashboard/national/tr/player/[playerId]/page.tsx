import { redirectCupPlayerToProfile } from "@/features/tsl/server/cupProfileRedirect";

// Tek-profil ilkesi: milli takim oyuncusunun ayri sayfasi yok; sofascore id ->
// football profil slug'i cozulur ve tek football profiline yonlenir (PSM
// cekmecesindeki "tam profil" linki buraya gelir).
export default async function TrNationalPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  await redirectCupPlayerToProfile(playerId, "/dashboard/national/tr?section=players");
}
