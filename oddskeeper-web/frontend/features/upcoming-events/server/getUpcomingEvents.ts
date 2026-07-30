import { createClient } from "@/lib/supabase/server";
import type { UpcomingEventRow } from "../types";

export async function getUpcomingEvents(): Promise<UpcomingEventRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("upcoming_events_v1")
    .select("*")
    .order("start_ts", { ascending: true })
    .limit(500)
    .returns<UpcomingEventRow[]>();

  if (error) {
    console.error("getUpcomingEvents error:", error.message);
    return [];
  }

  return data ?? [];
}
