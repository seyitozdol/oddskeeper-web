import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { TeamAdvancedOverviewRow } from "../types";

export const getTeamAdvancedOverview = cache(
  async (
    teamSlug: string,
    options?: {
      seasonLabel?: string;
    }
  ): Promise<TeamAdvancedOverviewRow | null> => {
    const supabase = await createClient();

    let query = supabase
      .from("team_overview_advanced_v1")
      .select("*")
      .eq("team_slug", teamSlug)
      .limit(1);

    if (options?.seasonLabel) {
      query = query.eq("season_label", options.seasonLabel);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("getTeamAdvancedOverview failed", {
        teamSlug,
        seasonLabel: options?.seasonLabel ?? null,
        error,
      });
      return null;
    }

    return (data ?? null) as TeamAdvancedOverviewRow | null;
  }
);
