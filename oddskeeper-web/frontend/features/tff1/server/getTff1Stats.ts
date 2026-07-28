import { createClient } from "../../../lib/supabase/server";
import type {
  Tff1MarketValue,
  Tff1MatchRow,
  Tff1PlayerInfo,
  Tff1PlayerRow,
  Tff1TeamRow,
} from "../types";

const PAGE_SIZE = 1000; // PostgREST tek istekte en fazla 1000 satir doner

export async function getTff1PlayerSeasonStats(): Promise<Tff1PlayerRow[]> {
  const supabase = await createClient();
  const rows: Tff1PlayerRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tff1_player_season_stats_mat")
      .select("*")
      .order("minutes", { ascending: false })
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1PlayerRow[]>();

    if (error) {
      console.error("getTff1PlayerSeasonStats error:", error.message);
      return rows;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getTff1Matches(): Promise<Tff1MatchRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_matches_v1")
    .select("*")
    .order("match_datetime", { ascending: false })
    .limit(1000)
    .returns<Tff1MatchRow[]>();

  if (error) {
    console.error("getTff1Matches error:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getTff1PlayerInfo(): Promise<Tff1PlayerInfo[]> {
  const supabase = await createClient();
  const rows: Tff1PlayerInfo[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tff1_player_info_v1")
      .select("player_id, birth_date, height_cm, country")
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1PlayerInfo[]>();

    if (error) {
      console.error("getTff1PlayerInfo error:", error.message);
      return rows;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getTff1MarketValues(): Promise<Tff1MarketValue[]> {
  const supabase = await createClient();
  const rows: Tff1MarketValue[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tff1_player_market_value_v1")
      .select("player_id, market_value_eur, tm_club")
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1MarketValue[]>();

    if (error) {
      console.error("getTff1MarketValues error:", error.message);
      return rows;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getTff1TeamSeasonStats(): Promise<Tff1TeamRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_team_season_stats_mat")
    .select("*")
    .order("points", { ascending: false })
    .limit(200)
    .returns<Tff1TeamRow[]>();

  if (error) {
    console.error("getTff1TeamSeasonStats error:", error.message);
    return [];
  }

  return data ?? [];
}
