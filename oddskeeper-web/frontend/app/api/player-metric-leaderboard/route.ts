import { NextRequest, NextResponse } from "next/server";
import { getPlayerMetricLeaderboard } from "@/features/player-detail/server/getPlayerMetricLeaderboard";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const metricKey = searchParams.get("metricKey");
  const seasonLabel = searchParams.get("seasonLabel") ?? undefined;
  const competition = searchParams.get("competition") ?? undefined;

  if (!metricKey) {
    return NextResponse.json(
      { error: "metricKey is required" },
      { status: 400 }
    );
  }

  try {
    const rows = await getPlayerMetricLeaderboard({
      metricKey,
      seasonLabel,
      competition,
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("player-metric-leaderboard api failed", {
      metricKey,
      seasonLabel,
      competition,
      error,
    });

    return NextResponse.json(
      { error: "Failed to load player metric leaderboard" },
      { status: 500 }
    );
  }
}