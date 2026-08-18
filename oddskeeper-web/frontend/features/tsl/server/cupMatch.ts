import { createClient } from "../../../lib/supabase/server";
import { toNum } from "../lib";
import type { TslMatchDetail, TslMatchPlayer } from "./match";

// Avrupa kupasi mac detayi: match info eurocup_stage_matches_v1'den, oyuncular
// eurocup_player_match_log_v1'den (tff1 sekli); grafikler getMatchMarketBars ile
// (match_team_stats_v1, competition-agnostik) TSL sablonu birebir yeniden kullanir.

export async function getCupMatch(matchId: string): Promise<TslMatchDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("eurocup_stage_matches_v1")
    .select(
      "match_id, competition, season_label, match_datetime, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score"
    )
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;

  const homeId = String(data.home_team_id);
  const awayId = String(data.away_team_id);
  const { data: logos } = await supabase
    .schema("analytics")
    .from("tff1_team_logos_v1")
    .select("team_id, logo_url")
    .in("team_id", [homeId, awayId]);
  const logoMap = new Map<string, string | null>();
  for (const l of logos ?? []) logoMap.set(String(l.team_id), l.logo_url ?? null);

  return {
    matchId: String(data.match_id),
    season: data.season_label,
    competition: data.competition,
    datetime: data.match_datetime,
    homeId,
    awayId,
    homeName: data.home_team_name ?? homeId,
    awayName: data.away_team_name ?? awayId,
    homeLogo: logoMap.get(homeId) ?? null,
    awayLogo: logoMap.get(awayId) ?? null,
    homeScore: toNum(data.home_score),
    awayScore: toNum(data.away_score),
  };
}

export async function getCupMatchPlayers(matchId: string): Promise<TslMatchPlayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("eurocup_player_match_log_v1")
    .select(
      "player_id, player_name, team_id, position_code, lineup_status, minutes, rating, goals, assists, shots, shots_on_target, key_passes, total_passes, tackles, fouls, saves"
    )
    .eq("match_id", matchId)
    .limit(60);
  if (error || !data) return [];
  return data.map((r) => ({
    playerId: String(r.player_id),
    playerName: r.player_name ?? "—",
    teamId: String(r.team_id),
    positionCode: r.position_code ?? null,
    lineupStatus: r.lineup_status ?? null,
    minutes: toNum(r.minutes),
    rating: toNum(r.rating),
    goals: toNum(r.goals),
    assists: toNum(r.assists),
    shots: toNum(r.shots),
    shotsOnTarget: toNum(r.shots_on_target),
    keyPasses: toNum(r.key_passes),
    totalPasses: toNum(r.total_passes),
    tackles: toNum(r.tackles),
    fouls: toNum(r.fouls),
    saves: toNum(r.saves),
  }));
}
