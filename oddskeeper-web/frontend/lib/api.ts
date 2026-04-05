export type MatchDetail = {
  id: number;
  source: string;
  source_match_id: string;
  created_at: string;

  match_summary_status: string | null;
  opta_points_status: string | null;
  match_details_status: string | null;

  overall_status: string | null;
  match_details_page_status:
    | {
        reason: string;
        status: string;
        body_excerpt: string;
        matched_text: string;
      }
    | null;
  match_summary_page_status:
    | {
        reason: string;
        status: string;
        body_excerpt: string;
        matched_text: string;
      }
    | null;

  home_team: string | null;
  away_team: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  score: string | null;

  referee: string | null;
  venue: string | null;
  competition: string | null;
  match_date_text: string | null;
  attendance_text: string | null;
  match_url: string | null;

  winner_side: string | null;
  winner_team_source_id: string | null;

  details_sections_count: number;
  player_stats_sections_count: number;
  opta_points_stats_keys: string[];
};
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function getHealthStatus() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL tanımlı değil");
  }

  const response = await fetch(`${API_BASE_URL}/health`);
  const data = await response.json();
  return data;
}

export async function getStagingPreview(): Promise<MatchRow[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL tanımlı değil");
  }

  const response = await fetch(`${API_BASE_URL}/staging-preview`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Veri alınamadı");
  }

  return data.rows || [];
}

export type MatchDetail = {
  id: number;
  source: string;
  source_match_id: string;
  created_at: string;
  home_team: string | null;
  away_team: string | null;
  score: string | null;
  referee: string | null;
  venue: string | null;
  match_url: string | null;
  competition: string | null;
  season_label: string | null;
};

export async function getStagingMatchDetail(matchId: number): Promise<MatchDetail> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL tanımlı değil");
  }

  const response = await fetch(`${API_BASE_URL}/staging-match/${matchId}`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Maç detayı alınamadı");
  }

  return data.match;
}