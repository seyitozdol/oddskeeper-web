import { createClient } from "../../../lib/supabase/server";
import { slugifyTeamName } from "@/lib/football-teams";
import { sofascoreIdForTeamSlug } from "@/lib/sofascore-team-map";
import {
  getTslLeaderboard,
  getTslPlayerCatalog,
} from "@/features/tsl/server/queries";
import { getPlayerAssets } from "@/features/tsl/server/resmi";
import {
  CUP_PLAYER_CATALOG,
  CUP_PLAYER_MAP,
  CUP_RATE_KEYS,
} from "@/features/tsl/server/eurocupData";
import { getFootballSlugsByIds } from "@/features/tsl/server/cupPlayerProfile";
import { toNum } from "@/features/tsl/lib";
import type { TslLeaderRow, TslMetricOption } from "@/features/tsl/types";

// Takim detayindaki "Player Stats" sekmesi: secili metrik + sezon icin
// takimin oyuncularini liglik leaderboard'dan suzer (Player Rankings ile
// ayni veri, takim-kapsamli). Sezonlar tsl_ss veri sezonlaridir.
// Tek-profil ilkesi geregi rekabet kirilimi SEKME ICINDE: Avrupa'da oynayan
// takimlarda comp secici (Super Lig / CL / EL / Konf) gorunur; kupa dali
// {prefix}_player_season_stats_v1'den okur (sofascore takim id ile).

export const TEAM_PLAYER_STATS_SEASONS = ["2026/2027", "2025/2026", "2024/2025"];

export type TeamPlayerComp = "tsl" | "ucl" | "uel" | "uecl";
export type TeamPlayerCompOption = {
  key: TeamPlayerComp;
  nameKey: string; // i18n lig adi
  logo: string;
  invert: boolean; // koyu modda logo beyaza cevrilsin (kupa logolari koyu)
};

const TSL_COMP: TeamPlayerCompOption = {
  key: "tsl",
  nameKey: "tsl.leagueName",
  logo: "/images/leagues/super-lig.png",
  invert: false,
};
const CUP_COMPS: (TeamPlayerCompOption & { prefix: string })[] = [
  { key: "ucl", prefix: "ucl", nameKey: "tsl.uclName", logo: "/images/leagues/ucl.png", invert: true },
  { key: "uel", prefix: "uel", nameKey: "tsl.uelName", logo: "/images/leagues/uel.png", invert: true },
  { key: "uecl", prefix: "uecl", nameKey: "tsl.ueclName", logo: "/images/leagues/uecl.png", invert: true },
];
const CUP_SEASONS = ["2026/2027", "2025/2026"];

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
  comp: TeamPlayerComp;
  availableComps: TeamPlayerCompOption[];
};

// Takimin veri sahibi oldugu kupalar (comp secicide gosterilecekler).
// Sezondan bagimsiz probe: takim herhangi bir sezonda o kupada oynadiysa pil cikar.
async function getAvailableComps(
  sofaTeamId: string | null
): Promise<TeamPlayerCompOption[]> {
  if (!sofaTeamId) return [TSL_COMP];
  const supabase = await createClient();
  const probes = await Promise.all(
    CUP_COMPS.map(async (c) => {
      const { data } = await supabase
        .schema("analytics")
        .from(`${c.prefix}_player_season_stats_v1`)
        .select("player_id")
        .eq("team_id", sofaTeamId)
        .limit(1);
      return data && data.length > 0 ? c : null;
    })
  );
  return [
    TSL_COMP,
    ...probes.filter((c): c is (typeof CUP_COMPS)[number] => c !== null)
      .map(({ key, nameKey, logo, invert }) => ({ key, nameKey, logo, invert })),
  ];
}

