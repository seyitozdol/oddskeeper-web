// Sayı modelinin sezon ağırlığı: geçen sezon % + bu sezon % (Config > Model).
//
// PM Pts Model (hub) ve Match-Player Tools maç sayıları aynı girdiyi kullanır: takımın
// attığı / yediği sayı ortalaması ve std'si iki sezonun ağırlıklı karışımıdır.
// Bu sezon %100 = yalnız güncel sezon verisi. Bir sezonu eksik olan takım (yeni çıkan,
// ya da henüz maçı olmayan) elindeki tek sezonla hesaplanır.

import type { BktHomeAwaySplitRow } from "./types";

export const SEASON_W_PREV_KEY = "points_season_w_prev";
export const SEASON_W_CUR_KEY = "points_season_w_cur";

export type SeasonWeights = { prev: number; cur: number };
export const SEASON_W_DEFAULT: SeasonWeights = { prev: 100, cur: 0 };

// both = iki sezon da var (ağırlıklar aynen uygulanır); current / previous = tek sezon var.
export type SeasonBlendSource = "both" | "current" | "previous" | "none";
export type BlendedSplitRow = BktHomeAwaySplitRow & { blend: SeasonBlendSource };

export function previousSeason(season: string): string {
  const start = Number(season.slice(0, 4));
  return `${start - 1}-${start}`;
}

// Güncel sezonun payı (0..1); ağırlıklar toplamına göre normalize edilir.
export function currentShare(w: SeasonWeights): number {
  const p = Math.max(0, Number(w.prev) || 0);
  const c = Math.max(0, Number(w.cur) || 0);
  return p + c > 0 ? c / (p + c) : 0;
}

// Ekranda gösterilen yüzdeler (toplam 100).
export function seasonPercents(w: SeasonWeights): SeasonWeights {
  const cur = Math.round(currentShare(w) * 100);
  return { prev: 100 - cur, cur };
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export function blendSeasonSplits(
  participants: { team_slug: string; team_name: string | null }[],
  cur: BktHomeAwaySplitRow[],
  prev: BktHomeAwaySplitRow[],
  weights: SeasonWeights,
): BlendedSplitRow[] {
  const share = currentShare(weights);
  const curBy = new Map(cur.filter((r) => Number(r.games) > 0).map((r) => [r.team_slug, r]));
  const prevBy = new Map(prev.filter((r) => Number(r.games) > 0).map((r) => [r.team_slug, r]));
  // Bir tarafta değer yoksa diğeri kullanılır (ör. henüz iç saha maçı olmayan takım).
  const mix = (c: number | null, p: number | null): number | null =>
    c != null && p != null ? round2(share * c + (1 - share) * p) : c ?? p;
  // Tek maçla std hesaplanamaz (0 / boş gelir) → o sezon yok sayılır.
  const std = (v: number | string | null | undefined) => { const n = num(v); return n != null && n > 0 ? n : null; };

  return participants.map((team) => {
    const c = curBy.get(team.team_slug);
    const p = prevBy.get(team.team_slug);
    const base = c ?? p;
    const team_name = team.team_name ?? base?.team_name ?? team.team_slug;
    if (!base) {
      return {
        team_slug: team.team_slug, team_name, games: 0, ppg: 0, oppg: 0,
        home_pf: null, home_pa: null, away_pf: null, away_pa: null, home_pf_std: null, away_pf_std: null, pf_std: null,
        blend: "none",
      };
    }
    return {
      ...base,
      team_name,
      games: Number(c?.games ?? 0) + Number(p?.games ?? 0),
      ppg: mix(num(c?.ppg), num(p?.ppg)) ?? 0,
      oppg: mix(num(c?.oppg), num(p?.oppg)) ?? 0,
      home_pf: mix(num(c?.home_pf), num(p?.home_pf)),
      home_pa: mix(num(c?.home_pa), num(p?.home_pa)),
      away_pf: mix(num(c?.away_pf), num(p?.away_pf)),
      away_pa: mix(num(c?.away_pa), num(p?.away_pa)),
      home_pf_std: mix(std(c?.home_pf_std), std(p?.home_pf_std)),
      away_pf_std: mix(std(c?.away_pf_std), std(p?.away_pf_std)),
      pf_std: mix(std(c?.pf_std), std(p?.pf_std)),
      blend: c && p ? "both" : c ? "current" : "previous",
    };
  });
}

// Lig sayı ortalaması: takımların (karışmış) attığı sayı ortalamalarının ortalaması.
export function leagueAvgPpg(rows: { ppg: number | null }[]): number {
  const v = rows.map((r) => Number(r.ppg ?? 0)).filter((x) => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 80;
}
