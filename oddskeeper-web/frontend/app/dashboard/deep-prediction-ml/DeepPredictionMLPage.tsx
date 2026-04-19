'use client'

import { useState, useEffect, useRef } from 'react'
import type { UpcomingFixture, MLPrediction, TeamProfile } from './queries'
import {
  STAT_CONFIGS,
  RADAR_STAT_CONFIGS,
  getRadarData,
  getBarPct,
  getPossession,
  buildProfileDisplay,
  getTopFeatures,
  getConfidenceLabel,
} from './compute'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fixtures: UpcomingFixture[]
}

// ─── Radar chart (Canvas, no library dep on client bundle) ───────────────────

function RadarCanvas({
  homeData,
  awayData,
  labels,
}: {
  homeData: number[]
  awayData: number[]
  labels: string[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const R = Math.min(cx, cy) - 28
    const N = labels.length
    const step = (2 * Math.PI) / N
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    ctx.clearRect(0, 0, W, H)

    const gridColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
    const labelColor = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.45)'

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (R * ring) / 4
      ctx.beginPath()
      for (let i = 0; i < N; i++) {
        const angle = step * i - Math.PI / 2
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // Axis lines
    for (let i = 0; i < N; i++) {
      const angle = step * i - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle))
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // Labels
    ctx.font = '9px system-ui, sans-serif'
    ctx.fillStyle = labelColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < N; i++) {
      const angle = step * i - Math.PI / 2
      const lx = cx + (R + 14) * Math.cos(angle)
      const ly = cy + (R + 14) * Math.sin(angle)
      ctx.fillText(labels[i], lx, ly)
    }

    function drawDataset(data: number[], fillColor: string, strokeColor: string) {
      ctx!.beginPath()
      for (let i = 0; i < N; i++) {
        const angle = step * i - Math.PI / 2
        const r = (R * data[i]) / 100
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y)
      }
      ctx!.closePath()
      ctx!.fillStyle = fillColor
      ctx!.fill()
      ctx!.strokeStyle = strokeColor
      ctx!.lineWidth = 1.5
      ctx!.stroke()

      // Points
      for (let i = 0; i < N; i++) {
        const angle = step * i - Math.PI / 2
        const r = (R * data[i]) / 100
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        ctx!.beginPath()
        ctx!.arc(x, y, 2.5, 0, 2 * Math.PI)
        ctx!.fillStyle = strokeColor
        ctx!.fill()
      }
    }

    drawDataset(awayData, 'rgba(55,138,221,0.12)', '#378ADD')
    drawDataset(homeData, 'rgba(29,158,117,0.15)', '#1D9E75')
  }, [homeData, awayData, labels])

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={160}
      role="img"
      aria-label="Stat profil radar chart"
    />
  )
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      width: 60, height: 3,
      background: 'var(--color-background-secondary)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  )
}

// ─── Team profile panel ───────────────────────────────────────────────────────

