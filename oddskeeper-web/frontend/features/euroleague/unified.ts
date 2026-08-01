// EuroLeader/EuroPlayerLog -> basketball PlayerCompStats (birleşik profil için).
import type { PlayerCompStats, TeamCompStats } from "@/features/basketball/unified";
import { COMP_META, euroCompKey, normalizePlayerName } from "@/features/basketball/unified";
import type { EuroLeaderRow, EuroPlayerLogRow, EuroTeamRow, EuroTeamLogRow } from "./types";

export function euroLeaderToComp(s: EuroLeaderRow, logs: EuroPlayerLogRow[]): PlayerCompStats {
  const key = euroCompKey(s.competition);
  return {
    key, label: COMP_META[key].label, logo: COMP_META[key].logo,
    seasonLabel: s.season_label, teamName: s.team_name,
    games: s.games, mpg: s.mpg, ppg: s.ppg, rpg: s.rpg, apg: s.apg,
    spg: s.spg, bpg: s.bpg, fg3m_pg: s.fg3m_pg, val_pg: s.val_pg,
    fg_pct: s.fg_pct, fg2_pct: null, fg3_pct: s.fg3_pct, ft_pct: s.ft_pct,
    efg_pct: null, ts_pct: s.ts_pct,
    usage_pct: null, pts_per36: null, reb_per36: null, ast_per36: null, pra_pg: null, pa_pg: null,
    hasAdvanced: false, hasVal: true,
    log: logs.map((m) => ({
      key: String(m.game_code), date: m.game_date, home_away: m.home_away,
      opponent: m.opponent_name, opponent_slug: null,
      minutes: m.minutes, points: m.points, treb: m.treb, assists: m.assists,
      fg3m: m.fg3m, steals: m.steals, blocks: m.blocks, ts_pct: null, valuation: m.valuation,
    })),
  };
}

export function euroTeamToComp(t: EuroTeamRow, roster: EuroLeaderRow[], log: EuroTeamLogRow[]): TeamCompStats {
  const key = euroCompKey(t.competition);
  return {
    key, label: COMP_META[key].label, logo: COMP_META[key].logo, seasonLabel: t.season_label,
    games: t.games, wins: t.wins, losses: t.losses,
    ppg: t.ppg, oppg: t.oppg, point_diff: t.point_diff, rpg: t.rpg, apg: t.apg,
    off_rtg: t.off_rtg, def_rtg: t.def_rtg, net_rtg: t.net_rtg, pace: t.pace,
    fg_pct: t.fg_pct, fg3_pct: t.fg3_pct, efg_pct: t.efg_pct,
    hasVal: true,
    roster: roster.map((r) => ({
      key: r.person_code,
      name: normalizePlayerName(r.player_name),
      href: r.bsl_player_slug
        ? `/dashboard/basketball/player/${r.bsl_player_slug}`
        : `/dashboard/euro/${key}/player/${r.person_code}`,
      games: r.games, mpg: r.mpg, ppg: r.ppg, rpg: r.rpg, apg: r.apg, val: r.val_pg,
    })),
    results: log.map((m) => ({
      key: String(m.game_code), date: m.game_date, home_away: m.home_away,
      opponent: m.opponent_name, opponent_slug: null, result: m.result, points: m.points, opp_points: m.opp_points,
    })),
  };
}
