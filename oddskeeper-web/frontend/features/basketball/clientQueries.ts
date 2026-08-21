"use client";

import { createClient } from "@/lib/supabase/client";
import { normalizePlayerName } from "./unified";
import type { BktPlayerLogRow, BktPlayerSeasonRow } from "./types";

// Oyuncu seçilince maç geçmişini çek (drawer için tam log).
export async function fetchBasketballPlayerLog(playerSlug: string, limit = 60): Promise<BktPlayerLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_match_log_v1")
    .select("season_label,match_key,match_date,week,player_slug,player_name,team_slug,team_name,home_away,opponent_name,opponent_slug,minutes,points,fgm,fga,fg2m,fg2a,fg3m,fg3a,ftm,fta,oreb,dreb,treb,assists,turnovers,steals,blocks,blocks_against,fouls_drawn,fouls_committed,pra,pa,pr,efg_pct,ts_pct")
    .eq("season_label", "2025-2026")
    .eq("player_slug", playerSlug)
    .order("match_date", { ascending: false })
    .limit(limit)
    .returns<BktPlayerLogRow[]>();
  if (error) {
    console.error("fetchBasketballPlayerLog error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchBasketballPlayerSeason(playerSlug: string): Promise<BktPlayerSeasonRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_season_stats_v1")
    .select("season_label,competition,player_slug,player_name,team_slug,team_name,jersey_no,games,minutes_total,mpg,points_total,reb_total,assists_total,steals_total,blocks_total,turnovers_total,oreb_total,dreb_total,fg3m_total,ppg,rpg,apg,spg,bpg,topg,orpg,drpg,fg3m_pg,fg_pct,fg2_pct,fg3_pct,ft_pct,efg_pct,ts_pct,three_rate,ppm,pts_per36,reb_per36,ast_per36,usage_pct,pra_pg,pa_pg,pr_pg,position,height_cm,sofascore_player_id,role,country_code,country_code2")
    .eq("season_label", "2025-2026")
    .eq("player_slug", playerSlug)
    .maybeSingle<BktPlayerSeasonRow>();
  if (error) {
    console.error("fetchBasketballPlayerSeason error:", error.message);
    return null;
  }
  return data ?? null;
}

/* ---------------- EL/EC drawer (person_code + competition E/U) ---------------- */
export async function fetchEuroPlayerSeason(personCode: string, comp: "E" | "U", season = "2025-2026"): Promise<BktPlayerSeasonRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    // select-yildiz: bilincli genis okuma (Record<string, unknown> tipi + n(k) dinamik anahtar erisimi)
    .schema("analytics").from("el_player_season_v1").select("*")
    .eq("competition", comp).eq("season_label", season).eq("person_code", personCode)
    .maybeSingle<Record<string, unknown>>();
  if (error) { console.error("fetchEuroPlayerSeason", error.message); return null; }
  if (!data) return null;
  const n = (k: string) => (data[k] as number | null) ?? null;
  const teamCode = String(data.team_code ?? "");
  // takım CDN logosu (el_team_home_away_split_v1'de crest_url var; yerel slug logosu EL code'da yok)
  let crestUrl: string | null = null;
  if (teamCode) {
    const { data: tr } = await supabase
      .schema("analytics").from("el_team_home_away_split_v1").select("crest_url")
      .eq("competition", comp).eq("season_label", season).eq("team_slug", teamCode)
      .maybeSingle<{ crest_url: string | null }>();
    crestUrl = tr?.crest_url ?? null;
  }
  return {
    player_slug: personCode, player_name: normalizePlayerName(String(data.player_name ?? personCode)),
    team_slug: teamCode, team_name: (data.team_name as string) ?? null, jersey_no: null, crest_url: crestUrl,
    games: (data.games as number) ?? 0, mpg: n("mpg"), ppg: n("ppg"), rpg: n("rpg"), apg: n("apg"),
    spg: n("spg"), bpg: n("bpg"), fg_pct: n("fg_pct"), fg3_pct: n("fg3_pct"), ft_pct: n("ft_pct"),
    ts_pct: n("ts_pct"), usage_pct: null,
    image_url: (data.image_url as string) ?? null, position: (data.position as string) ?? null,
    country_code: (data.country_code as string) ?? null,
  } as BktPlayerSeasonRow;
}

export async function fetchEuroPlayerLog(personCode: string, comp: "E" | "U", season = "2025-2026", limit = 60): Promise<BktPlayerLogRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    // select-yildiz: bilincli genis okuma (Record<string, unknown> tipi + num(k) dinamik anahtar erisimi)
    .schema("analytics").from("el_player_game_log_v1").select("*")
    .eq("competition", comp).eq("season_label", season).eq("person_code", personCode)
    .order("game_date", { ascending: false }).limit(limit)
    .returns<Record<string, unknown>[]>();
  if (error) { console.error("fetchEuroPlayerLog", error.message); return []; }
  return (data ?? []).map((d) => {
    const num = (k: string) => (d[k] as number) ?? 0;
    return {
      match_key: String(d.identifier ?? d.game_code ?? ""), match_date: String(d.game_date ?? ""),
      home_away: (d.home_away as string) ?? null, opponent_name: (d.opponent_name as string) ?? null,
      minutes: (d.minutes as number) ?? null, points: num("points"), treb: num("treb"), assists: num("assists"),
      fg3m: num("fg3m"), fg2m: num("fg2m"), ftm: num("ftm"), steals: num("steals"), blocks: num("blocks"),
      turnovers: num("turnovers"), pra: num("points") + num("treb") + num("assists"),
    } as BktPlayerLogRow;
  });
}
