import { createClient } from "../../../lib/supabase/server";
import { TSL_COMPETITION } from "../constants";
import { pctToPercent, toNum } from "../lib";
import type {
  FormResult,
  TslLeaderRow,
  TslMatch,
  TslMetricOption,
  TslPlayerOverview,
  TslStandingRow,
  TslSummary,
  TslTeamLeaderRow,
  TslTeamMeta,
  TslTeamMetric,
} from "../types";

// ---- Takim kimlik/logo tablosu ----

export async function getTslTeamMeta(
  season: string
): Promise<Record<string, TslTeamMeta>> {
  const supabase = await createClient();
  const [ov, logos] = await Promise.all([
    supabase
      .schema("analytics")
      .from("tsl_ss_team_overview_advanced_mat")
      .select("team_name, source_team_id")
      .eq("competition", TSL_COMPETITION)
      .eq("season_label", season),
    supabase.schema("analytics").from("tff1_team_logos_v1").select("team_id, logo_url, team_name"),
  ]);

  // Once TUM logolu takimlarla doldur (sezon bagimsiz; 26/27 gibi overview'i
  // bos sezonlarda fikstur takimlarinin logosu/adi yine bulunur), sonra
  // overview isimleriyle uzerine yaz.
  const out: Record<string, TslTeamMeta> = {};
  for (const r of logos.data ?? []) {
    const id = String(r.team_id);
    out[id] = { teamId: id, name: r.team_name ?? id, logo: r.logo_url ?? null };
  }
  for (const r of ov.data ?? []) {
    const id = String(r.source_team_id);
    out[id] = {
      teamId: id,
      name: r.team_name ?? out[id]?.name ?? id,
      logo: out[id]?.logo ?? null,
    };
  }
  return out;
}

// ---- Maclar (sonuclar) ----

export async function getTslMatches(
  season: string,
  meta: Record<string, TslTeamMeta>
): Promise<TslMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_matches_v1")
    .select(
      "match_id, match_datetime, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score"
    )
    .eq("season_label", season)
    .not("home_score", "is", null)
    .order("match_datetime", { ascending: false })
    .limit(600);

  if (error) {
    console.error("tsl matches error", error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    const homeId = String(r.home_team_id);
    const awayId = String(r.away_team_id);
    return {
      matchId: String(r.match_id),
      datetime: r.match_datetime,
      homeId,
      awayId,
      homeName: meta[homeId]?.name ?? r.home_team_name ?? homeId,
      awayName: meta[awayId]?.name ?? r.away_team_name ?? awayId,
      homeLogo: meta[homeId]?.logo ?? null,
      awayLogo: meta[awayId]?.logo ?? null,
      homeScore: toNum(r.home_score) ?? 0,
      awayScore: toNum(r.away_score) ?? 0,
    };
  });
}

// Bir takimin son 5 maci (kronolojik, sonuncu en yeni).
function computeForm(teamId: string, matches: TslMatch[]): FormResult[] {
  // matches datetime DESC geldi; takimin maclarini al, kronolojik cevir.
  const played = matches
    .filter((m) => m.homeId === teamId || m.awayId === teamId)
    .slice()
    .reverse();
  const last5 = played.slice(-5);
  return last5.map((m) => {
    const isHome = m.homeId === teamId;
    const gf = isHome ? m.homeScore : m.awayScore;
    const ga = isHome ? m.awayScore : m.homeScore;
    if (gf > ga) return "W";
    if (gf < ga) return "L";
    return "D";
  });
}

// ---- Puan durumu ----

export async function getTslStandings(
  season: string,
  meta: Record<string, TslTeamMeta>,
  matches: TslMatch[]
): Promise<TslStandingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_team_overview_advanced_mat")
    .select(
      `team_name, source_team_id, matches_played, wins, draws, losses,
       score_for_total, score_against_total, attack_profile_label,
       defence_profile_label, recent_form_label, strongest_metric_label,
       strongest_metric_league_percentile, weakest_metric_label,
       weakest_metric_league_percentile`
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season);

  if (error) {
    console.error("tsl standings error", error.message);
    return [];
  }

  const rows = (data ?? []).map((r) => {
    const id = String(r.source_team_id);
    const wins = toNum(r.wins) ?? 0;
    const draws = toNum(r.draws) ?? 0;
    const losses = toNum(r.losses) ?? 0;
    const played = toNum(r.matches_played) ?? wins + draws + losses;
    const gf = toNum(r.score_for_total) ?? 0;
    const ga = toNum(r.score_against_total) ?? 0;
    const points = wins * 3 + draws;
    return {
      teamId: id,
      teamName: meta[id]?.name ?? r.team_name ?? id,
      logo: meta[id]?.logo ?? null,
      played,
      wins,
      draws,
      losses,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: gf - ga,
      points,
      ppg: played > 0 ? points / played : 0,
      form: computeForm(id, matches),
      attackLabel: r.attack_profile_label ?? null,
      defenceLabel: r.defence_profile_label ?? null,
      formLabel: r.recent_form_label ?? null,
      strongestLabel: r.strongest_metric_label ?? null,
      strongestPct: pctToPercent(r.strongest_metric_league_percentile),
      weakestLabel: r.weakest_metric_label ?? null,
      weakestPct: pctToPercent(r.weakest_metric_league_percentile),
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, "tr")
  );

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

export function computeSummary(
  matches: TslMatch[],
  teamCount: number
): TslSummary {
  let goals = 0;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const m of matches) {
    goals += m.homeScore + m.awayScore;
    if (m.homeScore > m.awayScore) home++;
    else if (m.homeScore < m.awayScore) away++;
    else draw++;
  }
  const n = matches.length || 1;
  return {
    teams: teamCount,
    matchesPlayed: matches.length,
    totalGoals: goals,
    goalsPerMatch: goals / n,
    homeWinPct: Math.round((home / n) * 100),
    drawPct: Math.round((draw / n) * 100),
    awayWinPct: Math.round((away / n) * 100),
  };
}

