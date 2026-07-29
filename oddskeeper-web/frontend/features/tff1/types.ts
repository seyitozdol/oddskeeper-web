// TFF 1. Lig (SofaScore) sezon istatistik satirlari.
// Kaynak view'lar: analytics.tff1_player_season_stats_v1 / tff1_team_season_stats_v1

export type Tff1PlayerRow = {
  season_label: string;
  player_id: string;
  player_name: string | null;
  team_name: string | null;
  team_id: string | null;
  teams: string | null;
  position_code: string | null;
  appearances: number | null;
  starts: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  own_goals: number | null;
  shots: number | null;
  shots_on_target: number | null;
  big_chances_missed: number | null;
  hit_woodwork: number | null;
  total_passes: number | null;
  accurate_passes: number | null;
  pass_accuracy: number | null;
  key_passes: number | null;
  big_chances_created: number | null;
  crosses: number | null;
  accurate_crosses: number | null;
  long_balls: number | null;
  accurate_long_balls: number | null;
  tackles: number | null;
  tackles_won: number | null;
  interceptions: number | null;
  clearances: number | null;
  blocks: number | null;
  ball_recoveries: number | null;
  duels_won: number | null;
  duels_lost: number | null;
  aerials_won: number | null;
  aerials_lost: number | null;
  fouls: number | null;
  was_fouled: number | null;
  offsides: number | null;
  dispossessed: number | null;
  possession_lost: number | null;
  dribbles_won: number | null;
  dribbles_attempted: number | null;
  touches: number | null;
  saves: number | null;
  penalties_saved: number | null;
  errors_leading_to_shot: number | null;
  errors_leading_to_goal: number | null;
  rating_avg: number | null;
  km_covered: number | null;
  sprints: number | null;
  top_speed: number | null;
  // FlashScore kaynakli (2025/26'dan itibaren; eski sezonlarda null)
  xg: number | null;
  xgot: number | null;
  xa: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  fs_position: string | null;
};

export type Tff1MatchRow = {
  season_label: string;
  match_id: string;
  competition: string;
  match_datetime: string | null;
  home_team_id: string | null;
  home_team_name: string | null;
  away_team_id: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

// Mac bazli oyuncu logu (analytics.tff1_player_match_log_mat).
// source='sofascore' TUM ligleri icerir (kume dusen kulup oyunculari icin
// Super Lig satirlari da gelir); competition kolonuyla ayirt edilir.
export type Tff1MatchLogRow = {
  season_label: string;
  competition: string;
  match_id: string;
  match_datetime: string | null;
  player_id: string;
  player_name: string | null;
  team_id: string | null;
  team_name: string | null;
  opponent_id: string | null;
  opponent_name: string | null;
  is_home: boolean | null;
  home_score: number | null;
  away_score: number | null;
  lineup_status: string | null;
  position_code: string | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  total_passes: number | null;
  accurate_passes: number | null;
  key_passes: number | null;
  crosses: number | null;
  accurate_crosses: number | null;
  long_balls: number | null;
  accurate_long_balls: number | null;
  tackles: number | null;
  tackles_won: number | null;
  interceptions: number | null;
  clearances: number | null;
  blocks: number | null;
  ball_recoveries: number | null;
  duels_won: number | null;
  duels_lost: number | null;
  aerials_won: number | null;
  aerials_lost: number | null;
  fouls: number | null;
  was_fouled: number | null;
  offsides: number | null;
  dispossessed: number | null;
  possession_lost: number | null;
  dribbles_won: number | null;
  dribbles_attempted: number | null;
  touches: number | null;
  saves: number | null;
  penalties_saved: number | null;
  km_covered: number | null;
  sprints: number | null;
  top_speed: number | null;
};

// Yaklasan fikstur (analytics.tff1_fixtures_v1; football.fixtures source='sofascore')
export type Tff1FixtureRow = {
  fixture_id: number;
  season_label: string;
  competition: string;
  round_number: number | null;
  fixture_date: string | null;
  fixture_datetime: string | null;
  home_team_id: string | null;
  home_team_name: string | null;
  away_team_id: string | null;
  away_team_name: string | null;
  fixture_status: string | null;
};

export type Tff1PlayerInfo = {
  player_id: string;
  birth_date: string | null;
  height_cm: number | null;
  country: string | null;
  photo_url: string | null;
};

export type Tff1TeamLogo = {
  team_id: string;
  logo_url: string | null;
};

export type Tff1MarketValue = {
  player_id: string;
  market_value_eur: number | null;
  tm_club: string | null;
};

export type Tff1TeamRow = {
  season_label: string;
  team_id: string;
  team_name: string | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_diff: number | null;
  points: number | null;
  clean_sheets: number | null;
  win_pct: number | null;
  shots: number | null;
  shots_on_target: number | null;
  total_passes: number | null;
  accurate_passes: number | null;
  pass_accuracy: number | null;
  key_passes: number | null;
  big_chances_created: number | null;
  tackles: number | null;
  interceptions: number | null;
  fouls: number | null;
  rating_avg: number | null;
  km_per_match: number | null;
};
