import { createClient } from "../../../lib/supabase/server";
import { toNum } from "../lib";

// Avrupa kupasi League bolumu: yeni UEFA formati (2024/25+). Tek 36-takim lig
// fazi + on elemeler + play-off + eleme braketi. Asama roundInfo'dan cikar
// (football.matches.round_name; lig-fazi maci name bos). Play-off iki tur:
// Agustos girisi (lig fazina) vs Subat eleme play-off'u (9-24, R16'ya) — tarihe
// gore ayrilir; Subat play-off'u KULLANICI KARARIYLA braketin ilk turu.
// On eleme + play-off + braket hepsi IKI-AYAKLI TIE olarak eslesir (toplam skor +
// yukselen isareti); beraberlikte son ayagin galibi (uzatma/penalti) yukselir.

const KNOCKOUT_NAMES = new Set(["Round of 16", "Quarterfinals", "Semifinals", "Final"]);
const BRACKET_ORDER: Record<string, number> = {
  "Knockout Play-off": 0,
  "Round of 16": 1,
  Quarterfinals: 2,
  Semifinals: 3,
  Final: 4,
};

export type CupStandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: ("W" | "D" | "L")[];
  zone: "r16" | "playoff" | "out" | null;
};

export type CupMatchLite = {
  matchId: string;
  datetime: string | null;
  homeId: string;
  homeName: string;
  homeLogo: string | null;
  homeScore: number | null;
  awayId: string;
  awayName: string;
  awayLogo: string | null;
  awayScore: number | null;
};

// Elenen takim alt kupaya dustuyse hedef (icon). null = dusmedi/elenmedi.
export type DropDest = "uel" | "uecl" | null;

// Iki-ayakli (ya da tek maclik) eslesme. home/away = ILK ayagin ev/deplasman'i;
// agg ona gore. advanced: hangi taraf turu gecti (yukselen). single: tek mac.
// homeDropped/awayDropped: o taraf elenip alt kupada (UL/Con) goruluyorsa hedef.
export type CupTie = {
  homeId: string;
  homeName: string;
  homeLogo: string | null;
  awayId: string;
  awayName: string;
  awayLogo: string | null;
  legs: CupMatchLite[];
  aggHome: number | null;
  aggAway: number | null;
  advanced: "home" | "away" | null;
  homeDropped: DropDest;
  awayDropped: DropDest;
  single: boolean;
};

export type CupTieRound = { roundName: string; ties: CupTie[] };
export type CupBracketRound = { roundLabel: string; order: number; ties: CupTie[] };

export type CupLeagueBundle = {
  season: string;
  competition: string;
  matchBase: string; // mac detay link koku (tie skorlari tiklanabilir)
  hasLeaguePhase: boolean;
  standings: CupStandingRow[];
  leaguePhaseMatchCount: number;
  qualifying: CupTieRound[];
  playoffEntry: CupTie[];
  bracket: CupBracketRound[];
};

type Row = {
  match_id: string;
  match_datetime: string | null;
  home_team_id: string;
  home_team_name: string | null;
  away_team_id: string;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  round_number: number | null;
  round_name: string | null;
  winner_team_source_id: string | null;
};

async function teamLogos(): Promise<Record<string, string>> {
  const sb = await createClient();
  const { data } = await sb
    .schema("analytics")
    .from("tff1_team_logos_v1")
    .select("team_id, logo_url")
    .limit(2000);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.logo_url) out[String(r.team_id)] = r.logo_url as string;
  return out;
}

