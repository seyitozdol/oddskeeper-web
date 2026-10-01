// Turkiye A Milli Futbol Takimi (header "TR", kaynak "trnat") veri saglayicisi.
// Kupa fabrikasini (eurocupData.makeCupProvider) trnat_* view'lariyla yeniden
// kullanir; uc fark:
//   - sezon = turnuva baskisi anahtari ('<ut>-<sezon id>') ya da "all";
//   - puan durumu maclardan hesaplanmaz, SofaScore grup tablosundan okunur
//     (elimizde yalniz Turkiye + yaklasan rakiplerin maclari var);
//   - yaklasan maclar baskidan bagimsiz (Turkiye'nin siradaki fiksturu).
// View'lar: sql/2026-10-01_national_team_views.sql.
import { cache } from "react";
import { createClient } from "../../../lib/supabase/server";
import { toNum } from "../lib";
import type { FormResult, TslMatch, TslStandingRow, TslTeamMeta } from "../types";
import type { ZoneKey } from "../standingsZones";
import { TRNAT_ALL_SEASON } from "../leagues";
import { makeCupProvider } from "./eurocupData";

// Turkiye A Milli (erkek) SofaScore takim id'si.
export const TR_TEAM_ID = "4700";

export type NationalEdition = {
  key: string;
  competition: string;
  nameEn: string;
  nameTr: string;
  labelEn: string;
  labelTr: string;
  played: number;
  upcoming: number;
  lastMatch: string | null;
  nextFixture: string | null;
};

// Turkiye'nin yer aldigi baskilar, en yeni ustte (son oynanan maca gore; hic
// maci oynanmamis yeni baski ilk fikstur tarihine gore siralanir).
export const getNationalEditions = cache(async (): Promise<NationalEdition[]> => {
  const sb = await createClient();
  const { data, error } = await sb
    .schema("analytics")
    .from("trnat_editions_v1")
    .select("edition_key, competition, name_en, name_tr, label_en, label_tr, played, upcoming, last_match, next_fixture")
    .limit(100);
  if (error) throw new Error(`trnat_editions_v1: ${error.message}`);
  const rows: NationalEdition[] = (data ?? []).map((r) => ({
    key: String(r.edition_key),
    competition: r.competition,
    nameEn: r.name_en,
    nameTr: r.name_tr,
    labelEn: String(r.label_en ?? "").trim(),
    labelTr: String(r.label_tr ?? "").trim(),
    played: toNum(r.played) ?? 0,
    upcoming: toNum(r.upcoming) ?? 0,
    lastMatch: r.last_match ?? null,
    nextFixture: r.next_fixture ?? null,
  }));
  const sortKey = (e: NationalEdition) => e.lastMatch ?? e.nextFixture ?? "";
  return rows.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
});

// Guncel baski: en son maci oynanan turnuva. Turnuva bitince, yenisinin ilk
// maci oynanana kadar bu kalir (sahip kurali). Hic mac yoksa ilk fiksturlu baski.
export function currentEdition(editions: NationalEdition[]): NationalEdition | null {
  const started = editions.filter((e) => e.played > 0);
  if (started.length) return started[0];
  const next = editions
    .filter((e) => e.nextFixture)
    .sort((a, b) => (a.nextFixture ?? "").localeCompare(b.nextFixture ?? ""));
  return next[0] ?? null;
}

// "all" ise guncel baskiya coz (grup tablosu tek bir baskiya aittir).
export async function resolveEditionKey(season: string): Promise<string | null> {
  if (season !== TRNAT_ALL_SEASON) return season;
  return currentEdition(await getNationalEditions())?.key ?? null;
}

// SofaScore "promotion" metni -> puan durumu bolge rengi.
function zoneForNote(note: string | null): ZoneKey | null {
  if (!note) return null;
  const n = note.toLowerCase();
  if (n.includes("relegation") && n.includes("playoff")) return "natRelegationPlayoff";
  if (n.includes("relegation")) return "relegation";
  if (n.includes("promotion") && n.includes("playoff")) return "playoff";
  if (n.includes("playoff")) return "playoff";
  if (n.includes("promotion") || n.includes("qualif") || n.includes("champion")) return "natQualified";
  return null;
}

export type NationalGroup = {
  editionKey: string | null;
  groupName: string | null;
  rows: TslStandingRow[];
  zoneByTeamId: Record<string, ZoneKey | null>;
};

