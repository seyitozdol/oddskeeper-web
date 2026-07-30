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
  // Server tarafında zenginleştirilir: takım detay sayfası linki (yoksa null).
  // Süper Lig -> stats-analysis detay; 1. Lig -> tff-1-lig/team/<id>.
  home_team_href: string | null;
  away_team_href: string | null;
  // tracker.event_odds_availability'den.
  //   has_odds null           -> henuz kontrol edilmedi
  //   has_odds true           -> oran yakalandi
  //   has_odds false + listed -> mac sitede goruldu, oran yakalanamadi
  bet365_has_odds: boolean | null;
  bet365_market_count: number;
  bet365_listed: boolean;
  bets10_has_odds: boolean | null;
  bets10_market_count: number;
  bets10_listed: boolean;
  oddsportal_has_odds: boolean | null;
  oddsportal_market_count: number;
  oddsportal_listed: boolean;
};
