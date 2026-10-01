"use client";

import { createClient } from "@/lib/supabase/client";

// MSM > Fixture sekmesinde olusturulan manuel fiksturler, PSM bicimiyle.
// Kaynak: analytics.pm_manual_fixtures_v1 (sql/2026-10-01_pm_manual_fixtures.sql);
// uc PSM kopyasi (TSL, 1. Lig, Avrupa kupalari + milli takim) bu tek fonksiyonu kullanir.
//   - fixture_id: uuid'den turetilen sabit NEGATIF sayi (gercek id'lerle cakismaz).
//   - home/away_source_team_id: o ligin PSM kadro anahtari; "" = takim bu ligde yok,
//     o tarafin kadrosu bos gelir.
//   - manualExtId: MSM Fixture sekmesinde girilen fixture id (tek kaynak, PSM'de salt okunur).
// Alanlar uc kopyanin UpcomingFixture tipini de karsilar (TSL'de slug alanlari dahil).
export type ManualPsmFixture = {
  fixture_id: number;
  fixture_date: string;
  fixture_datetime: null;
  round_number: null;
  home_team_name: string;
  away_team_name: string;
  home_source_team_id: string;
  away_source_team_id: string;
  home_team_slug: string;
  away_team_slug: string;
  label: string;
  manual: true;
  manualExtId: string | null;
};

export async function fetchManualPsmFixtures(league: string): Promise<ManualPsmFixture[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("pm_manual_fixtures_v1")
    .select(
      "fixture_id, home_name, away_name, home_slug, away_slug, home_team_key, away_team_key, external_fixture_id, created_at"
    )
    .eq("league", league)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("fetchManualPsmFixtures error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    fixture_id: Number(row.fixture_id),
    fixture_date: "",
    fixture_datetime: null,
    round_number: null,
    home_team_name: row.home_name,
    away_team_name: row.away_name,
    home_source_team_id: row.home_team_key ?? "",
    away_source_team_id: row.away_team_key ?? "",
    home_team_slug: row.home_slug ?? "",
    away_team_slug: row.away_slug ?? "",
    label: `${row.home_name} vs ${row.away_name}`,
    manual: true,
    manualExtId: row.external_fixture_id ?? null,
  }));
}
