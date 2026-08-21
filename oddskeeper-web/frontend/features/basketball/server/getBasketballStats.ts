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
  BktPlayerRoleRow,
  BktFixtureRow,
  BktGameRow,
  BktPlayerListRow,
  BktEuroSeasonRow,
  BktEuroLogRow,
} from "../types";

const SEASON = "2025-2026";
const PAGE_SIZE = 1000;

// P-5 select daraltma: kolon listeleri view + tip alanlariyla dogrulandi (2026-08-21).
const TEAM_STANDINGS_COLS =
  "season_label,competition,team_slug,team_name,games,wins,losses,win_pct,ppg,oppg,point_diff,rpg,orpg,drpg,apg,spg,bpg,topg,fg_pct,fg2_pct,fg3_pct,ft_pct,efg_pct,pace,off_rtg,def_rtg,net_rtg,standings_rank";
const PLAYER_SEASON_COLS =
  "season_label,competition,player_slug,player_name,team_slug,team_name,jersey_no,games,minutes_total,mpg,points_total,reb_total,assists_total,steals_total,blocks_total,turnovers_total,oreb_total,dreb_total,fg3m_total,ppg,rpg,apg,spg,bpg,topg,orpg,drpg,fg3m_pg,fg_pct,fg2_pct,fg3_pct,ft_pct,efg_pct,ts_pct,three_rate,ppm,pts_per36,reb_per36,ast_per36,usage_pct,pra_pg,pa_pg,pr_pg,position,height_cm,sofascore_player_id,role,country_code,country_code2";
const TEAM_LOG_COLS =
  "season_label,match_key,match_date,week,team_slug,team_name,home_away,opponent_slug,opponent_name,points,opp_points,margin,result,fgm,fga,fg2m,fg2a,fg3m,fg3a,ftm,fta,oreb,dreb,treb,assists,turnovers,steals,blocks,possessions";

