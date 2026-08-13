// Sistemde olmayan kupa takım/oyuncuları için profil sayfası loader'ları.
// (Eşleşen 18 takım / 523 oyuncu mevcut football profillerine gider; burası
// alt lig/amatör entity'ler için.) Veri: analytics.cup_* view'ları.
import { createClient } from "../../../lib/supabase/server";
import { getAllFootballTeamLogos } from "../../../lib/football-teams";
import { toNum } from "../lib";
import { cupPlayerPhoto, cupTeamLogo } from "./cupdata";

const CDN_TEAM = (uuid: string | null) => cupTeamLogo(uuid);

export type CupTeamResult = {
  matchId: string;
  datetime: string | null;
  roundName: string | null;
  isHome: boolean;
  oppName: string;
  oppLogo: string | null;
  gf: number | null;
  ga: number | null;
};
export type CupTeamStat = { key: string; label: string; total: number | null; perMatch: number | null; rank: number | null };
export type CupSquadMember = { playerId: string; name: string; photo: string | null; href: string; apps: number | null; rating: number | null };
export type CupTeamProfile = {
  teamId: string;
  name: string;
  logo: string | null;
  inSystem: boolean;
  seasons: { season: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }[];
  results: CupTeamResult[];
  stats: CupTeamStat[];
  squad: CupSquadMember[];
};

const TEAM_STAT_LABEL: Record<string, string> = {
  possession: "Topa Sahip Olma", expected_goals: "xG", shots: "Şut", shots_on_target: "İsabetli Şut",
  corners: "Korner", passes: "Pas", passing_accuracy: "Pas İsabeti", throw_in: "Taç", fouls: "Faul",
  total_offside: "Ofsayt",
};

export async function loadCupTeamProfile(teamId: string): Promise<CupTeamProfile | null> {
  const sb = await createClient();
  const [{ data: meta }, localLogos] = await Promise.all([
    sb.schema("analytics").from("cup_team_meta_v1").select("team_id, team_uuid, team_name, team_slug").eq("team_id", teamId).maybeSingle(),
    getAllFootballTeamLogos(),
  ]);
  if (!meta) return null;
  const slug = meta.team_slug as string | null;
  const logo = (slug ? localLogos[slug] : null) ?? CDN_TEAM(meta.team_uuid as string | null);

  const [{ data: matchRows }, { data: standRows }, { data: statRows }, { data: squadRows }] = await Promise.all([
    sb.schema("analytics").from("cup_matches_v1")
      .select("match_id, match_datetime, round_name, home_team_id, home_team_name, home_team_uuid, home_team_slug, away_team_id, away_team_name, away_team_uuid, away_team_slug, home_score, away_score")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("match_datetime", { ascending: false }).limit(60),
    sb.schema("analytics").from("cup_standings_v1").select("*").eq("team_id", teamId),
    sb.schema("analytics").from("cup_team_metrics_v1")
      .select("stat_type, total_value, per_match_value, season_label").eq("team_id", teamId).in("stat_type", Object.keys(TEAM_STAT_LABEL)),
    sb.schema("analytics").from("cup_player_stats_v1")
      .select("player_id, player_uuid, player_name, apps, avg_rating, main_team_id, season_label").eq("main_team_id", teamId).order("apps", { ascending: false }).limit(120),
  ]);

  const results: CupTeamResult[] = (matchRows ?? []).map((r) => {
    const home = String(r.home_team_id) === String(teamId);
    return {
      matchId: String(r.match_id), datetime: (r.match_datetime as string) ?? null, roundName: (r.round_name as string) ?? null,
      isHome: home,
      oppName: (home ? r.away_team_name : r.home_team_name) as string ?? "—",
      oppLogo: home
        ? (r.away_team_slug ? localLogos[r.away_team_slug as string] ?? null : null) ?? CDN_TEAM(r.away_team_uuid as string | null)
        : (r.home_team_slug ? localLogos[r.home_team_slug as string] ?? null : null) ?? CDN_TEAM(r.home_team_uuid as string | null),
      gf: home ? toNum(r.home_score) : toNum(r.away_score),
      ga: home ? toNum(r.away_score) : toNum(r.home_score),
    };
  });

  const seasons = (standRows ?? []).map((r) => ({
    season: r.season_label as string, played: toNum(r.played) ?? 0, wins: toNum(r.wins) ?? 0,
    draws: toNum(r.draws) ?? 0, losses: toNum(r.losses) ?? 0, goalsFor: toNum(r.goals_for) ?? 0, goalsAgainst: toNum(r.goals_against) ?? 0,
  })).sort((a, b) => b.season.localeCompare(a.season));

  // Stats: en yeni sezonu göster.
  const latestSeason = seasons[0]?.season;
  const stats: CupTeamStat[] = (statRows ?? [])
    .filter((r) => !latestSeason || r.season_label === latestSeason)
    .map((r) => ({
      key: r.stat_type as string, label: TEAM_STAT_LABEL[r.stat_type as string] ?? (r.stat_type as string),
      total: toNum(r.total_value), perMatch: toNum(r.per_match_value), rank: null,
    }));

  // Oyuncu sezon-başına gelir; player_id ile birleştir (maç topla, en iyi reyting).
  const squadMap = new Map<string, CupSquadMember>();
  for (const r of squadRows ?? []) {
    const pid = String(r.player_id);
    const apps = toNum(r.apps) ?? 0;
    const rating = toNum(r.avg_rating);
    const cur = squadMap.get(pid);
    if (!cur) {
      squadMap.set(pid, {
        playerId: pid, name: (r.player_name as string) ?? "—", photo: cupPlayerPhoto(r.player_uuid as string | null),
        href: `/dashboard/cup/player/${encodeURIComponent(pid)}`, apps, rating,
      });
    } else {
      cur.apps = (cur.apps ?? 0) + apps;
      if (rating != null && (cur.rating == null || rating > cur.rating)) cur.rating = rating;
    }
  }
  const squad = [...squadMap.values()].sort((a, b) => (b.apps ?? 0) - (a.apps ?? 0));

  return { teamId: String(teamId), name: (meta.team_name as string) ?? String(teamId), logo, inSystem: !!slug, seasons, results, stats, squad };
}

