// Model export gecmisi: ortak tipler + tarayici tarafi yardimcilar.
// Match/Player Stats Model ve basketbol/voleybol araclari bunu paylasir.
// Tablo yalnizca service role erisimine acik (bkz.
// sql/2026-08-08_model_export_history.sql); tum erisim /api/model-history.

// Hangi arac. Her yuzey kendi sabitini gecer.
export type HistorySport =
  | "football_msm"
  | "football_psm"
  | "basketball"
  | "volleyball";

// Sunucudan donen bir gecmis kaydi. snapshot serbest bicimlidir; her yuzey
// kendi restore sekliyle yorumlar.
export type ModelHistoryRecord = {
  id: string;
  sport: HistorySport;
  league: string;
  kind: string;
  fixtureExtId: string | null;
  matchLabel: string;
  market: string;
  authorName: string;
  createdAt: string;
  snapshot: unknown;
  // Goruntuleyen bu kaydi silebilir mi (admin veya kaydin sahibi).
  canDelete: boolean;
};

// Export aninda yazilacak bir kayit (id/yazar/tarih server tarafinda eklenir).
export type ModelHistoryDraft = {
  kind?: string;
  fixtureExtId?: string | null;
  matchLabel: string;
  market: string;
  snapshot: unknown;
};

// Dropdown etiketi: "Ev - Deplasman - SOT - seoz01 - 08_08_2026".
export function formatHistoryLabel(rec: {
  matchLabel: string;
  market: string;
  authorName: string;
  createdAt: string;
}): string {
  return `${rec.matchLabel} - ${rec.market} - ${rec.authorName} - ${formatHistoryDate(rec.createdAt)}`;
}

// ISO tarihten GG_AA_YYYY (kullanicinin istedigi bicim).
export function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}_${p(d.getMonth() + 1)}_${d.getFullYear()}`;
}

// Verili spor/lig (ve varsa mac) icin son export kayitlarini getirir. matchLabel
// verilirse yalnizca o macin kayitlari doner (fixture secilince o maca ait liste).
export async function fetchModelHistory(
  sport: HistorySport,
  league: string,
  limit = 50,
  matchLabel?: string
): Promise<ModelHistoryRecord[]> {
  const params: Record<string, string> = { sport, league, limit: String(limit) };
  if (matchLabel) params.match = matchLabel;
  const qs = new URLSearchParams(params);
  const res = await fetch(`/api/model-history?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { records?: ModelHistoryRecord[] };
  return data.records ?? [];
}

// Bir gecmis kaydini siler (yetki server tarafinda: admin veya kaydin sahibi).
export async function deleteModelHistory(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/model-history?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Export dosya adi: "Fixture ismi_8_8_2026_16_57" (sorunlu karakter yok).
export function exportFileName(label: string, now: Date = new Date()): string {
  const clean = (label || "input")
    .replace(/[\\/:*?"<>|.]+/g, "")
    .replace(/\s+/g, " ")
    .trim() || "input";
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getDate()}_${now.getMonth() + 1}_${now.getFullYear()}_${p(now.getHours())}_${p(now.getMinutes())}`;
  return `${clean}_${stamp}`;
}

// Export aninda cagrilir: kayitlari yazar, ardindan sunucu eski kayitlari siler.
export async function postModelHistory(
  sport: HistorySport,
  league: string,
  entries: ModelHistoryDraft[]
): Promise<boolean> {
  if (entries.length === 0) return true;
  try {
    const res = await fetch(`/api/model-history`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sport, league, entries }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Config sekmesi: saklama suresini (gun) getir.
export async function fetchRetention(
  sport: HistorySport,
  league: string
): Promise<number> {
  const qs = new URLSearchParams({ sport, league, config: "1" });
  const res = await fetch(`/api/model-history?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return 30;
  const data = (await res.json()) as { retentionDays?: number };
  return data.retentionDays ?? 30;
}

// Config sekmesi: saklama suresini (gun) kaydet.
export async function saveRetention(
  sport: HistorySport,
  league: string,
  retentionDays: number
): Promise<boolean> {
  try {
    const res = await fetch(`/api/model-history`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sport, league, retentionDays }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// MSM: "eksik line'lari SU'la" bayragini getir (sadece football_msm).
export async function fetchMsmSuspend(league: string): Promise<boolean> {
  const qs = new URLSearchParams({ sport: "football_msm", league, config: "1" });
  const res = await fetch(`/api/model-history?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { msmSuspendMissing?: boolean };
  return data.msmSuspendMissing === true;
}

// MSM: "eksik line'lari SU'la" bayragini kaydet.
export async function saveMsmSuspend(
  league: string,
  value: boolean
): Promise<boolean> {
  try {
    const res = await fetch(`/api/model-history`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sport: "football_msm", league, msmSuspendMissing: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
