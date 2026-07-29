import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import PlayerMarketPredictionPage from "./PlayerMarketPredictionPage";
import PlayerMarketAccessDenied from "../../player-market-prediction/PlayerMarketAccessDenied";
import { hasPlayerMarketAccess } from "../../player-market-prediction/access";
import { getTff1TeamLogos } from "@/features/tff1/server/getTff1Stats";

// TFF 1. Lig player market: TSL modulundeki auth + whitelist kalibinin aynisi.
// Whitelist ortak (player-market-prediction/access), erisim reddi ekrani da
// oradan yeniden kullanilir.

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function Page() {
  const user = await getUser();
  const userEmail = user?.email ?? null;

  // Lokal geliştirme bypass'ı: dashboard/layout.tsx'teki kuralla aynı;
  // NODE_ENV "production" olduğu için canlıda hiçbir koşulda devreye girmez.
  const devAuthBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "1";

  if (!devAuthBypass && !hasPlayerMarketAccess(userEmail)) {
    return <PlayerMarketAccessDenied userEmail={userEmail} />;
  }

  // Takim logolari: tff1_team_logos_v1 (team_id -> logo_url). Logosu olmayan
  // takimlar client tarafinda logosuz gosterilir (TSL'deki gibi sadece isim).
  const logoRows = await getTff1TeamLogos();
  const teamLogos: Record<string, string> = {};
  for (const row of logoRows) {
    if (row.logo_url) teamLogos[row.team_id] = row.logo_url;
  }

  return <PlayerMarketPredictionPage teamLogos={teamLogos} />;
}