export type CupMatchStat = { key: string; label: string; a: number | null; b: number | null };
export type CupMatchDetail = {
  matchId: string;
  roundName: string | null;
  datetime: string | null;
  homeName: string; awayName: string;
  homeLogo: string | null; awayLogo: string | null;
  homeHref: string | null; awayHref: string | null;
  homeScore: number | null; awayScore: number | null;
  stats: CupMatchStat[];
};

// Mackolik stat_team'deki TÜM tipler (o maçta hangisi varsa hepsi gösterilir).
const MATCH_STAT_ORDER: { key: string; label: string }[] = [
  { key: "possession", label: "Topa Sahip Olma" },
  { key: "expected_goals", label: "Gol Beklentisi (xG)" },
  { key: "expected_goals_on_set_pieces", label: "Duran Toptan xG" },
  { key: "shots", label: "Toplam Şut" },
  { key: "shots_on_target", label: "İsabetli Şut" },
  { key: "shots_off_target", label: "İsabetsiz Şut" },
  { key: "blocked_shots", label: "Engellenen Şut" },
  { key: "woodwork", label: "Direkten Dönen" },
  { key: "big_chances_missed", label: "Kaçan Büyük Şans" },
  { key: "touches_in_opp_box", label: "Rakip Ceza Sahasında Buluşma" },
  { key: "corners", label: "Korner" },
  { key: "throw_in", label: "Taç" },
  { key: "goal_kick", label: "Kale Vuruşu" },
  { key: "total_offside", label: "Ofsayt" },
  { key: "passes", label: "Toplam Pas" },
  { key: "successful_passes", label: "İsabetli Pas" },
  { key: "passing_accuracy", label: "Pas İsabeti (%)" },
  { key: "crosses", label: "Orta" },
  { key: "successful_crosses", label: "İsabetli Orta" },
  { key: "successful_tackles", label: "Top Kapma" },
  { key: "interceptions", label: "Araya Girme" },
  { key: "clearances", label: "Uzaklaştırma" },
  { key: "successful_duels", label: "Kazanılan İkili Mücadele" },
  { key: "successful_aerial_duels", label: "Kazanılan Hava Topu" },
  { key: "successful_takeons", label: "Başarılı Çalım" },
  { key: "fouls", label: "Faul" },
  { key: "yellow_card", label: "Sarı Kart" },
  { key: "second_yellow_card", label: "2. Sarı Kart" },
  { key: "direct_red_card", label: "Direkt Kırmızı Kart" },
  { key: "red_card", label: "Kırmızı Kart" },
];

async function teamHref(sb: Awaited<ReturnType<typeof createClient>>, teamId: number | null, slug: string | null): Promise<string | null> {
  if (slug) return `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(slug)}`;
  if (teamId != null) return `/dashboard/cup/team/${teamId}`;
  return null;
}

