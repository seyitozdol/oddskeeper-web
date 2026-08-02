// Basketbol dashboard tipleri — analytics.bb_* view'larının kolonlarını yansıtır.

export type BktTeamSeasonRow = {
  season_label: string;
  competition: string | null;
  team_slug: string;
  team_name: string;
  games: number;
  wins: number;
  losses: number;
  win_pct: number | null;
  ppg: number | null;
  oppg: number | null;
  point_diff: number | null;
  rpg: number | null;
  orpg: number | null;
  drpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
  fg_pct: number | null;
  fg2_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  efg_pct: number | null;
  pace: number | null;
  off_rtg: number | null;
  def_rtg: number | null;
  net_rtg: number | null;
  standings_rank: number;
};

export type BktPlayerSeasonRow = {
  season_label: string;
  competition: string | null;
  player_slug: string;
  player_name: string;
  team_slug: string | null;
  team_name: string | null;
  jersey_no: string | null;
  crest_url?: string | null;   // EL/EC drawer: CDN takım logosu (yerel slug yok)
  games: number;
  minutes_total: number | null;
  mpg: number | null;
  points_total: number | null;
  reb_total: number | null;
  assists_total: number | null;
  steals_total: number | null;
  blocks_total: number | null;
  turnovers_total: number | null;
  oreb_total: number | null;
  dreb_total: number | null;
  fg3m_total: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
  orpg: number | null;
  drpg: number | null;
  fg3m_pg: number | null;
  fg_pct: number | null;
  fg2_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  efg_pct: number | null;
  ts_pct: number | null;
  three_rate: number | null;
  ppm: number | null;
  pts_per36: number | null;
  reb_per36: number | null;
  ast_per36: number | null;
  usage_pct: number | null;
  pra_pg: number | null;
  pa_pg: number | null;
  pr_pg: number | null;
  position?: string | null;   // BSL: SofaScore ham pozisyon (G|GF|F|FC|C)
  height_cm?: number | null;  // BSL: SofaScore boy
  sofascore_player_id?: number | null;  // BSL: SofaScore kimlik → oyuncu fotografi
  image_url?: string | null;  // EL/EC: EuroLeague headshot (drawer/euro foto)
  role?: string | null;       // rol etiketi (starter|rotation|limited|garbage|departed)
};

export type BktLeaderboardRow = BktPlayerSeasonRow & {
  is_qualified: boolean;
  ppg_rank: number | null;
  rpg_rank: number | null;
  apg_rank: number | null;
  spg_rank: number | null;
  bpg_rank: number | null;
  fg3m_rank: number | null;
  ts_rank: number | null;
  usage_rank: number | null;
};

export type BktPlayerLogRow = {
  season_label: string;
  match_key: string;
  match_date: string;
  week: number | null;
  player_slug: string;
  player_name: string;
  team_slug: string | null;
  team_name: string | null;
  home_away: string | null;
  opponent_name: string | null;
  opponent_slug: string | null;
  minutes: number | null;
  points: number | null;
  fgm: number | null;
  fga: number | null;
  fg2m: number | null;
  fg2a: number | null;
  fg3m: number | null;
  fg3a: number | null;
  ftm: number | null;
  fta: number | null;
  oreb: number | null;
  dreb: number | null;
  treb: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  blocks_against: number | null;
  fouls_drawn: number | null;
  fouls_committed: number | null;
  pra: number | null;
  pa: number | null;
  pr: number | null;
  efg_pct: number | null;
  ts_pct: number | null;
};

export type BktMarketModelRow = {
  season_label: string;
  player_slug?: string;
  player_name?: string;
  team_slug: string | null;
  team_name: string | null;
  market_key: string;
  market_label: string;
  games: number;
  mean: number;
  std: number;
  max_val: number;
};

