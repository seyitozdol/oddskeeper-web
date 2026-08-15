import { NextResponse } from "next/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Aktivite heartbeat'i: oturumdaki kullanicinin son-gorulme + gunluk sayacini
// artirir (record_user_activity fonksiyonu, service-role). Client sayfa gezinme /
// odaklanma sirasinda kisitli araliklarla cagirir. Kullanici yoksa sessiz gecer.
export async function POST() {
  const access = await getNavAccess();
  if (!access.userId) {
    return NextResponse.json({ ok: false });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_user_activity", {
    p_user: access.userId,
  });

  if (error) {
    console.error("activity ping error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
