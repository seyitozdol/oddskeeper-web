import { createClient } from "../../../lib/supabase/server";
import type {
  Tff1FixtureRow,
  Tff1MarketValue,
  Tff1MatchLogRow,
  Tff1MatchRow,
  Tff1PlayerInfo,
  Tff1PlayerRow,
  Tff1TeamLogo,
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
  const rows: Tff1MatchRow[] = [];

  // PostgREST 1000 cap: sezonlar biriktikce mac sayisi 1000'i asar -> sayfala.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tff1_matches_v1")
      .select("*")
      .order("match_datetime", { ascending: false })
      .order("match_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<Tff1MatchRow[]>();

    if (error) {
      console.error("getTff1Matches error:", error.message);
      return rows;
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getTff1PlayerInfo(): Promise<Tff1PlayerInfo[]> {
  const supabase = await createClient();
  const rows: Tff1PlayerInfo[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("tff1_player_info_v1")
      .select("player_id, birth_date, height_cm, country, photo_url")
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

// Yalniz verilen oyuncularin foto/ulke bilgisi (.in ile tek istek). Takim
// profili gibi ~30-60 oyunculuk yuzeyler 11k satirlik tum havuzu (yukaridaki
// getTff1PlayerInfo) tasimasin diye (C-1 sayfa-sekilli okuma deseni).
export async function getTff1PlayerInfoByIds(
  playerIds: string[]
): Promise<Tff1PlayerInfo[]> {
  const ids = Array.from(new Set(playerIds.filter(Boolean)));
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_player_info_v1")
    .select("player_id, birth_date, height_cm, country, photo_url")
    .in("player_id", ids)
    .returns<Tff1PlayerInfo[]>();
  if (error) {
    console.error("getTff1PlayerInfoByIds error:", error.message);
    return [];
  }
  return data ?? [];
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

export async function getTff1TeamLogos(): Promise<Tff1TeamLogo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_team_logos_v1")
    .select("team_id, logo_url")
    .limit(200)
    .returns<Tff1TeamLogo[]>();

  if (error) {
    console.error("getTff1TeamLogos error:", error.message);
    return [];
  }

  return data ?? [];
}

// Oyuncunun mac bazli logu (tum sezonlar; Super Lig satirlari da gelebilir).
export async function getTff1PlayerMatchLog(
  playerId: string
): Promise<Tff1MatchLogRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_player_match_log_mat")
    .select("*")
    .eq("player_id", playerId)
    .order("match_datetime", { ascending: false })
    .limit(300)
    .returns<Tff1MatchLogRow[]>();

  if (error) {
    console.error("getTff1PlayerMatchLog error:", error.message);
    return [];
  }

  return data ?? [];
}

// Tek macin tum oyuncu satirlari (mac detay sayfasi kadrolari).
export async function getTff1MatchPlayers(
  matchId: string
): Promise<Tff1MatchLogRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_player_match_log_mat")
    .select("*")
    .eq("match_id", matchId)
    .limit(60)
    .returns<Tff1MatchLogRow[]>();

  if (error) {
    console.error("getTff1MatchPlayers error:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getTff1Match(matchId: string): Promise<Tff1MatchRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_matches_v1")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle<Tff1MatchRow>();

  if (error) {
    console.error("getTff1Match error:", error.message);
    return null;
  }

  return data;
}

export async function getTff1Fixtures(): Promise<Tff1FixtureRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("analytics")
    .from("tff1_fixtures_v1")
    .select("*")
    .order("fixture_datetime", { ascending: true })
    .limit(500)
    .returns<Tff1FixtureRow[]>();

  if (error) {
    console.error("getTff1Fixtures error:", error.message);
    return [];
  }

  return data ?? [];
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