export async function getBasketballStandings(season: string = SEASON): Promise<BktTeamSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_standings_v1")
    .select(TEAM_STANDINGS_COLS)
    .eq("season_label", season)
    .order("standings_rank", { ascending: true })
    .returns<BktTeamSeasonRow[]>();
  if (error) {
    console.error("getBasketballStandings error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerLeaderboard(season: string = SEASON): Promise<BktLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_leaderboard_v1")
    .select(`${PLAYER_SEASON_COLS},is_qualified,ppg_rank,rpg_rank,apg_rank,spg_rank,bpg_rank,fg3m_rank,ts_rank,usage_rank`)
    .eq("season_label", season)
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
    .select("season_label,team_slug,team_name,market_key,market_label,games,mean,std,max_val")
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
export async function getBasketballHomeAwaySplits(season: string = SEASON): Promise<BktHomeAwaySplitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_home_away_split_v1")
    .select("team_slug,team_name,games,ppg,oppg,home_pf,home_pa,away_pf,away_pa,home_pf_std,away_pf_std,pf_std")
    .eq("season_label", season)
    .returns<BktHomeAwaySplitRow[]>();
  if (error) {
    console.error("getBasketballHomeAwaySplits error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballTeamMetricForms(season: string = SEASON): Promise<BktTeamMetricFormRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_team_metric_form_v1")
    .select("team_slug,team_name,market_key,market_label,games,season_avg,last10_avg,std")
    .eq("season_label", season)
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
      .select("player_slug,player_name,team_slug,team_name,market_key,market_label,games,avg_minutes,total,per_game,std,team_total,share")
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

export async function getBasketballPlayerWindows(season: string = SEASON): Promise<BktPlayerWindowRow[]> {
  const supabase = await createClient();
  const rows: BktPlayerWindowRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_player_metric_window_v1")
      .select("player_slug,player_name,team_slug,team_name,market_key,market_label,games,avg_minutes,season_avg,last5_avg,last10_avg,calc_std,total")
      .eq("season_label", season)
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

export async function getBasketballPlayerRoles(season: string = SEASON): Promise<BktPlayerRoleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_role_v1")
    .select("season_label,team_slug,player_slug,player_name,position,games,avg_minutes,euro_team,role,sofascore_player_id")
    .eq("season_label", season)
    .returns<BktPlayerRoleRow[]>();
  if (error) {
    console.error("getBasketballPlayerRoles error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerList(season: string = SEASON): Promise<BktPlayerListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("player_slug,player_name,team_slug,team_name,games")
    .eq("season_label", season)
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
    .select("fixture_id,season_label,competition,week,match_text,home_team_slug,home_team_name,away_team_slug,away_team_name")
    .order("fixture_id", { ascending: true })
    .returns<BktFixtureRow[]>();
  if (error) {
    console.error("getBasketballFixtures error:", error.message);
    return [];
  }
  // yalnız iki takımı dolu olanlar (Excel Fixture'da boş satırlar var)
  return (data ?? []).filter((f) => f.home_team_slug && f.away_team_slug);
}

// Mac-seviyesi liste (bir satir = bir mac). Hub Results sekmesi.
// BSL tarihleri birkac macta bozuk → week desc birincil sira (playoff turlari ustte).
export async function getBasketballGames(season: string = SEASON): Promise<BktGameRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_games_v1")
    .select("season_label,competition,match_key,match_date,week,home_team_slug,home_team_name,away_team_slug,away_team_name,home_score,away_score")
    .eq("season_label", season)
    .order("week", { ascending: false })
    .order("match_date", { ascending: false })
    .returns<BktGameRow[]>();
  if (error) {
    console.error("getBasketballGames error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballAllTeamMatchLogs(season: string = SEASON): Promise<BktTeamLogRow[]> {
  const supabase = await createClient();
  const rows: BktTeamLogRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_team_match_log_v1")
      .select(TEAM_LOG_COLS)
      .eq("season_label", season)
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
    .from("bb_team_standings_v1")
    .select(TEAM_STANDINGS_COLS)
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
    .select(PLAYER_SEASON_COLS)
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
    .select(TEAM_LOG_COLS)
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
    .select(PLAYER_SEASON_COLS)
    .eq("season_label", season)
    .eq("player_slug", playerSlug)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("getBasketballPlayer error:", error.message);
    return null;
  }
  return data ?? null;
}

// Sezondan bağımsız oyuncu kimliği (isim/takım/pozisyon/ülke/foto). Seçili sezonda
// verisi olmayan oyuncuda boş şablon başlığını doldurmak için (en yeni sezon satırı).
export async function getBasketballPlayerAny(playerSlug: string): Promise<BktPlayerSeasonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select(PLAYER_SEASON_COLS)
    .eq("player_slug", playerSlug)
    .order("season_label", { ascending: false })
    .limit(1)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("getBasketballPlayerAny error:", error.message);
    return null;
  }
  return data ?? null;
}

export async function getBasketballPlayerModel(playerSlug: string): Promise<BktMarketModelRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_market_model_v1")
    .select("season_label,player_slug,player_name,team_slug,team_name,market_key,market_label,games,mean,std,max_val")
    .eq("season_label", SEASON)
    .eq("player_slug", playerSlug)
    .returns<BktMarketModelRow[]>();
  if (error) {
    console.error("getBasketballPlayerModel error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballPlayerEuroSeasons(playerSlug: string, season: string = SEASON): Promise<BktEuroSeasonRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bsl_player_euro_seasons_v1")
    .select("bsl_player_slug,competition,competition_name,season_code,season_label,player_name,team_code,team_name,games,mpg,ppg,rpg,orpg,drpg,apg,spg,bpg,topg,fg3m_pg,val_pg,points_total,fg_pct,fg2_pct,fg3_pct,ft_pct,ts_pct,image_url")
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
    .select("bsl_player_slug,competition,competition_name,season_code,season_label,game_code,round,phase_code,game_date,team_code,team_name,home_away,opponent_code,opponent_name,minutes,points,fg3m,treb,assists,steals,blocks,valuation,plus_minus,crest_url")
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
    .select("season_label,match_key,match_date,week,player_slug,player_name,team_slug,team_name,home_away,opponent_name,opponent_slug,minutes,points,fgm,fga,fg2m,fg2a,fg3m,fg3a,ftm,fta,oreb,dreb,treb,assists,turnovers,steals,blocks,blocks_against,fouls_drawn,fouls_committed,pra,pa,pr,efg_pct,ts_pct")
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
