import { VALID_MATCH_TABS } from "./constants";

export type ValidMatchTab = (typeof VALID_MATCH_TABS)[number];

export type MatchProfileRow = {
  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;
  match_date_text: string | null;
  venue: string | null;
  home_team_source_id: string | null;
  home_team_name: string | null;
  home_team_slug: string | null;
  away_team_source_id: string | null;
  away_team_name: string | null;
  away_team_slug: string | null;
  home_score: number | null;
  away_score: number | null;
  score_display: string | null;
};

export type MatchIncidentRow = {
  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;
  side: string | null;
  event_type_code: string | null;
  event_title: string | null;
  minute_text: string | null;
  minute_sort: number | null;
  primary_player_text: string | null;
  secondary_player_text: string | null;
  raw_text: string | null;
};

export type MatchTeamStatsRow = {
  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;

  team_side: string | null;
  team_slug: string | null;
  source_team_id: string | null;
  team_name: string | null;

  opponent_team_slug: string | null;
  opponent_team_source_id: string | null;
  opponent_team_name: string | null;

  score_for: number | null;
  score_against: number | null;
  result_code: string | null;

  summary_goals: number | null;
  summary_assists: number | null;
  summary_red_cards: number | null;
  summary_yellow_cards: number | null;
  summary_corners_won: number | null;
  summary_shots: number | null;
  summary_shots_on_target: number | null;
  summary_blocked_shots: number | null;
  summary_passes: number | null;
  summary_crosses: number | null;
  summary_tackles: number | null;
  summary_offsides: number | null;
  summary_fouls_conceded: number | null;
  summary_fouls_won: number | null;
  summary_saves: number | null;

  details_accurate_pass: number | null;
  details_attempts_ibox: number | null;
  details_attempts_obox: number | null;
  details_expected_goals: number | string | null;
};
export type MatchParticipantRow = {
  source_match_id: string;
  competition: string | null;
  match_datetime: string | null;

  team_side: string | null;
  team_slug: string | null;
  source_team_id: string | null;
  team_name: string | null;

  player_source_id: string;
  player_name: string;
  player_slug: string | null;

  lineup_status: string | null;
  position_code: string | null;

  minutes_played: number | null;
  goals: number | null;
  assists: number | null;
  cards_yellow: number | null;
  cards_red: number | null;
  shots_on_target: number | null;
  saves_total: number | null;
};