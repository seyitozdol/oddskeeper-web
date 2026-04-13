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

export async function fetchUpcomingFixtures(): Promise<UpcomingFixture[]> {
  const { data, error } = await footballClient()
    .from("fixtures")
    .select(
      "fixture_id, home_team_name, away_team_name, home_team_slug, away_team_slug, round_number, fixture_date, season_label"
    )
    .eq("fixture_status", "scheduled")
    .order("fixture_date", { ascending: true })
    .limit(100);

  if (error) {
    console.error("fetchUpcomingFixtures error:", error);
    return [];
  }
  return data ?? [];
}

export async function fetchTeamStatsCache(
  teamSlug: string,
  seasonLabel: string,
  market: Market,
  nMatches: number
): Promise<StatsCache | null> {
  const client = predictionClient();

  const { data, error } = await client
    .from("team_stats_cache")
    .select("hf, ha, af, aa, home_match_count, away_match_count")
    .eq("team_slug", teamSlug)
    .eq("season_label", seasonLabel)
    .eq("market", market)
    .eq("n_matches", nMatches)
    .maybeSingle();

  if (error) {
    console.error("fetchTeamStatsCache error:", error);
    return null;
  }
  return data;
}

export async function fetchBothTeamsStats(
  homeSlug: string,
  awaySlug: string,
  currentSeason: string,
  prevSeason: string,
  market: Market,
  nMatches: number
): Promise<{
  curr: { home: StatsCache | null; away: StatsCache | null };
  prev: { home: StatsCache | null; away: StatsCache | null };
}> {
  const [currHome, currAway, prevHome, prevAway] = await Promise.all([
    fetchTeamStatsCache(homeSlug, currentSeason, market, nMatches),
    fetchTeamStatsCache(awaySlug, currentSeason, market, nMatches),
    fetchTeamStatsCache(homeSlug, prevSeason, market, -1),
    fetchTeamStatsCache(awaySlug, prevSeason, market, -1),
  ]);

  return {
    curr: { home: currHome, away: currAway },
    prev: { home: prevHome, away: prevAway },
  };
}
