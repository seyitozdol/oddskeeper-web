import { createClient } from "../../../lib/supabase/server";
import type { PlayerStatsListRow } from "../types";

type CurrentInfoDbRow = {
  player_slug: string;
  player_name: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  current_team_slug: string | null;
  current_team_name: string | null;
  position: string | null;
  age: number | null;
  shirt_number: number | null;
  nationality: string | null;
  photo_url: string | null;
};

type ProfileDbRow = {
  player_slug: string;
  player_name: string;
  team_slug: string;
  team_name: string;
  primary_position_code: string;
  position_group: string;
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
  total_minutes: number;
  avg_minutes: number | string | null;
};

const POSITION_CODES: Record<string, { code: string; group: string }> = {
  Goalkeeper: { code: "GK", group: "GOALKEEPER" },
  Defender: { code: "DF", group: "DEFENDER" },
  Midfielder: { code: "MF", group: "MIDFIELDER" },
  Attacker: { code: "FW", group: "FORWARD" },
};

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPlayerStatsList(): Promise<PlayerStatsListRow[]> {
  const supabase = await createClient();

  const [currentInfoResult, profileResult] = await Promise.all([
    supabase
      .schema("analytics")
      .from("player_current_info_v1")
      .select(
        `
          player_slug,
          player_name,
          full_name,
          first_name,
          last_name,
          current_team_slug,
          current_team_name,
          position,
          age,
          shirt_number,
          nationality,
          photo_url
        `
      )
      .limit(2000)
      .returns<CurrentInfoDbRow[]>(),

    supabase
      .schema("analytics")
      .from("player_profile_v1")
      .select(
        `
          player_slug,
          player_name,
          team_slug,
          team_name,
          primary_position_code,
          position_group,
          appearances,
          starts,
          goals,
          assists,
          total_minutes,
          avg_minutes
        `
      )
      .limit(2000)
      .returns<ProfileDbRow[]>(),
  ]);

  if (currentInfoResult.error) {
    console.error("player stats list current info fetch error:", {
      message: currentInfoResult.error.message,
      details: currentInfoResult.error.details,
      code: currentInfoResult.error.code,
    });
  }

  if (profileResult.error) {
    console.error("player stats list profile fetch error:", {
      message: profileResult.error.message,
      details: profileResult.error.details,
      code: profileResult.error.code,
    });
  }

  const currentInfoRows = currentInfoResult.data ?? [];
  const profileRows = profileResult.data ?? [];

  const profileBySlug = new Map(
    profileRows.map((row) => [row.player_slug, row])
  );

  const merged = new Map<string, PlayerStatsListRow>();

  for (const info of currentInfoRows) {
    const profile = profileBySlug.get(info.player_slug);
    const position = POSITION_CODES[info.position ?? ""] ?? {
      code: profile?.primary_position_code ?? "—",
      group: profile?.position_group ?? "OTHER",
    };
    const fullName =
      [info.first_name, info.last_name].filter(Boolean).join(" ") ||
      info.full_name;

    merged.set(info.player_slug, {
      player_slug: info.player_slug,
      player_name: info.player_name,
      full_name: fullName,
      team_slug: info.current_team_slug,
      team_name: info.current_team_name,
      position_code: position.code,
      position_group: position.group,
      age: info.age,
      shirt_number: info.shirt_number,
      nationality: info.nationality,
      photo_url: info.photo_url,
      in_current_squad: true,
      has_stats: Boolean(profile),
      appearances: profile?.appearances ?? 0,
      starts: profile?.starts ?? 0,
      goals: profile?.goals ?? 0,
      assists: profile?.assists ?? 0,
      total_minutes: profile?.total_minutes ?? 0,
      avg_minutes: toNumberOrNull(profile?.avg_minutes ?? null),
    });
  }

  // Sezonda oynayıp güncel kadrolarda olmayanlar (ayrılanlar) da listede kalsın.
  for (const profile of profileRows) {
    if (merged.has(profile.player_slug)) {
      continue;
    }

    merged.set(profile.player_slug, {
      player_slug: profile.player_slug,
      player_name: profile.player_name,
      full_name: null,
      team_slug: profile.team_slug,
      team_name: profile.team_name,
      position_code: profile.primary_position_code,
      position_group: profile.position_group,
      age: null,
      shirt_number: null,
      nationality: null,
      photo_url: null,
      in_current_squad: false,
      has_stats: true,
      appearances: profile.appearances,
      starts: profile.starts,
      goals: profile.goals,
      assists: profile.assists,
      total_minutes: profile.total_minutes,
      avg_minutes: toNumberOrNull(profile.avg_minutes),
    });
  }

  return Array.from(merged.values());
}
