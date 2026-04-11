import { cache } from "react";
import { buildTeamAdvancedSummary } from "./buildTeamAdvancedSummary";
import { getTeamAdvancedRuleCatalog } from "./getTeamAdvancedRuleCatalog";
import type {
  TeamAdvancedFormSnapshot,
  TeamAdvancedSummary,
  TeamDetailedMetricRow,
} from "../types";

export const getTeamAdvancedSummary = cache(
  async (input: {
    rows: TeamDetailedMetricRow[];
    form?: TeamAdvancedFormSnapshot;
  }): Promise<TeamAdvancedSummary | null> => {
    const catalog = await getTeamAdvancedRuleCatalog();

    if (!input.rows?.length || !catalog.length) {
      return null;
    }

    return buildTeamAdvancedSummary({
      rows: input.rows,
      catalog,
      form: input.form,
    });
  }
);