import { createClient } from "@/lib/supabase/server";
import type { UpcomingEventRow } from "../types";
import { getTeamHrefResolver } from "./teamLinks";

// upcoming_events_v1 ham satırı (href'ler henüz eklenmemiş).
type RawRow = Omit<UpcomingEventRow, "home_team_href" | "away_team_href">;

// select("*") daraltması (C-2 Faz 3): RawRow alanlarıyla birebir aynı tutulur;
// bets10_event_id (Bets10 fixture id) SB Manager derin linki için çekilir
// (tradingtools fixture-v2/<id>); rozet linkleri *_event_url ile kurulur.
const RAW_ROW_COLS =
  "event_id, sport, category_name, tournament_name, season_name, round_info, " +
  "home_team_id, home_team_name, home_team_country, home_team_national, " +
  "away_team_id, away_team_name, away_team_country, away_team_national, " +
  "gender, start_ts, status_type, status_desc, home_score, away_score, " +
  "event_slug, updated_at, bet365_has_odds, bet365_market_count, bet365_listed, " +
  "bets10_has_odds, bets10_market_count, bets10_listed, oddsportal_has_odds, " +
  "oddsportal_market_count, oddsportal_listed, bmbets_has_odds, " +
  "bmbets_market_count, bmbets_listed, bet365_event_url, bets10_event_id, bets10_event_url, " +
  "oddsportal_event_url, bmbets_event_url";

// Aynı maç iki farklı SofaScore event_id ile gelebilir (özellikle hazırlık
// maçları iki federasyon/kategori altında listelenir). Bu ikinci kayıt SAATİ
// de 30 dk kayık olabilir (ör. 19:00 vs 19:30), o yüzden anahtar tam başlangıç
// anını DEĞİL, takım çifti + takvim gününü kullanır. İki ayrı bacak (ev-deplasman
// rövanş) farklı gün + farklı ev/deplasman sırası olduğundan karışmaz. Oran
// bilgisi en zengin olan kayıt tutulur.
function dedupeKey(e: RawRow): string {
  const home = e.home_team_id ?? e.home_team_name;
  const away = e.away_team_id ?? e.away_team_name;
  const day = e.start_ts.slice(0, 10); // ISO gün (dk farkını yok sayar)
  return `${home}|${away}|${day}`;
}

function dedupe(rows: RawRow[]): RawRow[] {
  const oddsScore = (e: RawRow) =>
    (e.bet365_has_odds ? 1 : 0) +
    (e.bets10_has_odds ? 1 : 0) +
    (e.oddsportal_has_odds ? 1 : 0) +
    (e.bmbets_has_odds ? 1 : 0) +
    Math.sign(
      e.bet365_market_count +
        e.bets10_market_count +
        e.oddsportal_market_count +
        e.bmbets_market_count
    );

  const best = new Map<string, RawRow>();
  for (const e of rows) {
    const key = dedupeKey(e);
    const prev = best.get(key);
    if (
      !prev ||
      oddsScore(e) > oddsScore(prev) ||
      (oddsScore(e) === oddsScore(prev) && e.event_id < prev.event_id)
    ) {
      best.set(key, e);
    }
  }
  // start_ts sırası korunur (kaynak zaten sıralı geldi).
  return rows.filter((e) => best.get(dedupeKey(e)) === e);
}

export async function getUpcomingEvents(): Promise<UpcomingEventRow[]> {
  const supabase = await createClient();

  const [{ data, error }, teamHref] = await Promise.all([
    supabase
      .schema("analytics")
      .from("upcoming_events_v1")
      .select(RAW_ROW_COLS)
      .order("start_ts", { ascending: true })
      .limit(500)
      .returns<RawRow[]>(),
    getTeamHrefResolver(),
  ]);

  if (error) {
    console.error("getUpcomingEvents error:", error.message);
    return [];
  }

  return dedupe(data ?? []).map((e) => ({
    ...e,
    home_team_href: teamHref(e.sport, e.home_team_id),
    away_team_href: teamHref(e.sport, e.away_team_id),
  }));
}
