import PlayerMarketPredictionPage from "./PlayerMarketPredictionPage";
import { getTff1TeamLogos } from "@/features/tff1/server/getTff1Stats";

// TFF 1. Lig player market. Erisim kontrolu tek noktada: admin panelinden
// verilen "tff-1-lig" nav izni, lib/supabase/proxy.ts middleware'inde
// uygulanir. Ek email whitelist onayi kaldirildi; admin panelinden
// goruntuleme yetkisi verilen herkes girer.

export default async function Page() {
  // Takim logolari: tff1_team_logos_v1 (team_id -> logo_url). Logosu olmayan
  // takimlar client tarafinda logosuz gosterilir (TSL'deki gibi sadece isim).
  const logoRows = await getTff1TeamLogos();
  const teamLogos: Record<string, string> = {};
  for (const row of logoRows) {
    if (row.logo_url) teamLogos[row.team_id] = row.logo_url;
  }

  return <PlayerMarketPredictionPage teamLogos={teamLogos} />;
}
