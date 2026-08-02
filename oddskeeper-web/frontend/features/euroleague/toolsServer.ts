// EL/EC Match-Player Tools veri erişimi — analytics.el_* tools view'ları.
// BSL bb_* tools fn'lerinin EL/EC karşılığı; aynı tipleri döndürür (view'lar
// team_code→team_slug, person_code→player_slug alias'lar). comp = 'E' | 'U'.

import { createClient } from "@/lib/supabase/server";
import type {
  BktHomeAwaySplitRow, BktTeamMetricFormRow, BktPlayerWindowRow,
  BktTeamLogRow, BktPlayerListRow, BktPlayerRoleRow,
} from "@/features/basketball/types";

const PAGE = 1000;

export async function getEuroToolsSplits(comp: "E" | "U", season: string): Promise<BktHomeAwaySplitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_home_away_split_v1").select("*")
    .eq("competition", comp).eq("season_label", season)
    .returns<BktHomeAwaySplitRow[]>();
  if (error) { console.error("getEuroToolsSplits", error.message); return []; }
  return data ?? [];
}

export async function getEuroToolsForms(comp: "E" | "U", season: string): Promise<BktTeamMetricFormRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_team_metric_form_v1").select("*")
    .eq("competition", comp).eq("season_label", season)
    .returns<BktTeamMetricFormRow[]>();
  if (error) { console.error("getEuroToolsForms", error.message); return []; }
  return data ?? [];
}

export async function getEuroToolsWindows(comp: "E" | "U", season: string): Promise<BktPlayerWindowRow[]> {
  const supabase = await createClient();
  const rows: BktPlayerWindowRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema("analytics").from("el_player_metric_window_v1").select("*")
      .eq("competition", comp).eq("season_label", season)
      .range(from, from + PAGE - 1)
      .returns<BktPlayerWindowRow[]>();
    if (error) { console.error("getEuroToolsWindows", error.message); return rows; }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getEuroToolsTeamLogs(comp: "E" | "U", season: string): Promise<BktTeamLogRow[]> {
  const supabase = await createClient();
  const rows: BktTeamLogRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema("analytics").from("el_team_match_log_v1").select("*")
      .eq("competition", comp).eq("season_label", season)
      .order("match_date", { ascending: false })
      .range(from, from + PAGE - 1)
      .returns<BktTeamLogRow[]>();
    if (error) { console.error("getEuroToolsTeamLogs", error.message); return rows; }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getEuroToolsRoles(comp: "E" | "U", season: string): Promise<BktPlayerRoleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_role_v1")
    .select("season_label,team_slug,player_slug,player_name,position,games,avg_minutes,euro_team,role,image_url")
    .eq("competition", comp).eq("season_label", season)
    .returns<BktPlayerRoleRow[]>();
  if (error) { console.error("getEuroToolsRoles", error.message); return []; }
  return data ?? [];
}

export async function getEuroToolsPlayerList(comp: "E" | "U", season: string): Promise<BktPlayerListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics").from("el_player_list_v1").select("player_slug,player_name,team_slug,team_name,games")
    .eq("competition", comp).eq("season_label", season)
    .order("player_name", { ascending: true })
    .returns<BktPlayerListRow[]>();
  if (error) { console.error("getEuroToolsPlayerList", error.message); return []; }
  return data ?? [];
}
