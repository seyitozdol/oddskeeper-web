import { slugifyTeamName } from "@/lib/football-teams";
import { sofascoreIdForTeamSlug } from "@/lib/sofascore-team-map";
import {
  getTslLeaderboard,
  getTslPlayerCatalog,
} from "@/features/tsl/server/queries";
import { getPlayerAssets } from "@/features/tsl/server/resmi";
import type { TslLeaderRow, TslMetricOption } from "@/features/tsl/types";

// Takim detayindaki "Player Stats" sekmesi: secili metrik + sezon icin
// takimin oyuncularini liglik leaderboard'dan suzer (Player Rankings ile
// ayni veri, takim-kapsamli). Sezonlar tsl_ss veri sezonlaridir.

export const TEAM_PLAYER_STATS_SEASONS = ["2026/2027", "2025/2026", "2024/2025"];

// Leaderboard takim adi (SofaScore) -> football slug esleme: ad slug'i ya da
// gitgide kisalan on-ekleri (Amed Sportif Faaliyetler -> amed).
function slugMatches(teamName: string | null, teamSlug: string): boolean {
  if (!teamName) return false;
  const base = slugifyTeamName(teamName);
  if (base === teamSlug) return true;
  const parts = base.split("-").filter(Boolean);
  for (let k = parts.length - 1; k >= 1; k--) {
    if (parts.slice(0, k).join("-") === teamSlug) return true;
  }
  return false;
}

// Takim eslesmesi IKI capayla birden yapilir; biri tutmazsa digeri yakalar:
//  1) source_team_id == SofaScore takim id'si (sabit id<->slug haritasindan).
//     tsl_ss ana istatistik satirlari SofaScore sayisal id tasir.
//  2) team_name slug'i (SofaScore ADI ya da on-ek kirpma). tsl_ss kart/xG dali
//     FlashScore takim id'si ( or. dOlaIG4l) + FS ADI ("Kasimpasa") tasir; onlari
//     id yakalayamaz, slug birlestirir. Ikisi birlikte iki kimlik uzayini kapsar.
// KRITIK: slug'daki noktasiz 'ı' hatasi (slugify) buranin sessizce bosalmasina yol
// aciyordu; slugify duzeltildi, ayrica asagida bos-sonuc guard'i var.
function makeTeamMatcher(teamSlug: string): (r: TslLeaderRow) => boolean {
  const wantId = sofascoreIdForTeamSlug(teamSlug);
  return (r) =>
    (wantId != null && r.teamId === wantId) || slugMatches(r.teamName, teamSlug);
}

export type TeamPlayerStatRow = TslLeaderRow & {
  photo: string | null;
  nationality: string | null;
  href: string | null;
};

export type TeamPlayerStatsBundle = {
  season: string;
  seasons: string[];
  catalog: TslMetricOption[];
  metricKey: string;
  metric: TslMetricOption | null;
  rows: TeamPlayerStatRow[];
};

export async function getTeamPlayerStats(
  teamSlug: string,
  requestedSeason?: string | null,
  requestedMetric?: string | null
): Promise<TeamPlayerStatsBundle> {
  const seasons = TEAM_PLAYER_STATS_SEASONS;
  let season = seasons.includes(requestedSeason ?? "")
    ? (requestedSeason as string)
    : seasons[0];

  // includeUnqualified: takim sayfasi kadroyu EKSIKSIZ gostermeli; lig siralamasinin
  // "yeterli dakika" esigi (sezon max dakikasinin %30'u) burada uygulanmaz, yoksa
  // kisa sure oynayan yedekler listeden dusuyor (sezon basinda esik 27 dk idi).
  const load = (s: string, key: string) =>
    getTslLeaderboard(s, key, { includeUnqualified: true });

  // Katalog metrikten bagimsiz; dropdown daima gecerli bir metrik gonderir.
  // Katalogu ve tahmini metrigin leaderboard'unu PARALEL cek: yaygin durumda
  // (gecerli requestedMetric ya da varsayilan) ikinci sorgu gerekmez.
  const guessKey = requestedMetric ?? "goals_total";
  let [catalog, teamRowsAll] = await Promise.all([
    getTslPlayerCatalog(season),
    load(season, guessKey),
  ]);
  if (!catalog.length) catalog = await getTslPlayerCatalog("2025/2026");
  const metric =
    catalog.find((c) => c.metricKey === requestedMetric) ??
    catalog.find((c) => c.metricKey === "goals_total") ??
    catalog[0] ??
    null;
  const metricKey = metric?.metricKey ?? "goals_total";

  // Tahmin tutmadiysa (nadiren: gecersiz/bos metrik) dogru metrikle yeniden cek.
  if (metricKey !== guessKey) teamRowsAll = await load(season, metricKey);

  const matchesTeam = makeTeamMatcher(teamSlug);
  let teamRows = teamRowsAll.filter(matchesTeam);
  // Sezon secilmemisse ve guncel sezonda henuz veri yoksa geriye dus.
  if (!teamRows.length && !requestedSeason) {
    for (const s of seasons.slice(1)) {
      const rows = (await load(s, metricKey)).filter(matchesTeam);
      if (rows.length) {
        season = s;
        teamRows = rows;
        break;
      }
    }
  }

  // Sessiz-bosalma guard'i: leaderboard'da bu sezon/metrik icin satir VAR ama hic
  // biri bu takima eslesmediyse, kimlik/slug eslesmesi kirilmis demektir (Kasimpasa
  // 'ı' hatasi gibi). Log'a dusur ki bir daha sessizce kaybolmasin.
  if (teamRowsAll.length && !teamRows.length) {
    console.warn(
      `[getTeamPlayerStats] takim eslesmedi: slug="${teamSlug}" season=${season} ` +
        `metric=${metricKey} leaderboard_rows=${teamRowsAll.length} ` +
        `sofascore_id=${sofascoreIdForTeamSlug(teamSlug) ?? "yok"} ` +
        `(ornek takimlar: ${[...new Set(teamRowsAll.map((r) => r.teamName))].slice(0, 6).join(", ")})`
    );
  }

  // Yalniz bu takimin oyuncularinin varliklarini cek (tam tablo taramasi yerine).
  const assets = await getPlayerAssets(teamRows.map((r) => r.playerId));
  const rows: TeamPlayerStatRow[] = teamRows.map((r) => {
    const a = assets[r.playerId];
    return {
      ...r,
      photo: a?.photo ?? null,
      nationality: a?.nationality ?? null,
      href: a?.slug
        ? `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(a.slug)}`
        : null,
    };
  });

  return { season, seasons, catalog, metricKey, metric, rows };
}