// ---- Oyuncu metrik katalogu ----

export async function getTslPlayerCatalog(
  season: string
): Promise<TslMetricOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_player_leaderboard_metric_catalog_v1")
    .select(
      "category_key, category_label, category_sort, metric_key, metric_label, metric_sort, value_format, is_higher_better, default_basis"
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .eq("is_active", true)
    .order("category_sort")
    .order("metric_sort");

  if (error) {
    console.error("tsl catalog error", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    categoryKey: r.category_key ?? "",
    categoryLabel: r.category_label ?? "",
    categorySort: toNum(r.category_sort) ?? 0,
    metricKey: r.metric_key,
    metricLabel: r.metric_label ?? r.metric_key,
    valueFormat: r.value_format ?? "count",
    isHigherBetter: r.is_higher_better ?? true,
    defaultBasis: r.default_basis ?? "total",
  }));
}

// ---- Oyuncu siralamasi (tek metrik) ----

// includeUnqualified: lig siralamasindaki "yeterli dakika" esigini (sezon max
// dakikanin %30'u) BYPASS eder. Lig genelindeki Player Rankings icin esik dogru,
// ama takim sayfasinda kadroyu eksik gosteriyordu: sezonun ilk haftasinda esik
// 27 dakika olduğu icin kisa sure oynayan yedekler listede cikmiyordu.
// topByTotal (P-4/H9, 2026-08-20): hub/lig ozetleri yalniz ilk 6-10 lideri
// gosteriyor ama sorgu metrik basina 600 satir tasiyordu. topByTotal=N verilirse
// DB toplam degere gore sirali ilk N satiri dondurur (JS'te yeniden siralama/
// kirpma gerekmez). Verilmezse eski davranis (rank sirali, 600 cap) aynen korunur.
export async function getTslLeaderboard(
  season: string,
  metricKey: string,
  options?: { includeUnqualified?: boolean; topByTotal?: number }
): Promise<TslLeaderRow[]> {
  const includeUnqualified = options?.includeUnqualified ?? false;
  const topByTotal = options?.topByTotal;
  const supabase = await createClient();
  let query = supabase
    .schema("analytics")
    .from(
      includeUnqualified
        ? "tsl_ss_player_leaderboard_all_rows_v1"
        : "tsl_ss_player_leaderboard_rows_v1"
    )
    .select(
      `metric_key, metric_label, player_source_id, player_name, position_code,
       team_name, source_team_id, sample_matches, total_value, per_match_value, per90_value,
       league_avg, league_rank, vs_league_avg_pct, value_format, is_higher_better`
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .eq("metric_key", metricKey);

  // Filtresiz surumde hic oynamamis kadro uyeleri de gelir; istatistik tablosunda
  // onlar gurultu (tam kadro ayri "Squad" sekmesinde).
  if (includeUnqualified) query = query.gt("sample_matches", 0);

  const { data, error } = await (topByTotal
    ? query
        .order("total_value", { ascending: false, nullsFirst: false })
        .limit(topByTotal)
    : query
        .order(includeUnqualified ? "sort_rank" : "league_rank", {
          ascending: true,
          nullsFirst: false,
        })
        .limit(600));

  if (error) {
    console.error("tsl leaderboard error", metricKey, error.message);
    return [];
  }
  return (data ?? []).map((r, i) => ({
    rank: toNum(r.league_rank) ?? i + 1,
    playerId: String(r.player_source_id ?? ""),
    playerName: r.player_name ?? "—",
    teamName: r.team_name ?? null,
    teamId: r.source_team_id != null ? String(r.source_team_id) : null,
    positionCode: r.position_code ?? null,
    metricKey: r.metric_key,
    metricLabel: r.metric_label ?? r.metric_key,
    total: toNum(r.total_value),
    perMatch: toNum(r.per_match_value),
    per90: toNum(r.per90_value),
    matches: toNum(r.sample_matches),
    leagueAvg: toNum(r.league_avg),
    vsAvgPct: toNum(r.vs_league_avg_pct),
    valueFormat: r.value_format ?? "count",
    isHigherBetter: r.is_higher_better ?? true,
  }));
}

// ---- Oyuncu genel bakis (kart/spotlight) ----

export async function getTslPlayerOverview(
  season: string
): Promise<TslPlayerOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_player_overview_advanced_mat")
    .select(
      `player_source_id, player_name, team_name, position_code, appearances,
       starts, total_minutes, avg_minutes, usage_label, recent_form_label,
       primary_strength_metric_label, primary_strength_league_percentile,
       primary_strength_metric_value, secondary_strength_metric_label,
       secondary_strength_league_percentile`
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .order("total_minutes", { ascending: false, nullsFirst: false })
    .limit(800);

  if (error) {
    console.error("tsl player overview error", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    playerId: String(r.player_source_id ?? ""),
    playerName: r.player_name ?? "—",
    teamName: r.team_name ?? null,
    positionCode: r.position_code ?? null,
    appearances: toNum(r.appearances),
    starts: toNum(r.starts),
    minutes: toNum(r.total_minutes),
    avgMinutes: toNum(r.avg_minutes),
    usageLabel: r.usage_label ?? null,
    formLabel: r.recent_form_label ?? null,
    primaryLabel: r.primary_strength_metric_label ?? null,
    primaryPct: pctToPercent(r.primary_strength_league_percentile),
    primaryValue: toNum(r.primary_strength_metric_value),
    secondaryLabel: r.secondary_strength_metric_label ?? null,
    secondaryPct: pctToPercent(r.secondary_strength_league_percentile),
  }));
}

