import { notFound } from "next/navigation";
import { getLocale, getT } from "@/lib/i18n/server";
import {
  Tff1PlayerShowcase,
  type PlayerShowcaseChrome,
} from "@/features/tff1/components/Tff1PlayerShowcase";
import type { Tff1MatchLogRow } from "@/features/tff1/types";
import {
  getTff1PlayerInfo,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import {
  getCupPlayerMatchLog,
  getCupPlayerSeasonStats,
  getCupTeamSeasonStats,
} from "@/features/tsl/server/cupPlayerProfile";

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

// Avrupa kupasi oyuncu profili — tff1 Showcase'ini kupa verisiyle (parite kolonlar)
// yeniden kullanir. matchBase/backBase/competition ilgili kupanin route wrapper'indan
// gelir. Kimlik SofaScore player_id; bio paylasilan tff1_player_info_v1'den.
export default async function EuroCupPlayerDetail({
  playerId,
  viewPrefix,
  competition,
  matchBase,
  backBase,
}: {
  playerId: string;
  viewPrefix: string;
  competition: string;
  matchBase: string;
  backBase: string;
}) {
  const [players, teams, infoRows, logos, matchLog, t, locale] =
    await Promise.all([
      getCupPlayerSeasonStats(viewPrefix),
      getCupTeamSeasonStats(viewPrefix),
      getTff1PlayerInfo(),
      getTff1TeamLogos(),
      getCupPlayerMatchLog(playerId, competition),
      getT(),
      getLocale(),
    ]);

  const seasonRows = players
    .filter((p) => p.player_id === playerId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (seasonRows.length === 0) notFound();

  const latest = seasonRows[0];
  const info = infoRows.find((r) => r.player_id === playerId) ?? null;
  const logoByTeam: Record<string, string> = {};
  for (const l of logos) if (l.logo_url) logoByTeam[l.team_id] = l.logo_url;

  const teamRow =
    teams.find(
      (tr) =>
        tr.season_label === latest.season_label && tr.team_id === latest.team_id
    ) ?? null;

  // Radar/güçlü yön yüzdelikleri için aynı sezonun kupa havuzu.
  const leagueRows = players.filter(
    (p) => p.season_label === latest.season_label
  );
  const radarRow =
    seasonRows.find((r) => (num(r.appearances) ?? 0) >= 5) ?? latest;
  const radarLeagueRows =
    radarRow.season_label === latest.season_label
      ? leagueRows
      : players.filter((p) => p.season_label === radarRow.season_label);

  const chrome: PlayerShowcaseChrome = {
    backHref: backBase,
    backLabel: t("tff1.backToLeague"),
    competitionLabel: competition,
    teamHref: null, // kupa takım profili henüz yok (SF3)
    matchHref: (m: Tff1MatchLogRow) =>
      `${matchBase}/${encodeURIComponent(m.match_id)}`,
    showMarketValue: false, // kupada piyasa değeri yok
  };

  return (
    <div className="w-full space-y-3">
      <Tff1PlayerShowcase
        latest={latest}
        seasonRows={seasonRows}
        leagueRows={leagueRows}
        radarRow={radarRow}
        radarLeagueRows={radarLeagueRows}
        info={info}
        marketValue={null}
        teamRow={teamRow}
        logoByTeam={logoByTeam}
        matchLog={matchLog}
        t={t}
        locale={locale}
        chrome={chrome}
      />
    </div>
  );
}