export type BktHomeAwaySplitRow = {
  team_slug: string;
  team_name: string;
  games: number;
  ppg: number;
  oppg: number;
  home_pf: number | null;
  home_pa: number | null;
  away_pf: number | null;
  away_pa: number | null;
  home_pf_std: number | null;
  away_pf_std: number | null;
  pf_std: number | null;
  crest_url?: string | null;   // EL/EC: CDN logo (BSL'de yok → yerel slug logosu)
};

export type BktTeamMetricFormRow = {
  team_slug: string;
  team_name: string;
  market_key: string;
  market_label: string;
  games: number;
  season_avg: number;
  last10_avg: number | null;
  std: number;
};

export type BktPlayerShareRow = {
  player_slug: string;
  player_name: string;
  team_slug: string;
  team_name: string;
  market_key: string;
  market_label: string;
  games: number;
  avg_minutes: number;
  total: number;
  per_game: number;
  std: number;
  team_total: number;
  share: number;
};

export type BktInputRow = {
  kind: "player" | "team";   // çıktı formatını belirler (player: participant kolonlu)
  fixtureExtId: string;
  template: string;
  participant: string;
  side: number;        // 1 home, 2 away
  line: number;
  over: number;
  under: number | null; // null = Under kapalı (Over-only)
  marketLabel: string;
  playerName: string;
  teamName: string;
};

export type BktEuroSeasonRow = {
  bsl_player_slug: string;
  competition: string;        // E | U
  competition_name: string;   // EuroLeague | EuroCup
  season_code: string;
  season_label: string;
  player_name: string;
  team_code: string | null;
  team_name: string | null;
  games: number;
  mpg: number | null;
  ppg: number | null;
  rpg: number | null;
  orpg: number | null;
  drpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
  fg3m_pg: number | null;
  val_pg: number | null;
  points_total: number | null;
  fg_pct: number | null;
  fg2_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  ts_pct: number | null;
  image_url: string | null;
};

export type BktEuroLogRow = {
  bsl_player_slug: string;
  competition: string;
  competition_name: string;
  season_code: string;
  season_label: string;
  game_code: number;
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

export type BktPlayerListRow = {
  player_slug: string;
  player_name: string;
  team_slug: string | null;
  team_name: string | null;
  games: number;
};

export type BktPlayerRoleRow = {
  season_label: string;
  team_slug: string;
  player_slug: string;
  player_name: string;
  position: string | null;
  games: number;
  avg_minutes: number;
  euro_team: boolean;
  role: string;   // starter | rotation | limited | garbage | departed
  sofascore_player_id?: number | null;  // BSL: oyuncu fotografi (Player Dist avatar)
  image_url?: string | null;            // EL/EC: EuroLeague headshot (Player Dist avatar)
};

export type BktPlayerWindowRow = {
  player_slug: string;
  player_name: string;
  team_slug: string;
  team_name: string;
  market_key: string;
  market_label: string;
  games: number;
  avg_minutes: number;
  season_avg: number;
  last5_avg: number | null;
  last10_avg: number | null;
  calc_std: number;
  total: number;
};

export type BktFixtureRow = {
  fixture_id: number;
  season_label: string | null;
  competition: string | null;
  week: number | null;
  match_text: string | null;
  home_team_slug: string | null;
  home_team_name: string | null;
  away_team_slug: string | null;
  away_team_name: string | null;
};

// Mac listesi (bb_games_v1) — hub Results sekmesi. Bir satir = bir mac (ev perspektifi).
export type BktGameRow = {
  season_label: string;
  competition: string | null;
  match_key: string;
  match_date: string | null;
  week: number | null;
  home_team_slug: string;
  home_team_name: string;
  away_team_slug: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

export type BktTeamLogRow = {
  season_label: string;
  match_key: string;
  match_date: string;
  week: number | null;
  team_slug: string;
  team_name: string;
  home_away: string | null;
  opponent_slug: string | null;
  opponent_name: string | null;
  points: number | null;
  opp_points: number | null;
  margin: number | null;
  result: "W" | "L" | "T" | null;
  fgm: number | null;
  fga: number | null;
  fg3m: number | null;
  fg3a: number | null;
  treb: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  possessions: number | null;
};
