import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import PlayerMarketPredictionPage from "./PlayerMarketPredictionPage";
import PlayerMarketAccessDenied from "./PlayerMarketAccessDenied";
import { hasPlayerMarketAccess } from "./access";
import { getAllFootballTeamLogos } from "@/lib/football-teams";

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

  const teamLogos = await getAllFootballTeamLogos();

  return <PlayerMarketPredictionPage teamLogos={teamLogos} />;
}
