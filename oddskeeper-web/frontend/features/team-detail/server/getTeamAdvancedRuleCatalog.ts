import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type { TeamAdvancedRuleCatalogRow } from "../types";

export const getTeamAdvancedRuleCatalog = cache(
  async (): Promise<TeamAdvancedRuleCatalogRow[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .schema("analytics")
      .from("team_advanced_rule_catalog")
      .select(
        `
          metric_key,
          metric_label,
          display_group,
          identity_group,
          direction,
          include_in_strength_risk,
          include_in_split,
          include_in_form,
          weight_attack,
          weight_defence,
          weight_build_up,
          priority_strength,
          priority_risk,
          is_active,
          notes
        `
      )
      .eq("is_active", true)
      .order("display_group", { ascending: true })
      .order("metric_key", { ascending: true });

    if (error) {
      console.error("getTeamAdvancedRuleCatalog failed", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return [];
    }

    return (data ?? []) as TeamAdvancedRuleCatalogRow[];
  }
);