// EuroLeague/EuroCup frontend tipleri — analytics.el_* view kolonlarini yansitir.

export type EuroTeamRow = {
  competition: string;
  season_code: string;
  season_label: string;
  team_code: string;
  team_name: string;
  games: number;
  wins: number;
  losses: number;
  win_pct: number | null;
  ppg: number | null;
  oppg: number | null;
  point_diff: number | null;
  rpg: number | null;
  apg: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  efg_pct: number | null;
  pace: number | null;
  off_rtg: number | null;
  def_rtg: number | null;
  net_rtg: number | null;
  standings_rank: number;
  crest_url?: string | null;
  bsl_team_slug?: string | null;
  bsl_team_name?: string | null;
};

export type EuroLeaderRow = {
  competition: string;
  season_code: string;
  season_label: string;
  person_code: string;
  player_name: string;
  team_code: string | null;
  team_name: string | null;
  bsl_team_name: string | null;
  bsl_player_slug: string | null;
  games: number;
  mpg: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
  fg3m_pg: number | null;
  val_pg: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  ts_pct: number | null;
  is_qualified: boolean;
  image_url: string | null;
  position?: string | null;   // EuroLeague API: Guard/Forward/Center
  height_cm?: number | null;
  role?: string | null;       // rol etiketi (starter|rotation|limited|garbage|departed)
  crest_url?: string | null;  // takım logosu (euroleague.teams) — Player Leaders
};

export type EuroPlayerLogRow = {
  competition: string;
  competition_name: string;
  season_code: string;
  season_label: string;
  person_code: string;
  game_code: number;
  identifier: string | null;
  round: number | null;
  phase_code: string | null;
  game_date: string | null;
  team_code: string | null;
  team_name: string | null;
  home_away: string | null;
  opponent_code: string | null;
  opponent_name: string | null;
  minutes: number | null;
  points: number | null;
  fg3m: number | null;
  treb: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  valuation: number | null;
  plus_minus: number | null;
  crest_url: string | null;
};

// Mac listesi (el_games_v1) — hub Fixtures/Results sekmeleri. Bir satir = bir mac.
export type EuroGameRow = {
  competition: string;
  competition_name: string;
  season_code: string;
  season_label: string;
  game_code: number;
  round: number | null;
  phase_code: string | null;
  phase_name: string | null;
  game_date: string | null;
  played: boolean;
  phase_order: number;
  home_team_code: string;
  home_team_name: string | null;
  home_crest: string | null;
  home_bsl_slug: string | null;
  away_team_code: string;
  away_team_name: string | null;
  away_crest: string | null;
  away_bsl_slug: string | null;
  home_score: number | null;
  away_score: number | null;
};

export type EuroTeamLogRow = {
  competition: string;
  season_code: string;
  season_label: string;
  game_code: number;
  round: number | null;
  phase_code: string | null;
  game_date: string | null;
  team_code: string;
  team_name: string | null;
  home_away: string | null;
  opponent_code: string | null;
  opponent_name: string | null;
  points: number | null;
  opp_points: number | null;
  result: "W" | "L" | "T" | null;
};