export async function loadCupMatchDetail(matchId: string): Promise<CupMatchDetail | null> {
  const sb = await createClient();
  const [{ data: m }, { data: statRows }, localLogos] = await Promise.all([
    sb.schema("analytics").from("cup_matches_v1")
      .select("match_id, round_name, match_datetime, home_team_id, home_team_name, home_team_uuid, home_team_slug, away_team_id, away_team_name, away_team_uuid, away_team_slug, home_score, away_score")
      .eq("match_id", matchId).maybeSingle(),
    sb.schema("analytics").from("cup_match_stats_v1").select("stat_type, value_a, value_b").eq("match_uuid", matchId),
    getAllFootballTeamLogos(),
  ]);
  if (!m) return null;
  const statMap = new Map<string, { a: number | null; b: number | null }>();
  for (const r of statRows ?? []) statMap.set(r.stat_type as string, { a: toNum(r.value_a), b: toNum(r.value_b) });
  const stats: CupMatchStat[] = MATCH_STAT_ORDER
    .filter((s) => statMap.has(s.key))
    .map((s) => ({ key: s.key, label: s.label, a: statMap.get(s.key)!.a, b: statMap.get(s.key)!.b }));

  const homeLogo = (m.home_team_slug ? localLogos[m.home_team_slug as string] ?? null : null) ?? CDN_TEAM(m.home_team_uuid as string | null);
  const awayLogo = (m.away_team_slug ? localLogos[m.away_team_slug as string] ?? null : null) ?? CDN_TEAM(m.away_team_uuid as string | null);
  return {
    matchId: String(m.match_id), roundName: (m.round_name as string) ?? null, datetime: (m.match_datetime as string) ?? null,
    homeName: (m.home_team_name as string) ?? "—", awayName: (m.away_team_name as string) ?? "—",
    homeLogo, awayLogo,
    homeHref: await teamHref(sb, toNum(m.home_team_id), (m.home_team_slug as string) ?? null),
    awayHref: await teamHref(sb, toNum(m.away_team_id), (m.away_team_slug as string) ?? null),
    homeScore: toNum(m.home_score), awayScore: toNum(m.away_score),
    stats,
  };
}

export type CupPlayerSeason = { season: string; apps: number; rating: number | null };
export type CupPlayerMatch = { matchId: string; datetime: string | null; roundName: string | null; rating: number | null };
export type CupPlayerProfile = {
  playerId: string;
  name: string;
  photo: string | null;
  height: number | null;
  birthDate: string | null;
  position: string | null;
  teamId: string | null;
  teamName: string | null;
  teamLogo: string | null;
  teamHref: string | null;
  seasons: CupPlayerSeason[];
  matches: CupPlayerMatch[];
};

export async function loadCupPlayerProfile(playerId: string): Promise<CupPlayerProfile | null> {
  const sb = await createClient();
  const [{ data: statRows }, { data: lineRows }, localLogos] = await Promise.all([
    sb.schema("analytics").from("cup_player_stats_v1")
      .select("player_id, player_uuid, player_name, height, birth_date, main_team_id, main_position, season_label, apps, avg_rating")
      .eq("player_id", playerId).order("season_label", { ascending: false }),
    sb.schema("analytics").from("cup_player_lineup_v1")
      .select("match_uuid, match_datetime, round_name, rating").eq("player_id", playerId).order("match_datetime", { ascending: false }).limit(40),
    getAllFootballTeamLogos(),
  ]);
  if (!statRows || !statRows.length) return null;
  const top = statRows[0];
  const teamId = top.main_team_id == null ? null : String(top.main_team_id);

  let teamName: string | null = null, teamLogo: string | null = null, teamHref: string | null = null;
  if (teamId) {
    const { data: tm } = await sb.schema("analytics").from("cup_team_meta_v1").select("team_name, team_uuid, team_slug").eq("team_id", teamId).maybeSingle();
    if (tm) {
      teamName = (tm.team_name as string) ?? null;
      const slug = tm.team_slug as string | null;
      teamLogo = (slug ? localLogos[slug] ?? null : null) ?? CDN_TEAM(tm.team_uuid as string | null);
      teamHref = `/dashboard/cup/team/${encodeURIComponent(teamId)}`;
    }
  }

  return {
    playerId: String(playerId), name: (top.player_name as string) ?? String(playerId),
    photo: cupPlayerPhoto(top.player_uuid as string | null),
    height: toNum(top.height), birthDate: (top.birth_date as string) ?? null, position: (top.main_position as string) ?? null,
    teamId, teamName, teamLogo, teamHref,
    seasons: statRows.map((r) => ({ season: r.season_label as string, apps: toNum(r.apps) ?? 0, rating: toNum(r.avg_rating) })),
    matches: (lineRows ?? []).map((r) => ({
      matchId: String(r.match_uuid), datetime: (r.match_datetime as string) ?? null, roundName: (r.round_name as string) ?? null, rating: toNum(r.rating),
    })),
  };
}
