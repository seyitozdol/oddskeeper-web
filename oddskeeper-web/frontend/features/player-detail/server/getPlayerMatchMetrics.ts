import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import type {
  PlayerMatchMetricRow,
  PlayerMetricCatalogRow,
  PlayerMetricAggKind,
} from "../utils/aggregateMetrics";

// Detailed Stats kapsam secimi (rekabet + sezon) icin mac bazli metrikler:
// oyuncunun OYNADIGI her mac (Super Lig + Avrupa kupalari + milli takim).
// Toplama frontend'de yapilir (utils/aggregateMetrics). Kaynak:
// analytics.player_match_metrics_v1 (sql/2026-10-01_player_match_metrics.sql).
export const getPlayerMatchMetrics = cache(
  async (playerSourceId: string): Promise<PlayerMatchMetricRow[]> => {
    const supabase = await createClient();
    const out: PlayerMatchMetricRow[] = [];
    // Bir oyuncu sezonda ~50-60 mac oynar; 1000-cap'e takilmamak icin sayfala.
    for (let from = 0; from < 5000; from += 1000) {
      const { data, error } = await supabase
        .schema("analytics")
        .from("player_match_metrics_v1")
        .select(
          "source_match_id, competition, season_label, match_datetime, is_home, lineup_status, minutes, metrics, cards_yellow, cards_red"
        )
        .eq("player_source_id", playerSourceId)
        .order("match_datetime", { ascending: false })
        .order("source_match_id", { ascending: true })
        .range(from, from + 999);
      if (error) {
        console.error("getPlayerMatchMetrics failed ::", playerSourceId, error.message);
        return [];
      }
      for (const r of data ?? []) {
        out.push({
          sourceMatchId: String(r.source_match_id),
          competition: r.competition ?? null,
          seasonLabel: r.season_label ?? null,
          matchDatetime: r.match_datetime ?? null,
          isHome: Boolean(r.is_home),
          isStart: r.lineup_status === "starter",
          minutes: Number(r.minutes ?? 0),
          metrics: (r.metrics ?? {}) as Record<string, number>,
          cardsYellow: Number(r.cards_yellow ?? 0),
          cardsRed: Number(r.cards_red ?? 0),
        });
      }
      if (!data || data.length < 1000) break;
    }
    return out;
  }
);

// Metrik katalogu (anahtar, kategori, toplama turu, bicim). Detailed Stats'in
// mat'i ile ayni katalog: analytics.tsl_ss_metric_catalog_v1.
export const getPlayerMetricCatalog = cache(async (): Promise<PlayerMetricCatalogRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tsl_ss_metric_catalog_v1")
    .select(
      "metric_key, metric_label, category_key, category_label, display_priority, agg_kind, per90_eligible, value_format, is_higher_better, rank_direction"
    )
    .order("display_priority", { ascending: true })
    .limit(200);
  if (error) {
    console.error("getPlayerMetricCatalog failed ::", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    metricKey: r.metric_key,
    metricLabel: r.metric_label,
    categoryKey: r.category_key ?? "overall",
    categoryLabel: r.category_label ?? "",
    displayPriority: r.display_priority ?? 9999,
    aggKind: (r.agg_kind ?? "sum") as PlayerMetricAggKind,
    per90Eligible: Boolean(r.per90_eligible),
    valueFormat: r.value_format ?? "count",
    isHigherBetter: r.is_higher_better !== false,
    rankDirection: r.rank_direction ?? null,
  }));
});