export async function loadEurocupLeague(
  competition: string,
  season: string,
  matchBase: string
): Promise<CupLeagueBundle> {
  const sb = await createClient();
  const [{ data }, logos] = await Promise.all([
    sb
      .schema("analytics")
      .from("eurocup_stage_matches_v1")
      .select(
        "match_id, match_datetime, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score, round_number, round_name, winner_team_source_id"
      )
      .eq("competition", competition)
      .eq("season_label", season)
      .limit(2000),
    teamLogos(),
  ]);
  const rows = (data ?? []) as Row[];
  const logo = (id: string) => logos[id] ?? null;

  // Elenip alt kupaya dusen takimlar: takim id'si alt kupanin (UL/Con) ayni sezon
  // verisinde goruluyorsa oraya dusmustur. Yukselen takim ust kupada kaldigindan alt
  // kupada gorulmez -> yalniz elenip dusen isaretlenir. Veri-gudumlu (access-list yok).
  const LOWER: Record<string, { comp: string; dest: DropDest }[]> = {
    "UEFA Şampiyonlar Ligi": [
      { comp: "UEFA Avrupa Ligi", dest: "uel" },
      { comp: "UEFA Konferans Ligi", dest: "uecl" },
    ],
    "UEFA Avrupa Ligi": [{ comp: "UEFA Konferans Ligi", dest: "uecl" }],
    "UEFA Konferans Ligi": [],
  };
  const dropSets: { dest: DropDest; ids: Set<string> }[] = [];
  for (const { comp, dest } of LOWER[competition] ?? []) {
    const { data: lower } = await sb
      .schema("analytics")
      .from("eurocup_stage_matches_v1")
      .select("home_team_id, away_team_id")
      .eq("competition", comp)
      .eq("season_label", season)
      .limit(2000);
    const ids = new Set<string>();
    for (const r of lower ?? []) {
      ids.add(String(r.home_team_id));
      ids.add(String(r.away_team_id));
    }
    dropSets.push({ dest, ids });
  }
  const dropOf = (teamId: string): DropDest => {
    for (const s of dropSets) if (s.ids.has(teamId)) return s.dest;
    return null;
  };
  const toLite = (r: Row): CupMatchLite => ({
    matchId: String(r.match_id),
    datetime: r.match_datetime,
    homeId: String(r.home_team_id),
    homeName: r.home_team_name ?? String(r.home_team_id),
    homeLogo: logo(String(r.home_team_id)),
    homeScore: r.home_score == null ? null : toNum(r.home_score),
    awayId: String(r.away_team_id),
    awayName: r.away_team_name ?? String(r.away_team_id),
    awayLogo: logo(String(r.away_team_id)),
    awayScore: r.away_score == null ? null : toNum(r.away_score),
  });

  // ---- Iki-ayakli tie kur (bir tur icindeki maclardan, takim-cifti anahtariyla) ----
  const buildTies = (rs: Row[]): CupTie[] => {
    const tieMap = new Map<string, Row[]>();
    for (const r of rs) {
      const key = [String(r.home_team_id), String(r.away_team_id)].sort().join("|");
      (tieMap.get(key) ?? tieMap.set(key, []).get(key)!).push(r);
    }
    return [...tieMap.values()].map((legRows) => {
      const legRowsSorted = legRows.slice().sort(byDateRow);
      const legs = legRowsSorted.map(toLite);
      const homeId = legs[0].homeId;
      const awayId = legs[0].awayId;
      let aggHome = 0, aggAway = 0, hasScore = false;
      for (const l of legs) {
        if (l.homeScore == null || l.awayScore == null) continue;
        hasScore = true;
        if (l.homeId === homeId) { aggHome += l.homeScore; aggAway += l.awayScore; }
        else { aggHome += l.awayScore; aggAway += l.homeScore; }
      }
      // yukselen: once toplam skor; berabere ise SON ayagin galibi (uzatma/penalti).
      let advanced: "home" | "away" | null = null;
      if (hasScore) {
        if (aggHome > aggAway) advanced = "home";
        else if (aggAway > aggHome) advanced = "away";
        else {
          const w = legRowsSorted[legRowsSorted.length - 1]?.winner_team_source_id;
          if (w && String(w) === homeId) advanced = "home";
          else if (w && String(w) === awayId) advanced = "away";
        }
      }
      return {
        homeId, homeName: legs[0].homeName, homeLogo: legs[0].homeLogo,
        awayId, awayName: legs[0].awayName, awayLogo: legs[0].awayLogo,
        legs, aggHome: hasScore ? aggHome : null, aggAway: hasScore ? aggAway : null,
        advanced,
        // Dusus ikonu YALNIZ bu tie'i KAYBEDEN tarafta (kazandigi turlarda degil):
        // elenen taraf = advanced'in tersi.
        homeDropped: advanced === "away" ? dropOf(homeId) : null,
        awayDropped: advanced === "home" ? dropOf(awayId) : null,
        single: legs.length === 1,
      };
    });
  };
  // Bir tie'nin en son oynanan ayaginin tarihi (siralama icin).
  const tieLastDate = (t: CupTie): string =>
    t.legs.reduce((mx, l) => (l.datetime && l.datetime > mx ? l.datetime : mx), "");

  // Lig-fazi penceresi: name bos maclarin tarih araligi (play-off ayrimi icin).
  const leagueRows = rows.filter((r) => !r.round_name);
  const leagueStart = leagueRows.reduce<string | null>(
    (min, r) => (r.match_datetime && (!min || r.match_datetime < min) ? r.match_datetime : min),
    null
  );

  type Stage = "qualifying" | "playoff_entry" | "league" | "knockout";
  const stageOf = (r: Row): Stage => {
    const name = r.round_name ?? "";
    if (!name) return "league";
    if (name.startsWith("Qualification")) return "qualifying";
    if (KNOCKOUT_NAMES.has(name)) return "knockout";
    if (name === "Playoff round") {
      if (leagueStart && r.match_datetime && r.match_datetime >= leagueStart) return "knockout";
      return "playoff_entry";
    }
    return "knockout";
  };

  // ---- Lig fazi puan tablosu (yalniz lig-fazi maclarindan) ----
  type Agg = CupStandingRow & { _formByDate: { d: string; res: "W" | "D" | "L" }[] };
  const table = new Map<string, Agg>();
  const ensure = (id: string, name: string): Agg => {
    let a = table.get(id);
    if (!a) {
      a = {
        rank: 0, teamId: id, teamName: name, logo: logo(id), played: 0, wins: 0, draws: 0,
        losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, form: [], zone: null,
        _formByDate: [],
      };
      table.set(id, a);
    }
    return a;
  };
  for (const r of leagueRows) {
    if (r.home_score == null || r.away_score == null) continue;
    const hs = toNum(r.home_score) ?? 0;
    const as = toNum(r.away_score) ?? 0;
    const h = ensure(String(r.home_team_id), r.home_team_name ?? String(r.home_team_id));
    const a = ensure(String(r.away_team_id), r.away_team_name ?? String(r.away_team_id));
    h.played++; a.played++;
    h.goalsFor += hs; h.goalsAgainst += as; a.goalsFor += as; a.goalsAgainst += hs;
    const d = r.match_datetime ?? "";
    if (hs > as) { h.wins++; h.points += 3; a.losses++; h._formByDate.push({ d, res: "W" }); a._formByDate.push({ d, res: "L" }); }
    else if (hs < as) { a.wins++; a.points += 3; h.losses++; a._formByDate.push({ d, res: "W" }); h._formByDate.push({ d, res: "L" }); }
    else { h.draws++; a.draws++; h.points++; a.points++; h._formByDate.push({ d, res: "D" }); a._formByDate.push({ d, res: "D" }); }
  }
  const standings: CupStandingRow[] = [...table.values()]
    .map((a) => {
      a.goalDiff = a.goalsFor - a.goalsAgainst;
      a.form = a._formByDate.sort((x, y) => x.d.localeCompare(y.d)).slice(-5).map((f) => f.res);
      return a;
    })
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName))
    .map((a, i) => {
      const rank = i + 1;
      const zone: CupStandingRow["zone"] = rank <= 8 ? "r16" : rank <= 24 ? "playoff" : "out";
      return { ...a, rank, zone };
    });

  // ---- On elemeler: tur bazli tie'ler, EN YENI TUR/TIE EN USTTE ----
  const qualMap = new Map<string, Row[]>();
  for (const r of rows.filter((x) => stageOf(x) === "qualifying")) {
    const key = r.round_name ?? "—";
    (qualMap.get(key) ?? qualMap.set(key, []).get(key)!).push(r);
  }
  const qualifying: CupTieRound[] = [...qualMap.entries()]
    .map(([roundName, rs]) => {
      const ties = buildTies(rs).sort((a, b) => tieLastDate(b).localeCompare(tieLastDate(a)));
      return { roundName, ties, _last: ties.length ? tieLastDate(ties[0]) : "" };
    })
    .sort((a, b) => b._last.localeCompare(a._last)) // en yeni tur ustte
    .map(({ roundName, ties }) => ({ roundName, ties }));

  // ---- Giris play-off (Agustos): tie'ler ----
  const playoffEntry = buildTies(rows.filter((x) => stageOf(x) === "playoff_entry")).sort(
    (a, b) => tieLastDate(b).localeCompare(tieLastDate(a))
  );

  // ---- Eleme braketi (Subat play-off + R16..Final), soldan saga sirali ----
  const koRows = rows.filter((x) => stageOf(x) === "knockout");
  const roundLabelOf = (r: Row): string =>
    r.round_name === "Playoff round" ? "Knockout Play-off" : r.round_name ?? "—";
  const byRound = new Map<string, Row[]>();
  for (const r of koRows) {
    const lbl = roundLabelOf(r);
    (byRound.get(lbl) ?? byRound.set(lbl, []).get(lbl)!).push(r);
  }
  const bracket: CupBracketRound[] = [...byRound.entries()]
    .map(([roundLabel, rs]) => ({
      roundLabel,
      order: BRACKET_ORDER[roundLabel] ?? 99,
      ties: buildTies(rs),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    season,
    competition,
    matchBase,
    hasLeaguePhase: standings.length > 0,
    standings,
    leaguePhaseMatchCount: leagueRows.length,
    qualifying,
    playoffEntry,
    bracket,
  };
}

function byDateRow(a: Row, b: Row): number {
  return (a.match_datetime ?? "").localeCompare(b.match_datetime ?? "");
}
