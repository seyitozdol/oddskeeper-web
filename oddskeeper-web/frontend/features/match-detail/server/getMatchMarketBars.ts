import { createClient } from "../../../lib/supabase/server";
import type { ShowcaseVsRow } from "../../../components/showcase/ShowcaseCharts";

// Mac-detay ekraninin 10 takim-market kiyasi (Teams sekmesindeki ana marketler):
// Shot / SOT / Corner / Saves / Tackle / Throw-in / Goal Kick / Foul / Card /
// Offside. Kaynak: analytics.match_team_stats_v1 (SofaScore takim-mac scrape'i),
// source_match_id + source_team_id ile ev/deplasman eslenir. Veri yoksa bos dizi
// doner (tarihsel TSL maclarinda SofaScore takim stat'i olmayabilir).

type Vals = {
  shots: number | null;
  sot: number | null;
  corners: number | null;
  saves: number | null;
  tackles: number | null;
  throws: number | null;
  goalKicks: number | null;
  fouls: number | null;
  cards: number | null;
  offsides: number | null;
};

const n = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

// yellow + red toplam kart (kirmizi 1 sayilir; MSM "Card" pazariyla ayni mantik).
const cardTotal = (y: unknown, r: unknown): number | null => {
  const yy = n(y);
  const rr = n(r);
  if (yy === null && rr === null) return null;
  return (yy ?? 0) + (rr ?? 0);
};

export async function getMatchMarketBars(
  matchId: string,
  homeId: string,
  awayId: string,
  tr: boolean
): Promise<ShowcaseVsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("match_team_stats_v1")
    .select(
      "source_team_id, summary_shots, summary_shots_on_target, summary_corners_won, summary_saves, summary_tackles, details_total_throws, details_goal_kicks, summary_fouls_conceded, summary_yellow_cards, summary_red_cards, summary_offsides"
    )
    .eq("source_match_id", matchId);
  if (error || !data || data.length === 0) return [];

  const bySide = (teamId: string): Vals | null => {
    const row = data.find((r) => String(r.source_team_id) === teamId);
    if (!row) return null;
    return {
      shots: n(row.summary_shots),
      sot: n(row.summary_shots_on_target),
      corners: n(row.summary_corners_won),
      saves: n(row.summary_saves),
      tackles: n(row.summary_tackles),
      throws: n(row.details_total_throws),
      goalKicks: n(row.details_goal_kicks),
      fouls: n(row.summary_fouls_conceded),
      cards: cardTotal(row.summary_yellow_cards, row.summary_red_cards),
      offsides: n(row.summary_offsides),
    };
  };

  const home = bySide(homeId);
  const away = bySide(awayId);
  if (!home && !away) return [];

  const defs: { key: keyof Vals; tr: string; en: string }[] = [
    { key: "shots", tr: "Şut", en: "Shots" },
    { key: "sot", tr: "İsabetli şut", en: "On target" },
    { key: "corners", tr: "Korner", en: "Corners" },
    { key: "saves", tr: "Kurtarış", en: "Saves" },
    { key: "tackles", tr: "Müdahale", en: "Tackles" },
    { key: "throws", tr: "Taç", en: "Throw-ins" },
    { key: "goalKicks", tr: "Kale vuruşu", en: "Goal kicks" },
    { key: "fouls", tr: "Faul", en: "Fouls" },
    { key: "cards", tr: "Kart", en: "Cards" },
    { key: "offsides", tr: "Ofsayt", en: "Offsides" },
  ];

  return defs.map((d) => ({
    key: d.key,
    label: tr ? d.tr : d.en,
    home: home ? home[d.key] : null,
    away: away ? away[d.key] : null,
    digits: 0,
  }));
}
