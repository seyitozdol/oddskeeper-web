import fs from "fs/promises";
import path from "path";

export type FootballTeam = {
  name: string;
  slug: string;
  logoPath: string;
  fileName: string;
};

const FOOTBALL_LOGOS_DIR = path.join(
  process.cwd(),
  "public",
  "images",
  "football_logos"
);

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

function removeExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function slugify(value: string) {
  return value
    // Turkce noktasiz '\u0131' ve '\u0130' NFKD ile cozulmez (\u00e7/\u011f/\u00f6/\u015f/\u00fc cozulur); onlari
    // once 'i'ye katla, yoksa '\u0131' [^a-z0-9] kuralinda '-'e donusuyordu
    // ("Kas\u0131mpa\u015fa" -> "kas-mpasa", takim slug'i "kasimpasa" ile eslesmiyordu).
    .replace(/[\u0131\u0130]/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Tak\u0131m ad\u0131n\u0131 (\u00f6r. "Kayserispor") yerel logo slug'\u0131na \u00e7evirir; ba\u015fka lig
// deneyimlerinin bir tak\u0131m\u0131 slug bazl\u0131 football profiline k\u00f6pr\u00fclemesi i\u00e7in.
export function slugifyTeamName(value: string) {
  return slugify(value);
}

function toDisplayName(baseName: string) {
  return baseName
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getFootballTeams(): Promise<FootballTeam[]> {
  try {
    const files = await fs.readdir(FOOTBALL_LOGOS_DIR);

    return files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return !file.startsWith(".") && ALLOWED_EXTENSIONS.has(ext);
      })
      .map((file) => {
        const baseName = removeExtension(file);

        return {
          name: toDisplayName(baseName),
          slug: slugify(baseName),
          logoPath: `/images/football_logos/${encodeURIComponent(file)}`,
          fileName: file,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("football_logos klasörü okunamadı:", error);
    return [];
  }
}

export async function getFootballTeamBySlug(teamSlug: string) {
  const teams = await getFootballTeams();
  return teams.find((team) => team.slug === teamSlug) ?? null;
}

const FOOTBALL_LOGOS_ARCHIVE_DIR = path.join(
  process.cwd(),
  "public",
  "images",
  "football_logos_archive"
);

// Ligden düşen takımların logoları arşiv klasöründe tutulur; böylece takım
// seçim ızgarası güncel takımlarla sınırlı kalırken sıralama/istatistik
// sayfaları eski takımların logosunu da gösterebilir.
async function getArchiveFootballTeams(): Promise<FootballTeam[]> {
  try {
    const files = await fs.readdir(FOOTBALL_LOGOS_ARCHIVE_DIR);

    return files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return !file.startsWith(".") && ALLOWED_EXTENSIONS.has(ext);
      })
      .map((file) => {
        const baseName = removeExtension(file);

        return {
          name: toDisplayName(baseName),
          slug: slugify(baseName),
          logoPath: `/images/football_logos_archive/${encodeURIComponent(file)}`,
          fileName: file,
        };
      });
  } catch {
    return [];
  }
}

// slug -> logo yolu; güncel klasör önceliklidir.
export async function getAllFootballTeamLogos(): Promise<
  Record<string, string>
> {
  const [current, archive] = await Promise.all([
    getFootballTeams(),
    getArchiveFootballTeams(),
  ]);

  const map: Record<string, string> = {};
  for (const team of archive) {
    map[team.slug] = team.logoPath;
  }
  for (const team of current) {
    map[team.slug] = team.logoPath;
  }
  return map;
}

// Güncel + arşiv birlikte arar (düşen takımların detay sayfaları için).
export async function getAnyFootballTeamBySlug(teamSlug: string) {
  const current = await getFootballTeamBySlug(teamSlug);
  if (current) {
    return current;
  }

  const archive = await getArchiveFootballTeams();
  return archive.find((team) => team.slug === teamSlug) ?? null;
}