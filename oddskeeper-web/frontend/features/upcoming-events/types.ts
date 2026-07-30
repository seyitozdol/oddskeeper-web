// analytics.upcoming_events_v1 satirlari (kaynak: tracker.upcoming_events,
// SofaScore'dan pipeline/src/common/fetch_upcoming_events.py ile beslenir).

export const TRACKED_SPORTS = ["football", "basketball", "volleyball"] as const;

export type TrackedSport = (typeof TRACKED_SPORTS)[number];

export type UpcomingEventRow = {
  event_id: number;
  sport: TrackedSport;
  category_name: string | null;
  tournament_name: string;
  season_name: string | null;
  round_info: string | null;
  home_team_id: number | null;
  home_team_name: string;
  home_team_country: string | null;
  home_team_national: boolean;
  away_team_id: number | null;
  away_team_name: string;
  away_team_country: string | null;
  away_team_national: boolean;
  gender: string | null;
  start_ts: string;
  status_type: string;
  status_desc: string | null;
  home_score: number | null;
  away_score: number | null;
  event_slug: string | null;
  updated_at: string;
  // tracker.event_odds_availability'den; null = henuz kontrol edilmedi
  bet365_has_odds: boolean | null;
  bet365_market_count: number;
  bets10_has_odds: boolean | null;
  bets10_market_count: number;
};
