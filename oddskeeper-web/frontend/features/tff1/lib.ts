import type { Tff1PlayerRow } from "./types";

// FlashScore pozisyon adi -> TR etiket; fallback sofascore kodu (G/D/M/F)
const FS_POSITION_TR: Record<string, string> = {
  Goalkeeper: "Kaleci",
  "Centre back": "Stoper",
  Fullback: "Bek",
  "Defensive midfielder": "Ön libero",
  Midfielder: "Orta saha",
  "Attacking midfielder": "On numara",
  Winger: "Kanat",
  Wingback: "Kanat bek",
  Striker: "Santrfor",
  Forward: "Forvet",
  Defender: "Defans",
};

const FS_POSITION_EN: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  "Centre back": "Centre back",
  Fullback: "Fullback",
  "Defensive midfielder": "Defensive mid.",
  Midfielder: "Midfielder",
  "Attacking midfielder": "Attacking mid.",
  Winger: "Winger",
  Striker: "Striker",
  Forward: "Forward",
};

const CODE_POSITION: Record<string, { tr: string; en: string }> = {
  G: { tr: "Kaleci", en: "Goalkeeper" },
  D: { tr: "Defans", en: "Defender" },
  M: { tr: "Orta saha", en: "Midfielder" },
  F: { tr: "Forvet", en: "Forward" },
};

export function positionLabel(row: Tff1PlayerRow, locale: string): string {
  if (row.fs_position) {
    const map = locale === "tr" ? FS_POSITION_TR : FS_POSITION_EN;
    if (map[row.fs_position]) return map[row.fs_position];
    return row.fs_position;
  }
  const byCode = row.position_code ? CODE_POSITION[row.position_code] : null;
  if (byCode) return locale === "tr" ? byCode.tr : byCode.en;
  return row.position_code ?? "—";
}

export type SquadRole = "starter" | "rotation" | "backup" | "unused";

// Takimin o sezonki mac sayisina gore kadro rolu
export function squadRole(row: Tff1PlayerRow, teamPlayed: number): SquadRole {
  const starts = row.starts ?? 0;
  const apps = row.appearances ?? 0;
  const minutes = row.minutes ?? 0;
  if (teamPlayed > 0 && starts >= teamPlayed * 0.5) return "starter";
  if (teamPlayed > 0 && (minutes >= teamPlayed * 90 * 0.25 || apps >= teamPlayed * 0.4)) {
    return "rotation";
  }
  if (apps > 0) return "backup";
  return "unused";
}

export const ROLE_LABEL_KEYS: Record<SquadRole, string> = {
  starter: "tff1.roleStarter",
  rotation: "tff1.roleRotation",
  backup: "tff1.roleBackup",
  unused: "tff1.roleUnused",
};

export const ROLE_CHIP_CLASS: Record<SquadRole, string> = {
  starter: "border-line-strong bg-card-2 text-ink",
  rotation: "border-line bg-veil text-ink-2",
  backup: "border-line bg-veil text-ink-3",
  unused: "border-line bg-veil text-ink-3",
};

export function formatMarketValue(eur: number | null | undefined): string {
  if (!eur) return "—";
  if (eur >= 1_000_000) {
    const m = eur / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  return `€${Math.round(eur / 1000)}K`;
}

export function formatMatchDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function playerAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const beforeBirthday =
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
