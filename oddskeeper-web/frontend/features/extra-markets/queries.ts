"use client";

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_EXTRA_CONFIG, type ExtraConfig } from "./engine";

// Okuma: analytics tablolarindan dogrudan (authenticated select).
// Yazma: /api/extra-markets/write (service-role), msm/write deseni.

function sb() {
  return createClient().schema("analytics");
}

async function write(action: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/extra-markets/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      console.error(`extraMarkets ${action}`, j.error ?? res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`extraMarkets ${action}`, e);
    return false;
  }
}

// Kayitli config'i varsayilanin ustune oturtur: sonradan eklenen alanlar eski kayitta
// yoksa varsayilan degerle gelir.
function mergeConfig(raw: unknown): ExtraConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_EXTRA_CONFIG;
  const c = raw as Partial<ExtraConfig>;
  return {
    ...DEFAULT_EXTRA_CONFIG,
    ...c,
    goalType: { ...DEFAULT_EXTRA_CONFIG.goalType, ...(c.goalType ?? {}) },
  };
}

// Profiles tablosu ligler arasi ORTAK (tek satir). Kayit yoksa Excel'deki varsayilan.
export async function fetchExtraConfig(): Promise<ExtraConfig> {
  const { data, error } = await sb()
    .from("msm_extra_markets_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle<{ config: unknown }>();
  if (error) {
    console.error("fetchExtraConfig", error);
    return DEFAULT_EXTRA_CONFIG;
  }
  return mergeConfig(data?.config);
}

export async function saveExtraConfig(config: ExtraConfig): Promise<boolean> {
  return write("saveConfig", { config });
}

export interface ExtraFixtureChoice {
  profile: string;
  noGoal: number | null;
}

// Mac basina kayitli profil + No Goal. Yalniz ekrandaki maclar sorulur.
export async function fetchExtraFixtureChoices(
  league: string,
  fixtureIds: string[]
): Promise<Record<string, ExtraFixtureChoice>> {
  if (fixtureIds.length === 0) return {};
  const { data, error } = await sb()
    .from("msm_extra_markets_fixtures")
    .select("fixture_id, profile, no_goal")
    .eq("league", league)
    .in("fixture_id", fixtureIds)
    .limit(1000);
  if (error) {
    console.error("fetchExtraFixtureChoices", error);
    return {};
  }
  const out: Record<string, ExtraFixtureChoice> = {};
  for (const r of data ?? []) {
    out[String(r.fixture_id)] = {
      profile: (r.profile as string) ?? "",
      noGoal: r.no_goal != null ? Number(r.no_goal) : null,
    };
  }
  return out;
}

export async function saveExtraFixtureChoices(
  league: string,
  rows: Array<{ fixture_id: string; profile: string; no_goal: number | null }>
): Promise<boolean> {
  return write("saveFixtures", { league, rows });
}
