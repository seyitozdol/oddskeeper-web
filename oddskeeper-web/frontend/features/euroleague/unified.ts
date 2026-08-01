// EuroLeader/EuroPlayerLog -> basketball PlayerCompStats (birleşik profil için).
import type { PlayerCompStats } from "@/features/basketball/unified";
import { COMP_META, euroCompKey } from "@/features/basketball/unified";
import type { EuroLeaderRow, EuroPlayerLogRow } from "./types";

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
