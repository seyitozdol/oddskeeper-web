// Match-Player Tools veri montajı: "sezon kadrosu" modu.
//
// Analitik view'lar takım üyeliğini maç satırlarından türetir; yeni sezonun ilk haftalarında
// o sezonun maçı olmadığından havuz boş kalır, geçen sezonun havuzu da ESKİ kadroyu gösterir.
// Sezon için basketball.team_rosters doluysa (analytics.bb_player_metric_window_roster_v1):
//   - oyuncular  = o sezonun kadrosu; rakamlar oyuncunun geçmiş + güncel maçlarından
//   - takım metrikleri = takımın o sezonda yeterli maçı varsa o sezon, yoksa önceki sezon
// Kadro yoksa (geçmiş sezon) eski maç-güdümlü yol aynen çalışır.

import { createClient } from "@/lib/supabase/server";
import type {
  BktHomeAwaySplitRow,
  BktPlayerListRow,
  BktPlayerRoleRow,
  BktPlayerWindowRow,
  BktRosterMode,
  BktTeamLogRow,
  BktTeamMetricFormRow,
} from "../types";
import {
  getBasketballAllTeamMatchLogs,
  getBasketballHomeAwaySplits,
  getBasketballPlayerList,
  getBasketballPlayerRoles,
  getBasketballPlayerWindows,
  getBasketballStandings,
  getBasketballTeamMetricForms,
} from "./getBasketballStats";

const PAGE_SIZE = 1000;
// Takım ortalamaları birkaç maçta çok oynak: bu eşiğe kadar önceki sezonun metrikleri kullanılır.
const MIN_TEAM_GAMES = 5;

export type BasketballToolsData = {
  splits: BktHomeAwaySplitRow[];
  forms: BktTeamMetricFormRow[];
  windows: BktPlayerWindowRow[];
  teamLogs: BktTeamLogRow[];
  players: BktPlayerListRow[];
  roles: BktPlayerRoleRow[];
  rosterMode: BktRosterMode | null;
};

function previousSeason(season: string): string {
  const start = Number(season.slice(0, 4));
  return `${start - 1}-${start}`;
}

async function getRosterWindows(season: string): Promise<BktPlayerWindowRow[]> {
  const supabase = await createClient();
  const rows: BktPlayerWindowRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .schema("analytics")
      .from("bb_player_metric_window_roster_v1")
      .select("player_slug,player_name,team_slug,team_name,market_key,market_label,games,games_current,avg_minutes,season_avg,last5_avg,last10_avg,calc_std,total")
      .eq("season_label", season)
      .order("team_slug", { ascending: true })
      .order("market_key", { ascending: true })
      .order("player_slug", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<BktPlayerWindowRow[]>();
    if (error) {
      console.error("getRosterWindows error:", error.message);
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function getRosterRoles(season: string): Promise<BktPlayerRoleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("bb_player_role_roster_v1")
    .select("season_label,team_slug,player_slug,player_name,position,games,games_current,avg_minutes,euro_team,role,sofascore_player_id,origin,prev_team_slug,prev_team_name,confirmed")
    .eq("season_label", season)
    .limit(1000)
    .returns<BktPlayerRoleRow[]>();
  if (error) {
    console.error("getRosterRoles error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBasketballToolsData(season: string): Promise<BasketballToolsData> {
  const windows = await getRosterWindows(season);
  if (windows.length === 0) {
    const [splits, forms, legacyWindows, teamLogs, players, roles] = await Promise.all([
      getBasketballHomeAwaySplits(season),
      getBasketballTeamMetricForms(season),
      getBasketballPlayerWindows(season),
      getBasketballAllTeamMatchLogs(season),
      getBasketballPlayerList(season),
      getBasketballPlayerRoles(season),
    ]);
    return { splits, forms, windows: legacyWindows, teamLogs, players, roles, rosterMode: null };
  }

  const prev = previousSeason(season);
  const [participants, roles, splitsCur, splitsPrev, formsCur, formsPrev, logsCur, logsPrev] = await Promise.all([
    getBasketballStandings(season),
    getRosterRoles(season),
    getBasketballHomeAwaySplits(season),
    getBasketballHomeAwaySplits(prev),
    getBasketballTeamMetricForms(season),
    getBasketballTeamMetricForms(prev),
    getBasketballAllTeamMatchLogs(season),
    getBasketballAllTeamMatchLogs(prev),
  ]);

  const curBy = new Map(splitsCur.map((s) => [s.team_slug, s]));
  const prevBy = new Map(splitsPrev.map((s) => [s.team_slug, s]));
  const teamSource: BktRosterMode["teamSource"] = {};
  const splits: BktHomeAwaySplitRow[] = [];
  for (const team of participants) {
    const cur = curBy.get(team.team_slug);
    const old = prevBy.get(team.team_slug);
    const gamesCurrent = Number(cur?.games ?? 0);
    // Önceki sezonu olmayan takım (yeni çıkan) ilk maçından itibaren kendi sezonunu kullanır.
    const chosen = cur && (gamesCurrent >= MIN_TEAM_GAMES || !old) ? cur : old;
    teamSource[team.team_slug] = { season: chosen ? (chosen === cur ? season : prev) : null, gamesCurrent };
    splits.push(
      chosen
        ? { ...chosen, team_name: team.team_name ?? chosen.team_name }
        : {
            team_slug: team.team_slug, team_name: team.team_name ?? team.team_slug, games: 0, ppg: 0, oppg: 0,
            home_pf: null, home_pa: null, away_pf: null, away_pa: null, home_pf_std: null, away_pf_std: null, pf_std: null,
          },
    );
  }
  const from = (slug: string) => teamSource[slug]?.season;
  const forms = [...formsCur.filter((f) => from(f.team_slug) === season), ...formsPrev.filter((f) => from(f.team_slug) === prev)];
  const teamLogs = [...logsCur.filter((l) => from(l.team_slug) === season), ...logsPrev.filter((l) => from(l.team_slug) === prev)];

  const teamName = new Map(participants.map((p) => [p.team_slug, p.team_name]));
  const players: BktPlayerListRow[] = roles
    .map((r) => ({ player_slug: r.player_slug, player_name: r.player_name, team_slug: r.team_slug, team_name: teamName.get(r.team_slug) ?? r.team_slug, games: r.games }))
    .sort((a, b) => (a.team_name ?? "").localeCompare(b.team_name ?? "", "tr") || a.player_name.localeCompare(b.player_name, "tr"));

  return { splits, forms, windows, teamLogs, players, roles, rosterMode: { season, prevSeason: prev, teamSource } };
}
