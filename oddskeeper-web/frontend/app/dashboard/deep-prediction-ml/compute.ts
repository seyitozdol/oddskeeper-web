import type { MLPrediction, TeamProfile } from './queries'

// ─── Stat config ──────────────────────────────────────────────────────────────

export interface StatConfig {
  key: string
  label: string
  homeKey: keyof MLPrediction
  awayKey: keyof MLPrediction
  radarMax: number      // normalization ceiling for radar (0–100)
  displayMax: number    // soft max for bar width
}

export const STAT_CONFIGS: StatConfig[] = [
  { key: 'shots',      label: 'Shots',      homeKey: 'home_shots',      awayKey: 'away_shots',      radarMax: 20, displayMax: 20 },
  { key: 'sot',        label: 'SoT',        homeKey: 'home_sot',        awayKey: 'away_sot',        radarMax: 10, displayMax: 10 },
  { key: 'corners',    label: 'Corners',    homeKey: 'home_corners',    awayKey: 'away_corners',    radarMax: 10, displayMax: 10 },
  { key: 'fouls',      label: 'Fouls',      homeKey: 'home_fouls',      awayKey: 'away_fouls',      radarMax: 18, displayMax: 18 },
  { key: 'cards',      label: 'Cards',      homeKey: 'home_cards',      awayKey: 'away_cards',      radarMax: 4,  displayMax: 4  },
  { key: 'saves',      label: 'Saves',      homeKey: 'home_saves',      awayKey: 'away_saves',      radarMax: 8,  displayMax: 8  },
  { key: 'offsides',   label: 'Offsides',   homeKey: 'home_offsides',   awayKey: 'away_offsides',   radarMax: 5,  displayMax: 5  },
  { key: 'tackles',    label: 'Tackles',    homeKey: 'home_tackles',    awayKey: 'away_tackles',    radarMax: 30, displayMax: 30 },
  { key: 'throwins',   label: 'Throw-ins',  homeKey: 'home_throwins',   awayKey: 'away_throwins',   radarMax: 30, displayMax: 30 },
  { key: 'goal_kicks', label: 'Goal Kicks', homeKey: 'home_goal_kicks', awayKey: 'away_goal_kicks', radarMax: 10, displayMax: 10 },
]

// Radar uses first 7 stats (shots → offsides)
export const RADAR_STAT_CONFIGS = STAT_CONFIGS.slice(0, 7)

// ─── Radar data ───────────────────────────────────────────────────────────────

export function getRadarData(
  prediction: MLPrediction,
  side: 'home' | 'away'
): number[] {
  return RADAR_STAT_CONFIGS.map((cfg) => {
    const key = side === 'home' ? cfg.homeKey : cfg.awayKey
    const val = prediction[key] as number | null
    if (val == null) return 0
    return Math.min(100, Math.round((val / cfg.radarMax) * 100))
  })
}

// ─── Bar widths ───────────────────────────────────────────────────────────────

export function getBarPct(
  val: number | null,
  displayMax: number
): number {
  if (val == null) return 0
  return Math.min(100, Math.round((val / displayMax) * 100))
}

// ─── Possession display ───────────────────────────────────────────────────────

export interface PossessionDisplay {
  home: number
  away: number
}

export function getPossession(prediction: MLPrediction): PossessionDisplay {
  const h = prediction.home_possession ?? 50
  const a = prediction.away_possession ?? 50
  // normalize to 100
  const total = h + a
  return {
    home: +((h / total) * 100).toFixed(1),
    away: +((a / total) * 100).toFixed(1),
  }
}

// ─── Team profile helpers ─────────────────────────────────────────────────────

export interface ProfileDisplay {
  attackLabel: string   // "1.42"
  attackPct: number     // 0–100 for mini bar
  defenseLabel: string
  defensePct: number
  defenseQuality: string   // "güçlü" | "zayıf" | "orta"
  rankLabel: string
  formLabel: string
  xgLabel: string
  xgaLabel: string
}

const ATTACK_MAX = 1.7
const DEFENSE_MAX = 1.7

export function buildProfileDisplay(profile: TeamProfile): ProfileDisplay {
  const attackPct = Math.min(100, Math.round((profile.attack_strength / ATTACK_MAX) * 100))

  // For defense: lower is better. We invert for the bar.
  const defensePct = Math.max(0, Math.min(100, Math.round(((DEFENSE_MAX - profile.defense_strength) / DEFENSE_MAX) * 100)))

  let defenseQuality = 'orta'
  if (profile.defense_strength < 0.85) defenseQuality = 'güçlü'
  else if (profile.defense_strength > 1.15) defenseQuality = 'zayıf'

  return {
    attackLabel: profile.attack_strength.toFixed(2),
    attackPct,
    defenseLabel: profile.defense_strength.toFixed(2),
    defensePct,
    defenseQuality,
    rankLabel: `${profile.league_rank}. / 18`,
    formLabel: `${profile.form_points} pt`,
    xgLabel: profile.xg_avg.toFixed(2),
    xgaLabel: profile.xga_avg.toFixed(2),
  }
}

// ─── Feature importance top-N ─────────────────────────────────────────────────

export interface FeatureItem {
  name: string
  value: number   // 0–1 importance score
  pct: number     // 0–100 for display bar
}

export function getTopFeatures(
  importance: Record<string, number> | null,
  topN = 5
): FeatureItem[] {
  if (!importance) return []
  const entries = Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)

  const max = entries[0]?.[1] ?? 1

  return entries.map(([name, value]) => ({
    name,
    value,
    pct: Math.round((value / max) * 100),
  }))
}

// ─── Model grade ──────────────────────────────────────────────────────────────

export function getConfidenceLabel(confidence: number | null): {
  label: string
  color: string
} {
  if (confidence == null) return { label: '—', color: 'var(--color-text-tertiary)' }
  if (confidence >= 0.75) return { label: 'Yüksek', color: '#0F6E56' }
  if (confidence >= 0.55) return { label: 'Orta',   color: '#BA7517' }
  return { label: 'Düşük', color: '#A32D2D' }
}
