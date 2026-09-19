import { cachedQuery } from "@/lib/supabase/cached";
import { getTeamDetailHref } from "@/lib/routes";
import { getFootballTeamSlugMap } from "@/features/tsl/server/cupProfileRedirect";

// Yaklaşan maçlardaki takım adlarının linki. Takımın GÜNCEL ligi sabit id
// listesinden DEĞİL, güncel sezon fikstür view'larından okunur; böylece lig
// değiştiren takım (ör. Amed 1. Lig -> Süper Lig) sezon devrinde elle
// güncelleme gerekmeden doğru sayfaya gider. Kural, lig puan durumlarındaki
// linklerle aynıdır: Süper Lig takımı -> football profili (slug), 1. Lig
// takımı -> /dashboard/tff-1-lig/team/<id>.

const TFF1_TEAM_BASE = "/dashboard/tff-1-lig/team/";

// Lig üyeliği sezonda bir kez değişir; saatlik tazeleme yeter.
const MEMBERSHIP_TTL_S = 3600;

type LeagueMembership = {
  tsl: string[]; // güncel Süper Lig SofaScore takım id'leri
  tff1: string[]; // güncel 1. Lig SofaScore takım id'leri
  tff1History: string[]; // 1. Lig sayfasında verisi olan (geçmiş sezonlar dahil)
};

type FixtureTeams = { home_team_id: unknown; away_team_id: unknown };

function fixtureTeamIds(rows: FixtureTeams[] | null): string[] {
  const ids = new Set<string>();
  for (const r of rows ?? []) {
    if (r.home_team_id != null) ids.add(String(r.home_team_id));
    if (r.away_team_id != null) ids.add(String(r.away_team_id));
  }
  return [...ids];
}

const fetchLeagueMembership = cachedQuery(
  "upcoming-events-league-membership",
  async (sb): Promise<LeagueMembership> => {
    const analytics = sb.schema("analytics");
    const [tsl, tff1, history] = await Promise.all([
      // 1000-cap: güncel sezon Süper Lig fikstürü 306 satır.
      analytics
        .from("tsl_ss_fixtures_v1")
        .select("home_team_id, away_team_id")
        .limit(1000)
        .returns<FixtureTeams[]>(),
      // 1000-cap: güncel sezon 1. Lig fikstürü 380 satır.
      analytics
        .from("tff1_fixtures_v1")
        .select("home_team_id, away_team_id")
        .limit(1000)
        .returns<FixtureTeams[]>(),
      // 1000-cap: takım-sezon başına tek satır (~60).
      analytics
        .from("tff1_team_season_stats_mat")
        .select("team_id")
        .limit(1000)
        .returns<{ team_id: unknown }[]>(),
    ]);
    for (const res of [tsl, tff1, history])
      if (res.error) throw new Error(`league membership: ${res.error.message}`);
    return {
      tsl: fixtureTeamIds(tsl.data),
      tff1: fixtureTeamIds(tff1.data),
      tff1History: [
        ...new Set((history.data ?? []).map((r) => String(r.team_id))),
      ],
    };
  },
  MEMBERSHIP_TTL_S
);

export type TeamHrefResolver = (
  sport: string,
  teamId: number | null
) => string | null;

// Hata halinde sayfa kırılmaz; takım adları linksiz (düz metin) kalır.
export async function getTeamHrefResolver(): Promise<TeamHrefResolver> {
  let membership: LeagueMembership = { tsl: [], tff1: [], tff1History: [] };
  let slugById: Record<string, string> = {};
  try {
    [membership, slugById] = await Promise.all([
      fetchLeagueMembership(),
      getFootballTeamSlugMap(),
    ]);
  } catch (err) {
    console.error("upcoming events team links error:", err);
  }
  const tsl = new Set(membership.tsl);
  const tff1 = new Set(membership.tff1);
  const tff1History = new Set(membership.tff1History);

  return (sport, teamId) => {
    if (sport !== "football" || teamId == null) return null;
    const id = String(teamId);
    const profileHref = getTeamDetailHref(slugById[id] ?? null);
    if (tsl.has(id)) return profileHref;
    if (tff1.has(id)) return `${TFF1_TEAM_BASE}${id}`;
    // İki güncel ligde de olmayan takım (ör. 2. Lig'e düşen): en son verisinin
    // bulunduğu sayfa. 1. Lig verisi 2024/25'ten başladığı için 1. Lig geçmişi
    // olan takımın en yeni verisi oradadır; o sayfa football profiline de
    // köprü verir.
    if (tff1History.has(id)) return `${TFF1_TEAM_BASE}${id}`;
    return profileHref;
  };
}