// ---- Takim siralamasi (tum metrikler) ----

export async function getTslTeamLeaderboard(
  season: string,
  meta: Record<string, TslTeamMeta>
): Promise<TslTeamLeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_team_leaderboard_rows_v1")
    .select(
      `category_key, category_label, metric_key, metric_label, team_name,
       total_value, per_match_value, league_avg, league_rank, vs_league_avg_pct,
       value_format, is_higher_better`
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .order("league_rank", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (error) {
    console.error("tsl team leaderboard error", error.message);
    return [];
  }
  // isim -> id/logo eslesmesi (team_name uzerinden)
  const byName = new Map<string, TslTeamMeta>();
  for (const m of Object.values(meta)) byName.set(m.name, m);

  return (data ?? []).map((r, i) => ({
    rank: toNum(r.league_rank) ?? i + 1,
    teamId: byName.get(r.team_name ?? "")?.teamId ?? null,
    teamName: r.team_name ?? null,
    metricKey: r.metric_key,
    metricLabel: r.metric_label ?? r.metric_key,
    categoryKey: r.category_key ?? null,
    categoryLabel: r.category_label ?? null,
    total: toNum(r.total_value),
    perMatch: toNum(r.per_match_value),
    leagueAvg: toNum(r.league_avg),
    vsAvgPct: toNum(r.vs_league_avg_pct),
    valueFormat: r.value_format ?? "count",
    isHigherBetter: r.is_higher_better ?? true,
  }));
}

// ---- Takim detay metrikleri (kiyas/xG haritasi/profil) ----

export async function getTslTeamMetrics(
  season: string,
  meta: Record<string, TslTeamMeta>
): Promise<TslTeamMetric[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_team_detailed_metrics_mat")
    .select(
      `source_team_id, team_name, metric_key, metric_label, category_key,
       total_value, per_match_value, league_avg, league_percentile, league_rank,
       value_format, is_higher_better`
    )
    .eq("competition", TSL_COMPETITION)
    .eq("season_label", season)
    .limit(1000);

  if (error) {
    console.error("tsl team metrics error", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const id = String(r.source_team_id);
    return {
      teamId: id,
      teamName: meta[id]?.name ?? r.team_name ?? id,
      metricKey: r.metric_key,
      metricLabel: r.metric_label ?? r.metric_key,
      categoryKey: r.category_key ?? null,
      total: toNum(r.total_value),
      perMatch: toNum(r.per_match_value),
      leagueAvg: toNum(r.league_avg),
      leaguePct: pctToPercent(r.league_percentile),
      leagueRank: toNum(r.league_rank),
      valueFormat: r.value_format ?? "count",
      isHigherBetter: r.is_higher_better ?? true,
    };
  });
}
