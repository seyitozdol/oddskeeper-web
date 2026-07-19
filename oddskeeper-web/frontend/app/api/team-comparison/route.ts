import { NextRequest, NextResponse } from "next/server";
import { getTeamComparison } from "../../../features/team-detail/server/getTeamComparison";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  const split = (searchParams.get("split") ?? "overall") as
    | "overall"
    | "home"
    | "away";

  const season = searchParams.get("season");

  if (!a || !b) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const data = await getTeamComparison(a, b, split, season);

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}