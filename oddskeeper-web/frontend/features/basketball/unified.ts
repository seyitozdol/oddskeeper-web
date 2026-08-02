// BSL + EuroLeague + EuroCup profillerini TEK yapıya normalize eder.
// Oyuncu/takım profili aynı bileşende, kulvar (competition) toggle'ıyla gösterilir.

import type { BktPlayerSeasonRow, BktPlayerLogRow, BktEuroSeasonRow, BktEuroLogRow, BktTeamSeasonRow, BktTeamLogRow } from "./types";
import { playerPhotoUrl } from "./lib";

export type CompKey = "bsl" | "euroleague" | "eurocup";

export const COMP_META: Record<CompKey, { label: string; logo: string }> = {
  bsl: { label: "BSL", logo: "/images/leagues/bsl.svg" },
  euroleague: { label: "EuroLeague", logo: "/images/leagues/euroleague.svg" },
  eurocup: { label: "EuroCup", logo: "/images/leagues/eurocup.svg" },
};

export function euroCompKey(competition: string): CompKey {
  return competition === "U" ? "eurocup" : "euroleague";
}

// "SURNAME, NAME" (EL) -> "Name Surname"; BSL adı zaten düzgün, aynen bırakılır.
export function normalizePlayerName(name: string | null | undefined): string {
  if (!name) return "";
  if (name.includes(",")) {
    const [surname, given] = name.split(",").map((s) => s.trim());
    return titleCase(`${given} ${surname}`.trim());
  }
  return name;
}
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-zçğıöşü])/g, (c) => c.toUpperCase());
}

/* ---------------- Player ---------------- */
export type ProfileLogRow = {
  key: string;
  date: string | null;
  home_away: string | null;
  team_name: string | null;
  team_slug?: string | null;    // BSL yerel logo
  team_crest?: string | null;   // EL/EC uzak crest
  opponent: string | null;
  opponent_slug?: string | null;
  minutes: number | null;
  points: number | null;
  treb: number | null;
  assists: number | null;
  fg3m: number | null;
  steals: number | null;
  blocks: number | null;
  ts_pct: number | null;
  valuation: number | null;
};

export type PlayerCompStats = {
  key: CompKey;
  label: string;
  logo: string;
  seasonLabel: string;
  teamName: string | null;
  games: number;
  mpg: number | null; ppg: number | null; rpg: number | null; apg: number | null;
  spg: number | null; bpg: number | null; fg3m_pg: number | null; val_pg: number | null;
  fg_pct: number | null; fg2_pct: number | null; fg3_pct: number | null; ft_pct: number | null;
  efg_pct: number | null; ts_pct: number | null;
  usage_pct: number | null; pts_per36: number | null; reb_per36: number | null; ast_per36: number | null;
  pra_pg: number | null; pa_pg: number | null;
  hasAdvanced: boolean;
  hasVal: boolean;
  log: ProfileLogRow[];
};

export function bslPlayerToComp(p: BktPlayerSeasonRow, log: BktPlayerLogRow[]): PlayerCompStats {
  return {
    key: "bsl", label: COMP_META.bsl.label, logo: COMP_META.bsl.logo,
    seasonLabel: p.season_label, teamName: p.team_name,
    games: p.games, mpg: p.mpg, ppg: p.ppg, rpg: p.rpg, apg: p.apg,
    spg: p.spg, bpg: p.bpg, fg3m_pg: p.fg3m_pg, val_pg: null,
    fg_pct: p.fg_pct, fg2_pct: p.fg2_pct, fg3_pct: p.fg3_pct, ft_pct: p.ft_pct,
    efg_pct: p.efg_pct, ts_pct: p.ts_pct,
    usage_pct: p.usage_pct, pts_per36: p.pts_per36, reb_per36: p.reb_per36, ast_per36: p.ast_per36,
    pra_pg: p.pra_pg, pa_pg: p.pa_pg,
    hasAdvanced: true, hasVal: false,
    log: log.map((m) => ({
      key: m.match_key + m.match_date, date: m.match_date, home_away: m.home_away,
      team_name: m.team_name, team_slug: m.team_slug,
      opponent: m.opponent_name, opponent_slug: m.opponent_slug,
      minutes: m.minutes, points: m.points, treb: m.treb, assists: m.assists,
      fg3m: m.fg3m, steals: m.steals, blocks: m.blocks, ts_pct: m.ts_pct, valuation: null,
    })),
  };
}

