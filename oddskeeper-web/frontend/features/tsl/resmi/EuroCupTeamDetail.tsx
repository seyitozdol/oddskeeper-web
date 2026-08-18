import Link from "next/link";
import { notFound } from "next/navigation";
import { Goal, LayoutDashboard, Users } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { formatMatchDate, positionLabel } from "@/features/tff1/lib";
import { SideTabMenu } from "@/components/nav/SideTabMenu";
import { CupCrossLeagueToggle } from "@/features/tsl/resmi/CupCrossLeagueToggle";
import {
  Tff1TeamShowcase,
  type TeamShowcaseChrome,
} from "@/features/tff1/components/Tff1TeamShowcase";
import type { Tff1MatchRow } from "@/features/tff1/types";
import {
  getTff1PlayerInfo,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import {
  getCupMatches,
  getCupPlayerSeasonStats,
  getCupTeamCrossLinks,
  getCupTeamSeasonStats,
} from "@/features/tsl/server/cupPlayerProfile";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

// viewPrefix -> lig ad i18n anahtari (competition badge/label lokalize).
const PREFIX_NAME_KEY: Record<string, string> = {
  ucl: "tsl.uclName",
  uel: "tsl.uelName",
  uecl: "tsl.ueclName",
};

const TABS = ["overview", "squad", "results"] as const;
type TeamTab = (typeof TABS)[number];
const TAB_LABEL_KEYS: Record<TeamTab, string> = {
  overview: "tff1.jumpOverview",
  squad: "tff1.jumpSquad",
  results: "tff1.jumpResults",
};
const RESULT_CLASS: Record<string, string> = {
  W: "bg-pos/15 text-pos",
  D: "bg-veil text-ink-2",
  L: "bg-neg/15 text-neg",
};

function isValidTab(v: string | undefined): v is TeamTab {
  return TABS.includes(v as TeamTab);
}

// Avrupa kupasi takim profili — Super Lig/tff1 takim profiliyle ayni sol-menu
// layout'u (route-bazli ?tab=) + capraz-lig toggle. tff1 Tff1TeamShowcase kupa
// verisiyle (parite kolonlar) yeniden kullanilir. Kimlik SofaScore team_id.
export default async function EuroCupTeamDetail({
  teamId,
  viewPrefix,
  competition,
  matchBase,
  playerBase,
  teamBase,
  backBase,
  leagueLogo,
  tab,
  season: seasonParam,
}: {
  teamId: string;
  viewPrefix: string;
  competition: string;
  matchBase: string;
  playerBase: string;
  teamBase: string;
  backBase: string;
  leagueLogo: string;
  tab?: string;
  season?: string;
}) {
  const activeTab: TeamTab = isValidTab(tab) ? tab : "overview";
  const [teams, players, matches, logos, infos, crossLinks, t, locale] =
    await Promise.all([
      getCupTeamSeasonStats(viewPrefix),
      getCupPlayerSeasonStats(viewPrefix),
      getCupMatches(competition),
      getTff1TeamLogos(),
      getTff1PlayerInfo(),
      getCupTeamCrossLinks(teamId, viewPrefix),
      getT(),
      getLocale(),
    ]);

  const teamSeasons = teams
    .filter((tr) => tr.team_id === teamId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));
  if (teamSeasons.length === 0) notFound();

  const season =
    seasonParam && teamSeasons.some((tr) => tr.season_label === seasonParam)
      ? seasonParam
      : teamSeasons[0].season_label;
  const team = teamSeasons.find((tr) => tr.season_label === season)!;

  const seasonTeams = teams
    .filter((tr) => tr.season_label === season)
    .sort((a, b) => num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff));
  const rank = seasonTeams.findIndex((tr) => tr.team_id === teamId) + 1;
  const logo = logos.find((l) => l.team_id === teamId)?.logo_url ?? null;

  const teamMatches = matches
    .filter(
      (m) =>
        m.season_label === season &&
        (m.home_team_id === teamId || m.away_team_id === teamId)
    )
    .sort((a, b) => (b.match_datetime ?? "").localeCompare(a.match_datetime ?? ""));

  const squad = players
    .filter((p) => p.season_label === season && p.team_id === teamId)
    .sort((a, b) => num(b.minutes) - num(a.minutes));

  const infoById: Record<string, { photo: string | null }> = {};
  for (const pi of infos) infoById[pi.player_id] = { photo: pi.photo_url ?? null };

  const resultFor = (m: Tff1MatchRow): "W" | "D" | "L" | null => {
    if (m.home_score === null || m.away_score === null) return null;
    const isHome = m.home_team_id === teamId;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  };
  const resultLetter = (r: "W" | "D" | "L" | null) =>
    r === "W" ? "G" : r === "L" ? "M" : r === "D" ? "B" : "—";

  const radarTeam = teamSeasons.find((tr) => num(tr.played) >= 5) ?? team;
  const radarSeasonTeams =
    radarTeam.season_label === season
      ? seasonTeams
      : teams.filter((tr) => tr.season_label === radarTeam.season_label);

  // Lig adi lokalize (competition prop DB degeri olarak sorgu icin kalir).
  const compLabel = t(PREFIX_NAME_KEY[viewPrefix] ?? "tsl.uclName");

  const chrome: TeamShowcaseChrome = {
    competitionLabel: compLabel,
    leagueLogoSrc: leagueLogo,
    teamSeasonHref: (s) => `${teamBase}/${encodeURIComponent(teamId)}?season=${encodeURIComponent(s)}`,
    matchHref: (mid) => `${matchBase}/${encodeURIComponent(mid)}`,
    showSquadValue: false,
  };

  const base = `${teamBase}/${encodeURIComponent(teamId)}`;
  const sideItems = TABS.map((tb) => ({
    key: tb,
    href: `${base}?season=${encodeURIComponent(season)}${tb === "overview" ? "" : `&tab=${tb}`}`,
    label: t(TAB_LABEL_KEYS[tb]),
    icon: tb === "overview" ? <LayoutDashboard /> : tb === "squad" ? <Users /> : <Goal />,
    count: tb === "squad" ? squad.length : tb === "results" ? teamMatches.length : null,
  }));

  return (
    <div className="w-full">
      <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
        <SideTabMenu
          items={sideItems}
          activeKey={activeTab}
          teamName={team.team_name ?? teamId}
          teamLogo={logo}
        />

        <div className="min-w-0 space-y-3">
          {/* Capraz-lig toggle: sag-ust, buyuk gorselin ustunde */}
          <CupCrossLeagueToggle links={crossLinks} t={t} />
          {activeTab === "overview" ? (
            <Tff1TeamShowcase
              teamId={teamId}
              team={team}
              teamSeasons={teamSeasons}
              seasonTeams={seasonTeams}
              radarTeam={radarTeam}
              radarSeasonTeams={radarSeasonTeams}
              rank={rank}
              logoUrl={logo}
              noteSlug={null}
              teamNotes={[]}
              leagueMatches={teamMatches}
              squadValue={0}
              resultFor={resultFor}
              t={t}
              locale={locale}
              chrome={chrome}
            />
          ) : activeTab === "squad" ? (
            <div className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.drawerSquad", { count: squad.length })}
              </h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                      <th className="px-3 py-2 font-medium">{t("tff1.colPlayer")}</th>
                      <th className="px-3 py-2 font-medium">{t("tff1.colPosition")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colXg")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {squad.map((p) => {
                      const photo = infoById[p.player_id]?.photo ?? null;
                      const name = p.player_name ?? p.player_id;
                      return (
                        <tr key={p.player_id} className="border-t border-line text-ink transition hover:bg-veil">
                          <td className="whitespace-nowrap px-3 py-2 font-medium">
                            <Link
                              href={`${playerBase}/${encodeURIComponent(p.player_id)}`}
                              className="flex items-center gap-2 transition hover:text-accent-ink hover:underline"
                            >
                              {photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo} alt={name} width={24} height={24} referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2 object-cover" />
                              ) : null}
                              {name}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-2">{positionLabel(p, locale)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(p.appearances)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(p.minutes)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(p.goals)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(p.assists)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{p.xg === null ? "—" : Number(p.xg).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-accent-ink">
                            {p.rating_avg === null ? "—" : Number(p.rating_avg).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.drawerResults", { count: teamMatches.length })}
              </h2>
              <div className="mt-2 max-h-[560px] overflow-y-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <tbody>
                    {teamMatches.map((m) => {
                      const r = resultFor(m);
                      return (
                        <tr key={m.match_id} className="border-t border-line text-ink first:border-t-0">
                          <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                            {formatMatchDate(m.match_datetime, locale)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            <Link href={`${matchBase}/${encodeURIComponent(m.match_id)}`} className="transition hover:text-accent-ink">
                              <span className={m.home_team_id === teamId ? "font-semibold" : ""}>{m.home_team_name}</span>
                              <span className="mx-1.5 rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                                {m.home_score ?? "-"}:{m.away_score ?? "-"}
                              </span>
                              <span className={m.away_team_id === teamId ? "font-semibold" : ""}>{m.away_team_name}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${r ? RESULT_CLASS[r] : "bg-veil text-ink-3"}`}>
                              {resultLetter(r)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