// Baskinin (Turkiye'yi iceren) grup tablosu. Form sutunu yalniz macinin TAMAMI
// elimizde olan takimlar icin dolar (Turkiye + gecmisi yuklu rakipler); eksik
// veriyle yaniltici form gostermemek icin digerleri bos kalir.
export const getNationalGroup = cache(
  async (editionKey: string | null, meta: Record<string, TslTeamMeta>): Promise<NationalGroup> => {
    if (!editionKey) return { editionKey, groupName: null, rows: [], zoneByTeamId: {} };
    const sb = await createClient();
    const [{ data, error }, { data: ms, error: mErr }] = await Promise.all([
      sb
        .schema("analytics")
        .from("trnat_standings_v1")
        .select("group_name, position, team_id, team_name, played, wins, draws, losses, goals_for, goals_against, points, note")
        .eq("edition_key", editionKey)
        .order("position", { ascending: true })
        .limit(40),
      sb
        .schema("analytics")
        .from("natl_stage_matches_v1")
        .select("match_datetime, home_team_id, away_team_id, home_score, away_score, round_name")
        .eq("edition_key", editionKey)
        .not("home_score", "is", null)
        .order("match_datetime", { ascending: true })
        .limit(1000),
    ]);
    if (error) throw new Error(`trnat_standings_v1: ${error.message}`);
    if (mErr) throw new Error(`natl_stage_matches_v1: ${mErr.message}`);

    const ids = new Set((data ?? []).map((r) => String(r.team_id)));
    // Yalniz grup ici maclar (iki taraf da grupta, eleme turu degil).
    const formBy = new Map<string, FormResult[]>();
    for (const m of ms ?? []) {
      const h = String(m.home_team_id);
      const a = String(m.away_team_id);
      if (!ids.has(h) || !ids.has(a) || m.round_name) continue;
      const hs = toNum(m.home_score) ?? 0;
      const as = toNum(m.away_score) ?? 0;
      if (!formBy.has(h)) formBy.set(h, []);
      if (!formBy.has(a)) formBy.set(a, []);
      formBy.get(h)!.push(hs > as ? "W" : hs < as ? "L" : "D");
      formBy.get(a)!.push(as > hs ? "W" : as < hs ? "L" : "D");
    }

    const zoneByTeamId: Record<string, ZoneKey | null> = {};
    const rows: TslStandingRow[] = (data ?? []).map((r) => {
      const id = String(r.team_id);
      const played = toNum(r.played) ?? 0;
      const gf = toNum(r.goals_for) ?? 0;
      const ga = toNum(r.goals_against) ?? 0;
      const points = toNum(r.points) ?? 0;
      const form = formBy.get(id) ?? [];
      zoneByTeamId[id] = zoneForNote(r.note ?? null);
      return {
        rank: toNum(r.position) ?? 0,
        teamId: id,
        teamName: meta[id]?.name ?? r.team_name ?? id,
        logo: meta[id]?.logo ?? null,
        played,
        wins: toNum(r.wins) ?? 0,
        draws: toNum(r.draws) ?? 0,
        losses: toNum(r.losses) ?? 0,
        goalsFor: gf,
        goalsAgainst: ga,
        goalDiff: gf - ga,
        points,
        ppg: played > 0 ? points / played : 0,
        form: form.length === played ? form : [],
        attackLabel: null,
        defenceLabel: null,
        formLabel: null,
        strongestLabel: null,
        strongestPct: null,
        weakestLabel: null,
        weakestPct: null,
      };
    });
    // SofaScore bazi baskilarda grup adinin basina sezon adini ekler
    // ("UEFA Nations League 26/27, League A, Group 1"); baslikta zaten var, kirp.
    const rawGroup: string | null = (data ?? [])[0]?.group_name ?? null;
    const groupName = rawGroup ? rawGroup.replace(/^.*?(?:\d{2}\/\d{2}|\d{4}),\s*/, "") : null;
    return { editionKey, groupName, rows, zoneByTeamId };
  }
);

// Baskidaki Turkiye maclarinin asama etiketi (mac id -> 'Round of 16' ...; grup
// maclarinda bos). Tournaments sekmesi mac satirinda gosterir.
export async function getNationalMatchStages(editionKey: string): Promise<Record<string, string>> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema("analytics")
    .from("trnat_matches_v1")
    .select("match_id, round_name")
    .eq("season_label", editionKey)
    .limit(200);
  if (error) throw new Error(`trnat_matches_v1: ${error.message}`);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.round_name) out[String(r.match_id)] = String(r.round_name);
  return out;
}

export function makeNationalProvider(competition: string, prefix: string) {
  const base = makeCupProvider(competition, prefix);

  async function upcoming(_season: string, meta: Record<string, TslTeamMeta>): Promise<TslMatch[]> {
    const sb = await createClient();
    const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { data, error } = await sb
      .schema("analytics")
      .from(`${prefix}_fixtures_v1`)
      .select("fixture_id, fixture_datetime, home_team_id, home_team_name, away_team_id, away_team_name, fixture_status")
      .gte("fixture_datetime", cutoff)
      .order("fixture_datetime", { ascending: true })
      .limit(40);
    if (error) throw new Error(`${prefix}_fixtures_v1: ${error.message}`);
    return (data ?? [])
      .filter((r) => !["completed", "finished", "cancelled"].includes((r.fixture_status ?? "").toLowerCase()))
      .map((r) => {
        const h = String(r.home_team_id);
        const a = String(r.away_team_id);
        return {
          matchId: String(r.fixture_id),
          datetime: r.fixture_datetime,
          homeId: h,
          awayId: a,
          homeName: meta[h]?.name ?? r.home_team_name ?? h,
          awayName: meta[a]?.name ?? r.away_team_name ?? a,
          homeLogo: meta[h]?.logo ?? null,
          awayLogo: meta[a]?.logo ?? null,
          homeScore: -1,
          awayScore: -1,
        };
      });
  }

  async function standings(season: string, meta: Record<string, TslTeamMeta>): Promise<TslStandingRow[]> {
    return (await getNationalGroup(await resolveEditionKey(season), meta)).rows;
  }

  return {
    ...base,
    upcoming,
    standings: (s: string, meta: Record<string, TslTeamMeta>) => standings(s, meta),
    // Teams / Team Rankings sekmeleri milli takimda yok.
    teamMetrics: () => Promise.resolve([]),
    teamLeaderboard: () => Promise.resolve([]),
  };
}
