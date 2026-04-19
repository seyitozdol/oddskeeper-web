import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpcomingFixture {
  fixture_id: string
  fixture_date: string
  home_team_name: string
  away_team_name: string
}

export interface MLPrediction {
  source_match_id: string
  fixture_date: string
  home_team_name: string
  away_team_name: string
  // stat predictions
  home_shots: number | null
  away_shots: number | null
  home_sot: number | null
  away_sot: number | null
  home_corners: number | null
  away_corners: number | null
  home_fouls: number | null
  away_fouls: number | null
  home_cards: number | null
  away_cards: number | null
  home_saves: number | null
  away_saves: number | null
  home_offsides: number | null
  away_offsides: number | null
  home_tackles: number | null
  away_tackles: number | null
  home_throwins: number | null
  away_throwins: number | null
  home_goal_kicks: number | null
  away_goal_kicks: number | null
  home_possession: number | null
  away_possession: number | null
  // model metadata
  model_version: string
  confidence: number | null
  feature_importance: Record<string, number> | null
  created_at: string
}

export interface TeamProfile {
  team_name: string
  attack_strength: number
  defense_strength: number
  league_rank: number
  form_points: number       // last 5 matches
  xg_avg: number
  xga_avg: number
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export async function getUpcomingFixtures(): Promise<UpcomingFixture[]> {
  const today = new Date().toISOString().split('T')[0]

  // Next 10 days window
  const limit = new Date()
  limit.setDate(limit.getDate() + 10)
  const limitStr = limit.toISOString().split('T')[0]

  const supabase = getClient()
  const { data, error } = await supabase
    .schema('analytics')
    .from('league_fixtures_v1')
    .select('fixture_id, fixture_date, home_team_name, away_team_name')
    .eq('competition_norm', 'superlig')
    .gte('fixture_date', today)
    .lte('fixture_date', limitStr)
    .order('fixture_date', { ascending: true })

  if (error) {
    console.error('[getUpcomingFixtures]', error.message)
    return []
  }

  return data ?? []
}

// ─── ML Predictions ───────────────────────────────────────────────────────────

export async function getMLPrediction(
  fixtureId: string
): Promise<MLPrediction | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .schema('prediction')
    .from('ml_predictions')
    .select('*')
    .eq('source_match_id', fixtureId)
    .eq('model_version', 'ml_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[getMLPrediction]', error.message)
    return null
  }

  return data
}

// ─── Team Profiles ────────────────────────────────────────────────────────────

/**
 * Derives team profile from fact_team_match (current season only).
 * attack_strength  = team's avg xG / league avg xG
 * defense_strength = team's avg xGA / league avg xGA  (lower = better)
 * league_rank      = based on points in standings (approximated from wins/draws)
 */
export async function getTeamProfiles(
  homeTeamName: string,
  awayTeamName: string
): Promise<{ home: TeamProfile | null; away: TeamProfile | null }> {
  const supabase = getClient()
  const { data, error } = await supabase
    .schema('analytics')
    .from('fact_team_match')
    .select(
      'team_name, is_home, score_for, score_against, details_expected_goals, match_datetime'
    )
    .eq('competition_norm', 'superlig')
    .in('team_name', [homeTeamName, awayTeamName])
    .order('match_datetime', { ascending: false })

  if (error || !data) {
    console.error('[getTeamProfiles]', error?.message)
    return { home: null, away: null }
  }

  const safeData = data

  function buildProfile(teamName: string): TeamProfile | null {
    const rows = safeData.filter((r) => r.team_name === teamName)
    if (!rows.length) return null

    const last5 = rows.slice(0, 5)
    const formPoints = last5.reduce((acc, r) => {
      if (r.score_for > r.score_against) return acc + 3
      if (r.score_for === r.score_against) return acc + 1
      return acc
    }, 0)

    const xgValues = rows
      .map((r) => r.details_expected_goals)
      .filter((v) => v != null) as number[]

    const xgaValues = rows
      .map((r) => r.score_against)
      .filter((v) => v != null) as number[]

    const xg_avg =
      xgValues.length > 0
        ? xgValues.reduce((a, b) => a + b, 0) / xgValues.length
        : 0

    const xga_avg =
      xgaValues.length > 0
        ? xgaValues.reduce((a, b) => a + b, 0) / xgaValues.length
        : 0

    // League avg constants (2025/26 Süper Lig approximation)
    const LEAGUE_XG_AVG = 1.38
    const LEAGUE_XGA_AVG = 1.38

    return {
      team_name: teamName,
      attack_strength: +(xg_avg / LEAGUE_XG_AVG).toFixed(3),
      defense_strength: +(xga_avg / LEAGUE_XGA_AVG).toFixed(3),
      league_rank: 0,   // filled by getRankings()
      form_points: formPoints,
      xg_avg: +xg_avg.toFixed(2),
      xga_avg: +xga_avg.toFixed(2),
    }
  }

  const home = buildProfile(homeTeamName)
  const away = buildProfile(awayTeamName)

  // Fetch league rankings separately and attach
  const rankings = await getRankings([homeTeamName, awayTeamName])
  if (home) home.league_rank = rankings[homeTeamName] ?? 0
  if (away) away.league_rank = rankings[awayTeamName] ?? 0

  return { home, away }
}

// ─── Rankings (approximated from points) ─────────────────────────────────────

async function getRankings(
  teamNames: string[]
): Promise<Record<string, number>> {
  // Pull full table to compute rank position
  const supabase = getClient()
  const { data, error } = await supabase
    .schema('analytics')
    .from('fact_team_match')
    .select('team_name, score_for, score_against')
    .eq('competition_norm', 'superlig')

  if (error || !data) return {}

  const pointsMap: Record<string, number> = {}

  for (const row of data) {
    if (!pointsMap[row.team_name]) pointsMap[row.team_name] = 0
    if (row.score_for > row.score_against) pointsMap[row.team_name] += 3
    else if (row.score_for === row.score_against) pointsMap[row.team_name] += 1
  }

  const sorted = Object.entries(pointsMap).sort((a, b) => b[1] - a[1])
  const rankMap: Record<string, number> = {}
  sorted.forEach(([name], i) => { rankMap[name] = i + 1 })

  return rankMap
}