// Kupa dali: {prefix}_player_season_stats_v1'den takimin oyunculari + secili metrik.
async function getCupTeamPlayerStats(
  teamSlug: string,
  sofaTeamId: string,
  cup: (typeof CUP_COMPS)[number],
  requestedSeason: string | null | undefined,
  requestedMetric: string | null | undefined,
  availableComps: TeamPlayerCompOption[]
): Promise<TeamPlayerStatsBundle> {
  const seasons = CUP_SEASONS;
  let season = seasons.includes(requestedSeason ?? "")
    ? (requestedSeason as string)
    : seasons[0];

  const catalog = CUP_PLAYER_CATALOG;
  const metric =
    catalog.find((c) => c.metricKey === requestedMetric) ??
    catalog.find((c) => c.metricKey === "goals_total") ??
    catalog[0] ??
    null;
  const metricKey = metric?.metricKey ?? "goals_total";
  const col =
    Object.entries(CUP_PLAYER_MAP).find(([, k]) => k === metricKey)?.[0] ?? "goals";

  const supabase = await createClient();
  const fetchRows = async (s: string) => {
    const { data } = await supabase
      .schema("analytics")
      .from(`${cup.prefix}_player_season_stats_v1`)
      .select("*")
      .eq("team_id", sofaTeamId)
      .eq("season_label", s)
      .limit(200);
    return (data ?? []) as Record<string, unknown>[];
  };
  let raw = await fetchRows(season);
  if (!raw.length && !requestedSeason) {
    for (const s of seasons.slice(1)) {
      const rows = await fetchRows(s);
      if (rows.length) {
        season = s;
        raw = rows;
        break;
      }
    }
  }

  const ids = raw.map((r) => String(r.player_id));
  const [slugById, infoRes] = await Promise.all([
    getFootballSlugsByIds(ids),
    ids.length
      ? supabase
          .schema("analytics")
          .from("tff1_player_info_v1")
          .select("player_id, photo_url, country")
          .in("player_id", ids)
      : Promise.resolve({ data: [] as { player_id: unknown; photo_url: string | null; country: string | null }[] }),
  ]);
  const infoById: Record<string, { photo: string | null; country: string | null }> = {};
  for (const r of infoRes.data ?? [])
    infoById[String(r.player_id)] = { photo: r.photo_url ?? null, country: r.country ?? null };

  const rows: TeamPlayerStatRow[] = raw.map((r) => {
    const id = String(r.player_id);
    const apps = toNum(r.appearances) ?? 0;
    const min = toNum(r.minutes) ?? 0;
    const total = toNum(r[col]);
    const slug = slugById[id] ?? null;
    return {
      rank: 0,
      playerId: id,
      playerName: (r.player_name as string) ?? "—",
      teamName: (r.team_name as string) ?? null,
      teamId: sofaTeamId,
      positionCode: (r.position_code as string) ?? null,
      metricKey,
      metricLabel: metric?.metricLabel ?? metricKey,
      total,
      perMatch: CUP_RATE_KEYS.has(metricKey)
        ? total
        : total != null && apps > 0
          ? total / apps
          : null,
      per90: CUP_RATE_KEYS.has(metricKey)
        ? total
        : total != null && min > 0
          ? (total / min) * 90
          : null,
      matches: toNum(r.appearances),
      leagueAvg: null,
      vsAvgPct: null,
      valueFormat: metric?.valueFormat ?? "count",
      isHigherBetter: metric?.isHigherBetter ?? true,
      photo: infoById[id]?.photo ?? null,
      nationality: infoById[id]?.country ?? null,
      href: slug
        ? `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(slug)}`
        : null,
    };
  });

  return { season, seasons, catalog, metricKey, metric, rows, comp: cup.key, availableComps };
}

export async function getTeamPlayerStats(
  teamSlug: string,
  requestedSeason?: string | null,
  requestedMetric?: string | null,
  requestedComp?: string | null
): Promise<TeamPlayerStatsBundle> {
  const sofaTeamId = sofascoreIdForTeamSlug(teamSlug) ?? null;
  const availableComps = await getAvailableComps(sofaTeamId);
  const cup = CUP_COMPS.find(
    (c) => c.key === requestedComp && availableComps.some((a) => a.key === c.key)
  );
  if (cup && sofaTeamId) {
    return getCupTeamPlayerStats(
      teamSlug,
      sofaTeamId,
      cup,
      requestedSeason,
      requestedMetric,
      availableComps
    );
  }

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

  return { season, seasons, catalog, metricKey, metric, rows, comp: "tsl", availableComps };
}