function TeamProfilePanel({
  profile,
  side,
}: {
  profile: TeamProfile
  side: 'home' | 'away'
}) {
  const color  = side === 'home' ? '#1D9E75' : '#378ADD'
  const d = buildProfileDisplay(profile)

  const rows: { label: string; right: React.ReactNode }[] = [
    {
      label: 'Atak gücü',
      right: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MiniBar pct={d.attackPct} color={color} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.attackLabel}</span>
        </span>
      ),
    },
    {
      label: 'Defans gücü',
      right: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MiniBar pct={d.defensePct} color={color} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.defenseLabel}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>({d.defenseQuality})</span>
        </span>
      ),
    },
    {
      label: 'Lig sırası',
      right: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.rankLabel}</span>
        </span>
      ),
    },
    {
      label: 'Son 5 puan',
      right: <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.formLabel}</span>,
    },
    {
      label: 'Ort xG',
      right: <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.xgLabel}</span>,
    },
    {
      label: 'Ort xGA',
      right: <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.xgaLabel}</span>,
    },
  ]

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{
        fontSize: 12, fontWeight: 500, marginBottom: 10,
        color,
      }}>
        {profile.team_name}
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 7,
        }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{row.label}</span>
          {row.right}
        </div>
      ))}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({
  prediction,
  homeProfile,
  awayProfile,
}: {
  prediction: MLPrediction
  homeProfile: TeamProfile | null
  awayProfile: TeamProfile | null
}) {
  const homeRadar = getRadarData(prediction, 'home')
  const awayRadar = getRadarData(prediction, 'away')
  const radarLabels = RADAR_STAT_CONFIGS.map((c) => c.label)
  const poss = getPossession(prediction)
  const conf = getConfidenceLabel(prediction.confidence)
  const topFeatures = getTopFeatures(prediction.feature_importance, 5)

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '13px 16px 11px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {prediction.home_team_name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>vs</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {prediction.away_team_name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {prediction.fixture_date}
          </span>
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 20,
            background: '#E1F5EE', color: '#0F6E56', fontWeight: 500,
          }}>
            ML tahmin
          </span>
          {prediction.confidence != null && (
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 20,
              background: 'var(--color-background-secondary)',
              color: conf.color, fontWeight: 500,
            }}>
              {conf.label} güven
            </span>
          )}
        </div>
      </div>

      {/* Body: radar + stats */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Radar */}
        <div style={{
          flex: '0 0 180px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '14px 6px 10px 14px',
          borderRight: '0.5px solid var(--color-border-tertiary)',
        }}>
          <RadarCanvas homeData={homeRadar} awayData={awayRadar} labels={radarLabels} />
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 5, textAlign: 'center' }}>
            Stat profili
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {['home', 'away'].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s === 'home' ? '#1D9E75' : '#378ADD' }} />
                <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                  {s === 'home' ? prediction.home_team_name.split(' ')[0] : prediction.away_team_name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat rows */}
        <div style={{ flex: 1, padding: '12px 16px' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 90px 1fr',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#0F6E56', textAlign: 'right' }}>
              {prediction.home_team_name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#185FA5', textAlign: 'left' }}>
              {prediction.away_team_name}
            </span>
          </div>

          {STAT_CONFIGS.map((cfg) => {
            const hv = prediction[cfg.homeKey] as number | null
            const av = prediction[cfg.awayKey] as number | null
            if (hv == null && av == null) return null
            const hPct = getBarPct(hv, cfg.displayMax)
            const aPct = getBarPct(av, cfg.displayMax)
            return (
              <div key={cfg.key} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 1fr',
                alignItems: 'center', marginBottom: 5, gap: 4,
              }}>
                {/* Home side */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#0F6E56' }}>
                    {hv != null ? hv.toFixed(2) : '—'}
                  </span>
                  <div style={{ width: 52, height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${hPct}%`, height: '100%', background: '#1D9E75', borderRadius: 2, float: 'right' }} />
                  </div>
                </div>
                {/* Label */}
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                  {cfg.label}
                </span>
                {/* Away side */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 5 }}>
                  <div style={{ width: 52, height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${aPct}%`, height: '100%', background: '#378ADD', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#185FA5' }}>
                    {av != null ? av.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Possession */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, paddingTop: 8,
            borderTop: '0.5px solid var(--color-border-tertiary)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Top: <span style={{ fontWeight: 500, color: '#0F6E56' }}>{poss.home}%</span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Possession</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <span style={{ fontWeight: 500, color: '#185FA5' }}>{poss.away}%</span> :Top
            </span>
          </div>
        </div>
      </div>

      {/* Model details */}
      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '12px 16px' }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
          marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Model detayları
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: topFeatures.length > 0 ? 12 : 0 }}>
          {[
            { label: 'Versiyon', val: prediction.model_version, sub: '2025/26 sezonu' },
            { label: 'Güven skoru', val: prediction.confidence != null ? `${(prediction.confidence * 100).toFixed(1)}%` : '—', sub: conf.label },
            { label: 'Stat modeller', val: '11', sub: 'her stat ayrı' },
          ].map((chip) => (
            <div key={chip.label} style={{
              background: 'var(--color-background-secondary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{chip.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 2 }}>{chip.val}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{chip.sub}</div>
            </div>
          ))}
        </div>

        {/* Feature importance */}
        {topFeatures.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              En etkili özellikler
            </div>
            {topFeatures.map((feat) => (
              <div key={feat.name} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 36px',
                alignItems: 'center', gap: 8, marginBottom: 4,
              }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {feat.name}
                </span>
                <div style={{ height: 4, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${feat.pct}%`, height: '100%', background: '#1D9E75', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                  {(feat.value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team profiles */}
      {(homeProfile || awayProfile) && (
        <div style={{
          borderTop: '0.5px solid var(--color-border-tertiary)',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
        }}>
          <div style={{ borderRight: '0.5px solid var(--color-border-tertiary)' }}>
            {homeProfile && <TeamProfilePanel profile={homeProfile} side="home" />}
          </div>
          <div>
            {awayProfile && <TeamProfilePanel profile={awayProfile} side="away" />}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DeepPredictionMLPage({ fixtures }: Props) {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('')
  const [prediction, setPrediction] = useState<MLPrediction | null>(null)
  const [homeProfile, setHomeProfile] = useState<TeamProfile | null>(null)
  const [awayProfile, setAwayProfile] = useState<TeamProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Format fixture date for display
  const weekLabel = (() => {
    if (!fixtures.length) return '—'
    const d = new Date(fixtures[0].fixture_date)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  async function handleSelect(fixtureId: string) {
    setSelectedFixtureId(fixtureId)
    setPrediction(null)
    setHomeProfile(null)
    setAwayProfile(null)
    setError(null)
    if (!fixtureId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/deep-prediction-ml?fixture_id=${fixtureId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setPrediction(json.prediction)
      setHomeProfile(json.homeProfile)
      setAwayProfile(json.awayProfile)
    } catch (e) {
      setError('Tahmin verisi yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const selectedFixture = fixtures.find((f) => f.fixture_id === selectedFixtureId)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          Deep Prediction ML
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          Maç başına istatistik tahminleri — shots, corners, cards ve daha fazlası
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          padding: '4px 10px', fontSize: 12,
          color: 'var(--color-text-secondary)', marginTop: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
          Süper Lig · {weekLabel}
        </div>
      </div>

      {/* Fixture selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <select
          value={selectedFixtureId}
          onChange={(e) => handleSelect(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, fontSize: 13, padding: '8px 12px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          <option value="">— Maç seçin —</option>
          {fixtures.map((f) => (
            <option key={f.fixture_id} value={f.fixture_id}>
              {f.home_team_name} vs {f.away_team_name} · {f.fixture_date}
            </option>
          ))}
        </select>
      </div>

      {/* States */}
      {!selectedFixtureId && (
        <div style={{
          padding: '3rem 1rem', textAlign: 'center',
          color: 'var(--color-text-tertiary)', fontSize: 13,
          background: 'var(--color-background-secondary)',
          border: '0.5px dashed var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
        }}>
          Yukarıdan bir maç seçin
        </div>
      )}

      {loading && (
        <div style={{
          padding: '3rem 1rem', textAlign: 'center',
          color: 'var(--color-text-tertiary)', fontSize: 13,
        }}>
          Tahmin yükleniyor…
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem', fontSize: 13,
          background: 'var(--color-background-danger)',
          color: 'var(--color-text-danger)',
          borderRadius: 'var(--border-radius-md)',
        }}>
          {error}
        </div>
      )}

      {/* No prediction yet for selected fixture */}
      {!loading && !error && selectedFixtureId && !prediction && (
        <div style={{
          padding: '3rem 1rem', textAlign: 'center',
          color: 'var(--color-text-tertiary)', fontSize: 13,
          background: 'var(--color-background-secondary)',
          border: '0.5px dashed var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
        }}>
          Bu maç için henüz ML tahmini yok.
          <br />
          <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            Model çalıştırıldıktan sonra burada görünecek.
          </span>
        </div>
      )}

      {/* Match card */}
      {!loading && prediction && (
        <MatchCard
          prediction={prediction}
          homeProfile={homeProfile}
          awayProfile={awayProfile}
        />
      )}
    </div>
  )
}
