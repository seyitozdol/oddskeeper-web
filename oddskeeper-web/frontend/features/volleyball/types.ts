// Voleybol veri tipleri (analytics.vb_* view'lari).

export type VbCompetition = {
  competition_id: number;
  comp_slug: string;
  year: number;
  gender: string;
  name: string | null;
  short_label: string;
  sort_key: number;
};

export type VbLeaderboardRow = {
  competition_id: number;
  fivb_id: number;
  short_name: string | null;
  full_name: string | null;
  team_code: string | null;
  position: string | null;
  shirt_number: number | null;
  nationality: string | null;
  height_cm: number | null;
  birth_date: string | null;
  sofascore_player_id: number | null;
  points: number | null;
  attack_points: number | null;
  block_points: number | null;
  serve_points: number | null;
  scorer_rank: number | null;
  atk_total: number | null;
  atk_success: number | null;
  atk_rank: number | null;
  blk_blocks: number | null;
  blk_eff: number | null;
  blk_rank: number | null;
  srv_aces: number | null;
  srv_success: number | null;
  srv_rank: number | null;
  set_successful: number | null;
  set_rank: number | null;
  dig_digs: number | null;
  dig_rank: number | null;
  rec_successful: number | null;
  rec_success: number | null;
  rec_rank: number | null;
};

export type VbSetScore = { a: number; b: number };

export type VbMatch = {
  competition_id: number;
  match_no: number;
  match_date: string | null;
  home_code: string | null;
  away_code: string | null;
  home_name: string | null;
  away_name: string | null;
  home_sets: number | null;
  away_sets: number | null;
  set_scores: VbSetScore[] | null;
  status: string | null;
};

export type VbFixture = {
  id: number;
  competition_name: string;
  stage: string | null;
  match_date: string | null;
  match_time: string | null;
  home_code: string | null;
  away_code: string | null;
  home_name: string | null;
  away_name: string | null;
  venue: string | null;
  status: string | null;
};

export type VbPlayerBio = {
  fivb_id: number;
  full_name: string | null;
  short_name: string | null;
  position: string | null;
  birth_date: string | null;
  height_cm: number | null;
  nationality: string | null;
  sofascore_player_id: number | null;
};

export type VbPlayerMatch = {
  competition_id: number;
  fivb_id: number;
  match_date: string | null;
  home_team: string | null;
  away_team: string | null;
  category: string;
  // kategoriye gore anahtarlar: scoring {points,attack_points,block_points,serve_points},
  // attack/serve/reception/set {points|successful,errors,attempts,avg,success,total}, vb.
  data: Record<string, number | null> | null;
};
