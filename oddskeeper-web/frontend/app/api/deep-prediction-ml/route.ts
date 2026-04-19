import { NextRequest, NextResponse } from 'next/server'
import { getMLPrediction, getTeamProfiles, getUpcomingFixtures } from '@/app/dashboard/deep-prediction-ml/queries'

export async function GET(req: NextRequest) {
  const fixtureId = req.nextUrl.searchParams.get('fixture_id')

  if (!fixtureId) {
    return NextResponse.json({ error: 'fixture_id required' }, { status: 400 })
  }

  // Look up fixture to get team names
  const fixtures = await getUpcomingFixtures()
  const fixture = fixtures.find((f) => f.fixture_id === fixtureId)

  if (!fixture) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  }

  const [prediction, { home: homeProfile, away: awayProfile }] = await Promise.all([
    getMLPrediction(fixtureId),
    getTeamProfiles(fixture.home_team_name, fixture.away_team_name),
  ])

  return NextResponse.json({ prediction, homeProfile, awayProfile })
}
