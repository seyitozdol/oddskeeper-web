import { NextResponse, type NextRequest } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { isNavKeyVisible } from "@/lib/nav-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

// Header surprizinin gorsel ucu. Gorseller BILINCLI olarak repoda YOK (repo
// public; ne public/ altinda ne base64 olarak commit'lenir): Supabase Storage'da
// PRIVATE "private-assets" bucket'inda durur, yalniz service-role okur. Bu uc
// onlari yalniz "header-egg" izni ACIKCA verilmis kullaniciya servis eder;
// izinsiz/anonim istek 404 alir (ucun varligi da belli olmasin).
// Gorsel degistirmek = bucket'a ayni adla yeni dosya yuklemek (deploy gerekmez).

const BUCKET = "private-assets";
const POSE_PATHS = {
  smile: "header-egg/smile.webp",
  kiss: "header-egg/kiss.webp",
} as const;

type Pose = keyof typeof POSE_PATHS;

// Instance-ici kisa onbellek: her istekte storage'a gitme; TTL sayesinde
// bucket'taki gorsel degisince deploy'suz yansir.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<Pose, { bytes: ArrayBuffer; at: number }>();

async function loadPose(pose: Pose): Promise<ArrayBuffer | null> {
  const hit = cache.get(pose);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.bytes;

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET) // 1000-cap: storage indirme, PostgREST sorgusu degil
    .download(POSE_PATHS[pose]);

  if (error || !data) {
    console.error("Header egg image load error:", error?.message);
    return null;
  }

  const bytes = await data.arrayBuffer();
  cache.set(pose, { bytes, at: Date.now() });
  return bytes;
}

export async function GET(request: NextRequest) {
  const access = await getNavAccess();

  if (!isNavKeyVisible("header-egg", access.allowedKeys, access.isAdmin)) {
    return new NextResponse(null, { status: 404 });
  }

  const pose = request.nextUrl.searchParams.get("pose") ?? "smile";
  if (!(pose in POSE_PATHS)) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await loadPose(pose as Pose);
  if (!bytes) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/webp",
      // private: CDN/paylasimli onbellek tutmasin; yalniz kullanicinin tarayicisi.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
