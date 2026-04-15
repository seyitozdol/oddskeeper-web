import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function footballClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY).schema("football");
}

function predictionClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY).schema("prediction");
}

export type UpcomingFixture = {
  fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  home_team_slug: string;
  away_team_slug: string;
  round_number: number;
  fixture_date: string;
  season_label: string;
};

export type StatsCache = {
  hf: number | null;
  ha: number | null;
  af: number | null;
  aa: number | null;
  home_match_count: number;
  away_match_count: number;
};

export type Market =
  | "shot" | "sot" | "corner" | "foul" | "card"
  | "saves" | "tackle" | "offside" | "possession"
  | "throwin" | "goalkick";

export type SeasonWeight = {
  season: string;
  weight: number; // 0-100
};

export async function fetchUpcomingFixtures(): Promise<UpcomingFixture[]> {
  const { data, error } = await footballClient()
    .from("fixtures")
    .select("fixture_id, home_team_name, away_team_name, home_team_slug, away_team_slug, round_number, fixture_date, season_label")
    .eq("fixture_status", "scheduled")
    .order("fixture_date", { ascending: true })
    .limit(100);

  if (error) { console.error("fetchUpcomingFixtures error:", error); return []; }
  return data ?? [];
}

export async function fetchTeamStatsCache(
  teamSlug: string,
  seasonLabel: string,
  market: Market,
  nMatches: number
): Promise<StatsCache | null> {
  // N'e eşit veya küçük max N'i çek — takımın oynadığından fazla N seçilince fallback yapar
  const { data, error } = await predictionClient()
    .from("team_stats_cache")
    .select("hf, ha, af, aa, home_match_count, away_match_count")
    .eq("team_slug", teamSlug)
    .eq("season_label", seasonLabel)
    .eq("market", market)
    .lte("n_matches", nMatches)
    .gt("n_matches", 0)
    .order("n_matches", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error("fetchTeamStatsCache error:", error); return null; }
  return data;
}

export async function fetchTeamStatsCacheFullSeason(
  teamSlug: string,
  seasonLabel: string,
  market: Market,
): Promise<StatsCache | null> {
  const { data, error } = await predictionClient()
    .from("team_stats_cache")
    .select("hf, ha, af, aa, home_match_count, away_match_count")
    .eq("team_slug", teamSlug)
    .eq("season_label", seasonLabel)
    .eq("market", market)
    .eq("n_matches", -1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function fetchBothTeamsStats(
  homeSlug: string,
  awaySlug: string,
  currentSeason: string,
  seasonWeights: SeasonWeight[],
  market: Market,
  nMatches: number
): Promise<{
  curr: { home: StatsCache | null; away: StatsCache | null };
  prevBySeasons: { season: string; weight: number; home: StatsCache | null; away: StatsCache | null }[];
}> {
  // Cari sezon — n=-1 ise full season, değilse fallback ile N
  const fetchCurr = nMatches === -1
    ? async (slug: string) => fetchTeamStatsCacheFullSeason(slug, currentSeason, market)
    : async (slug: string) => fetchTeamStatsCache(slug, currentSeason, market, nMatches);

  const [currHome, currAway] = await Promise.all([
    fetchCurr(homeSlug),
    fetchCurr(awaySlug),
  ]);

  // Geçmiş sezonlar (hep full season)
  const prevResults = await Promise.all(
    seasonWeights
      .filter(sw => sw.season !== currentSeason) // güncel sezonu burada atla
      .map(async ({ season, weight }) => {
        const [home, away] = await Promise.all([
          fetchTeamStatsCacheFullSeason(homeSlug, season, market),
          fetchTeamStatsCacheFullSeason(awaySlug, season, market),
        ]);
        return { season, weight, home, away };
      })
  );

  return {
    curr: { home: currHome, away: currAway },
    prevBySeasons: prevResults,
  };
}
