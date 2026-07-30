import PlayerMarketPredictionPage from "./PlayerMarketPredictionPage";
import { getAllFootballTeamLogos } from "@/lib/football-teams";

// Erisim kontrolu tek noktada: admin panelinden verilen "player-market"
// nav izni (user_nav_permissions.allowed_keys), lib/supabase/proxy.ts
// middleware'inde uygulanir. Ek email whitelist onayi kaldirildi;
// admin panelinden goruntuleme yetkisi verilen herkes girer.

export default async function Page() {
  const teamLogos = await getAllFootballTeamLogos();

  return <PlayerMarketPredictionPage teamLogos={teamLogos} />;
}
