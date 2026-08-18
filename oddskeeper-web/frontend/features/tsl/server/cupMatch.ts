import { createClient } from "../../../lib/supabase/server";
import { toNum } from "../lib";
import type { TslMatchDetail, TslMatchPlayer } from "./match";
import type { ShowcaseVsRow } from "../../../components/showcase/ShowcaseCharts";

// Avrupa kupasi mac detayi: match info eurocup_stage_matches_v1'den, oyuncular
// eurocup_player_match_log_v1'den (SofaScore); SofaScore o mac icin stat vermezse
// (on eleme: kadro var stat yok) eurocup_fs_player_match_log_v1'e (FlashScore)
// duser. Grafikler getCupMatchBars ile (eurocup_team_bars_v1, SofaScore -> FlashScore
// fallback). TSL sablonunu birebir yeniden kullanir.

const PLAYER_COLS =
  "player_id, player_name, team_id, position_code, lineup_status, minutes, rating, goals, assists, shots, shots_on_target, key_passes, total_passes, tackles, fouls, saves";

type PlayerRaw = {
  player_id: string | number;
  player_name: string | null;
  team_id: string | number;
  position_code: string | null;
  lineup_status: string | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  key_passes: number | null;
  total_passes: number | null;
  tackles: number | null;
  fouls: number | null;
  saves: number | null;
  is_home?: boolean | null;
};

// FS branch'te team_id FlashScore takim id'sidir (SofaScore'dan farkli); is_home ile
// mac'in ev/deplasman SofaScore takim id'sine eslenir ki mac detayi oyuncuyu dogru
// tarafa koysun. SofaScore branch'te is_home yok -> team_id zaten dogru.
function mapPlayer(
  r: PlayerRaw,
  homeId: string | null,
  awayId: string | null
): TslMatchPlayer {
  const teamId =
    r.is_home != null && homeId && awayId
      ? r.is_home
        ? homeId
        : awayId
      : String(r.team_id);
  return {
    playerId: String(r.player_id),
    playerName: r.player_name ?? "—",
    teamId,
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
  };
}

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

export async function getCupMatchPlayers(
  matchId: string,
  homeId?: string,
  awayId?: string
): Promise<TslMatchPlayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("eurocup_player_match_log_v1")
    .select(PLAYER_COLS)
    .eq("match_id", matchId)
    .limit(60);
  if (error) return [];
  const rows = (data ?? []) as PlayerRaw[];
  const hasReal = rows.some((r) => (toNum(r.minutes) ?? 0) > 0 || r.rating != null);
  // SofaScore gercek stat verdiyse onu kullan. Vermediyse (kadro var stat yok) ve
  // ev/deplasman id'leri elde varsa FlashScore fallback'ini dene.
  if (hasReal || !homeId || !awayId) {
    return rows.map((r) => mapPlayer(r, homeId ?? null, awayId ?? null));
  }
  const { data: fs } = await supabase
    .schema("analytics")
    .from("eurocup_fs_player_match_log_v1")
    .select(`${PLAYER_COLS}, is_home`)
    .eq("match_id", matchId)
    .limit(60);
  const fsRows = (fs ?? []) as PlayerRaw[];
  if (fsRows.length === 0) {
    return rows.map((r) => mapPlayer(r, homeId, awayId)); // FS de yok -> SofaScore kadrosu
  }
  return fsRows.map((r) => mapPlayer(r, homeId, awayId));
}

// Mac-detay 10 takim marketi (Shot/SOT/Corner/Saves/Tackle/Taç/Goal Kick/Foul/
// Card/Offside). eurocup_team_bars_v1 SofaScore -> FlashScore fallback yapar.
// Veri yoksa (ne SofaScore ne FS) bos dizi -> grafik gizlenir.
export async function getCupMatchBars(
  matchId: string,
  tr: boolean
): Promise<ShowcaseVsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("analytics")
    .from("eurocup_team_bars_v1")
    .select(
      "home_shots, away_shots, home_sot, away_sot, home_corners, away_corners, home_saves, away_saves, home_tackles, away_tackles, home_throws, away_throws, home_goal_kicks, away_goal_kicks, home_fouls, away_fouls, home_cards, away_cards, home_offsides, away_offsides"
    )
    .eq("match_id", matchId)
    .maybeSingle();
  if (!data) return [];

  const n = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  const defs: {
    key: string;
    tr: string;
    en: string;
    home: unknown;
    away: unknown;
  }[] = [
    { key: "shots", tr: "Şut", en: "Shots", home: data.home_shots, away: data.away_shots },
    { key: "sot", tr: "İsabetli şut", en: "On target", home: data.home_sot, away: data.away_sot },
    { key: "corners", tr: "Korner", en: "Corners", home: data.home_corners, away: data.away_corners },
    { key: "saves", tr: "Kurtarış", en: "Saves", home: data.home_saves, away: data.away_saves },
    { key: "tackles", tr: "Müdahale", en: "Tackles", home: data.home_tackles, away: data.away_tackles },
    { key: "throws", tr: "Taç", en: "Throw-ins", home: data.home_throws, away: data.away_throws },
    { key: "goalKicks", tr: "Kale vuruşu", en: "Goal kicks", home: data.home_goal_kicks, away: data.away_goal_kicks },
    { key: "fouls", tr: "Faul", en: "Fouls", home: data.home_fouls, away: data.away_fouls },
    { key: "cards", tr: "Kart", en: "Cards", home: data.home_cards, away: data.away_cards },
    { key: "offsides", tr: "Ofsayt", en: "Offsides", home: data.home_offsides, away: data.away_offsides },
  ];

  return defs.map((d) => ({
    key: d.key,
    label: tr ? d.tr : d.en,
    home: n(d.home),
    away: n(d.away),
    digits: 0,
  }));
}
