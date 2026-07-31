import { createClient } from "@/lib/supabase/server";
import type { UpcomingEventRow } from "../types";
import { superLigTeamSlug } from "../priority";

// upcoming_events_v1 ham satırı (href'ler henüz eklenmemiş).
type RawRow = Omit<UpcomingEventRow, "home_team_href" | "away_team_href">;

const SL_DETAIL_BASE =
  "/dashboard/stats-analysis/football/team-stats/detail?team=";
const TFF1_TEAM_BASE = "/dashboard/tff-1-lig/team/";

// 1. Lig takım sayfası (/dashboard/tff-1-lig/team/<id>) olan SofaScore takım
// id'leri. Kaynak: analytics.tff1_team_season_stats_mat (2026-07-30). Sayfa
// verisi authenticated'a açık olduğundan runtime sorgu yerine sabit tutulur;
// sezon başında 1. Lig kadrosu değişirse buradan güncellenir.
const TFF1_TEAM_IDS = new Set<number>([
  3101, 4952, 77629, 4954, 24750, 3103, 3076, 6366, 24759, 3065, 297102,
  207011, 202391, 3066, 7802, 55625, 6414, 44320, 3091, 202390, 3069, 3080,
  262480, 55603, 3090, 388264, 7032,
]);

// Takımın detay sayfası linki: futbolda Süper Lig -> stats detay,
// 1. Lig -> tff-1-lig; diğer sporlar/eşleşmeyenler için null.
function teamHref(sport: string, teamId: number | null): string | null {
  if (sport !== "football" || teamId == null) return null;
  const slug = superLigTeamSlug(teamId);
  if (slug) return `${SL_DETAIL_BASE}${slug}`;
  if (TFF1_TEAM_IDS.has(teamId)) return `${TFF1_TEAM_BASE}${teamId}`;
  return null;
}

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
    Math.sign(
      e.bet365_market_count + e.bets10_market_count + e.oddsportal_market_count
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

  const { data, error } = await supabase
    .schema("analytics")
    .from("upcoming_events_v1")
    .select("*")
    .order("start_ts", { ascending: true })
    .limit(500)
    .returns<RawRow[]>();

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