export function euroSeasonToComp(s: BktEuroSeasonRow, logs: BktEuroLogRow[]): PlayerCompStats {
  const key = euroCompKey(s.competition);
  return {
    key, label: COMP_META[key].label, logo: COMP_META[key].logo,
    seasonLabel: s.season_label, teamName: s.team_name,
    games: s.games, mpg: s.mpg, ppg: s.ppg, rpg: s.rpg, apg: s.apg,
    spg: s.spg, bpg: s.bpg, fg3m_pg: s.fg3m_pg, val_pg: s.val_pg,
    fg_pct: s.fg_pct, fg2_pct: s.fg2_pct, fg3_pct: s.fg3_pct, ft_pct: s.ft_pct,
    efg_pct: null, ts_pct: s.ts_pct,
    usage_pct: null, pts_per36: null, reb_per36: null, ast_per36: null, pra_pg: null, pa_pg: null,
    hasAdvanced: false, hasVal: true,
    log: logs.filter((m) => m.competition === s.competition).map((m) => ({
      key: String(m.game_code), date: m.game_date, home_away: m.home_away,
      team_name: m.team_name, team_crest: m.crest_url,
      opponent: m.opponent_name, opponent_slug: null,
      minutes: m.minutes, points: m.points, treb: m.treb, assists: m.assists,
      fg3m: m.fg3m, steals: m.steals, blocks: m.blocks, ts_pct: null, valuation: m.valuation,
    })),
  };
}

/* ---------------- Team ---------------- */
export type TeamRosterRow = {
  key: string;
  name: string;
  href: string;
  position?: string | null;   // BSL ham pozisyon (G|GF|F|FC|C)
  role?: string | null;       // rol etiketi (starter|rotation|limited|garbage|departed)
  photoUrl?: string | null;   // oyuncu fotografi (BSL sofa / EL/EC headshot)
  games: number;
  mpg: number | null; ppg: number | null; rpg: number | null; apg: number | null; val: number | null;
};

export type TeamCompStats = {
  key: CompKey;
  label: string;
  logo: string;
  seasonLabel: string;
  games: number; wins: number; losses: number;
  ppg: number | null; oppg: number | null; point_diff: number | null;
  rpg: number | null; apg: number | null;
  off_rtg: number | null; def_rtg: number | null; net_rtg: number | null; pace: number | null;
  fg_pct: number | null; fg3_pct: number | null; efg_pct: number | null;
  hasVal: boolean;
  roster: TeamRosterRow[];
  results: { key: string; date: string | null; home_away: string | null; opponent: string | null; opponent_slug?: string | null; result: string | null; points: number | null; opp_points: number | null }[];
};

export function bslTeamToComp(t: BktTeamSeasonRow, log: BktTeamLogRow[], roster: BktPlayerSeasonRow[]): TeamCompStats {
  return {
    key: "bsl", label: COMP_META.bsl.label, logo: COMP_META.bsl.logo, seasonLabel: t.season_label,
    games: t.games, wins: t.wins, losses: t.losses,
    ppg: t.ppg, oppg: t.oppg, point_diff: t.point_diff, rpg: t.rpg, apg: t.apg,
    off_rtg: t.off_rtg, def_rtg: t.def_rtg, net_rtg: t.net_rtg, pace: t.pace,
    fg_pct: t.fg_pct, fg3_pct: t.fg3_pct, efg_pct: t.efg_pct,
    hasVal: false,
    roster: roster.map((p) => ({
      key: p.player_slug, name: p.player_name, href: `/dashboard/basketball/player/${p.player_slug}`,
      position: p.position ?? null, role: p.role ?? null,
      photoUrl: playerPhotoUrl({ sofascore_player_id: p.sofascore_player_id, image_url: p.image_url }),
      games: p.games, mpg: p.mpg, ppg: p.ppg, rpg: p.rpg, apg: p.apg, val: null,
    })),
    results: log.map((m) => ({
      key: m.match_key + m.match_date, date: m.match_date, home_away: m.home_away,
      opponent: m.opponent_name, opponent_slug: m.opponent_slug, result: m.result, points: m.points, opp_points: m.opp_points,
    })),
  };
}
