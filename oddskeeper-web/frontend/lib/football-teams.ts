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
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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