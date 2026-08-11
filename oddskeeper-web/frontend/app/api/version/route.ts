import { NextResponse } from "next/server";

// Canli deployment kimligi. VersionGuard (client) bunu build'e gomulu
// NEXT_PUBLIC_BUILD_ID ile karsilastirir; fark = yeni deploy = bayat sekme.
// Her istek runtime'da process.env okunmali (statik gomulmemeli) -> force-dynamic.
export const dynamic = "force-dynamic";

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";
  return NextResponse.json(
    { version },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
