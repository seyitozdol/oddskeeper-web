// Basketbol veri erişimi — analytics.bb_* view'ları (anon/authenticated SELECT).
// Futbol tff1 kalıbı: her fn kendi createClient()'ını açar, hata durumunda
// loglar ve boş dizi/null döner (sayfa her zaman render olsun).

import { createClient } from "@/lib/supabase/server";
import type {
  BktTeamSeasonRow,
  BktPlayerSeasonRow,
  BktLeaderboardRow,
  BktPlayerLogRow,
  BktTeamLogRow,
  BktMarketModelRow,
  BktHomeAwaySplitRow,
  BktTeamMetricFormRow,
  BktPlayerShareRow,
  BktPlayerWindowRow,
  BktFixtureRow,
  BktPlayerListRow,
  BktEuroSeasonRow,
  BktEuroLogRow,
} from "../types";

const SEASON = "2025-2026";
const PAGE_SIZE = 1000;

export async function getBasketballStandings(): Promise<BktTeamSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_season_stats_v1")
    .select("*")
    .eq("season_label", SEASON)
    .order("standings_rank", { ascending: true })
    .returns<BktTeamSeasonRow[]>();
  if (error) {
    console.error("getBasketballStandings error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerLeaderboard(): Promise<BktLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_leaderboard_v1")
    .select("*")
    .eq("season_label", SEASON)
    .order("ppg", { ascending: false })
    .returns<BktLeaderboardRow[]>();
  if (error) {
    console.error("getBasketballPlayerLeaderboard error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamPointsModel(): Promise<BktMarketModelRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_market_model_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("market_key", "points")
    .returns<BktMarketModelRow[]>();
  if (error) {
    console.error("getBasketballTeamPointsModel error:", error.message);
    return [];
  }
  return data ?? [];
}

// ---- Katılım Araçları veri katmanı ----
export async function getBasketballHomeAwaySplits(): Promise<BktHomeAwaySplitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_home_away_split_v1")
    .select("*")
    .eq("season_label", SEASON)
    .returns<BktHomeAwaySplitRow[]>();
  if (error) {
    console.error("getBasketballHomeAwaySplits error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamMetricForms(): Promise<BktTeamMetricFormRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_metric_form_v1")
    .select("*")
    .eq("season_label", SEASON)
    .returns<BktTeamMetricFormRow[]>();
  if (error) {
    console.error("getBasketballTeamMetricForms error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerShares(): Promise<BktPlayerShareRow[]> {
  const supabase = await createClient();
  const rows: BktPlayerShareRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_player_metric_share_v1")
      .select("*")
      .eq("season_label", SEASON)
      .order("team_slug", { ascending: true })
      .order("market_key", { ascending: true })
      .order("share", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .returns<BktPlayerShareRow[]>();
    if (error) {
      console.error("getBasketballPlayerShares error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function getBasketballPlayerWindows(): Promise<BktPlayerWindowRow[]> {
  const supabase = await createClient();
  const rows: BktPlayerWindowRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_player_metric_window_v1")
      .select("*")
      .eq("season_label", SEASON)
      .order("team_slug", { ascending: true })
      .order("market_key", { ascending: true })
      .order("season_avg", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .returns<BktPlayerWindowRow[]>();
    if (error) {
      console.error("getBasketballPlayerWindows error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function getBasketballPlayerList(): Promise<BktPlayerListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("player_slug,player_name,team_slug,team_name,games")
    .eq("season_label", SEASON)
    .order("team_name", { ascending: true })
    .order("player_name", { ascending: true })
    .returns<BktPlayerListRow[]>();
  if (error) {
    console.error("getBasketballPlayerList error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballFixtures(): Promise<BktFixtureRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_fixtures_v1")
    .select("*")
    .order("fixture_id", { ascending: true })
    .returns<BktFixtureRow[]>();
  if (error) {
    console.error("getBasketballFixtures error:", error.message);
    return [];
  }
  // yalnız iki takımı dolu olanlar (Excel Fixture'da boş satırlar var)
  return (data ?? []).filter((f) => f.home_team_slug && f.away_team_slug);
}

export async function getBasketballAllTeamMatchLogs(): Promise<BktTeamLogRow[]> {
  const supabase = await createClient();
  const rows: BktTeamLogRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_team_match_log_v1")
      .select("*")
      .eq("season_label", SEASON)
      .order("match_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .returns<BktTeamLogRow[]>();
    if (error) {
      console.error("getBasketballAllTeamMatchLogs error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function getBasketballTeam(teamSlug: string, season: string = SEASON): Promise<BktTeamSeasonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_season_stats_v1")
    .select("*")
    .eq("season_label", season)
    .eq("team_slug", teamSlug)
    .maybeSingle<BktTeamSeasonRow>();
  if (error) {
    console.error("getBasketballTeam error:", error.message);
    return null;
  }
  return data ?? null;
}

export async function getBasketballTeamRoster(teamSlug: string, season: string = SEASON): Promise<BktPlayerSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("*")
    .eq("season_label", season)
    .eq("team_slug", teamSlug)
    .order("ppg", { ascending: false })
    .returns<BktPlayerSeasonRow[]>();
  if (error) {
    console.error("getBasketballTeamRoster error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamMatchLog(teamSlug: string, season: string = SEASON): Promise<BktTeamLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_match_log_v1")
    .select("*")
    .eq("season_label", season)
    .eq("team_slug", teamSlug)
    .order("match_date", { ascending: false })
    .returns<BktTeamLogRow[]>();
  if (error) {
    console.error("getBasketballTeamMatchLog error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayer(playerSlug: string, season: string = SEASON): Promise<BktPlayerSeasonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("*")
    .eq("season_label", season)
    .eq("player_slug", playerSlug)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("getBasketballPlayer error:", error.message);
    return null;
  }
  return data ?? null;
}

export async function getBasketballPlayerModel(playerSlug: string): Promise<BktMarketModelRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_market_model_v1")
    .select("*")
    .eq("season_label", SEASON)
    .eq("player_slug", playerSlug)
    .returns<BktMarketModelRow[]>();
  if (error) {
    console.error("getBasketballPlayerModel error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamModel(teamSlug: string, season: string = SEASON): Promise<BktMarketModelRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_market_model_v1")
    .select("*")
    .eq("season_label", season)
    .eq("team_slug", teamSlug)
    .returns<BktMarketModelRow[]>();
  if (error) {
    console.error("getBasketballTeamModel error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerEuroSeasons(playerSlug: string, season: string = SEASON): Promise<BktEuroSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bsl_player_euro_seasons_v1")
    .select("*")
    .eq("bsl_player_slug", playerSlug)
    .eq("season_label", season)
    .order("competition", { ascending: true })
    .order("season_code", { ascending: false })
    .returns<BktEuroSeasonRow[]>();
  if (error) {
    console.error("getBasketballPlayerEuroSeasons error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerEuroLog(playerSlug: string, season: string = SEASON): Promise<BktEuroLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bsl_player_euro_log_v1")
    .select("*")
    .eq("bsl_player_slug", playerSlug)
    .eq("season_label", season)
    .order("game_date", { ascending: false })
    .returns<BktEuroLogRow[]>();
  if (error) {
    console.error("getBasketballPlayerEuroLog error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerMatchLog(playerSlug: string, season: string = SEASON): Promise<BktPlayerLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_match_log_v1")
    .select("*")
    .eq("season_label", season)
    .eq("player_slug", playerSlug)
    .order("match_date", { ascending: false })
    .limit(300)
    .returns<BktPlayerLogRow[]>();
  if (error) {
    console.error("getBasketballPlayerMatchLog error:", error.message);
    return [];
  }
  return data ?? [];
}
