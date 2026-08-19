import Link from "next/link";
import { notFound } from "next/navigation";
import { Goal, LayoutDashboard, Users } from "lucide-react";
import { getLocale, getT } from "@/lib/i18n/server";
import { formatMatchDate, positionLabel } from "@/features/tff1/lib";
import { SideTabMenu } from "@/components/nav/SideTabMenu";
import {
  Tff1TeamShowcase,
  type TeamShowcaseChrome,
} from "@/features/tff1/components/Tff1TeamShowcase";
import type { Tff1MatchRow, Tff1TeamRow } from "@/features/tff1/types";
import { getPlayerDetailHref } from "@/lib/routes";
import {
  getTff1PlayerInfo,
  getTff1TeamLogos,
} from "@/features/tff1/server/getTff1Stats";
import {
  getCupMatches,
  getCupPlayerSeasonStats,
  getCupTeamSeasonStats,
  getFootballSlugsByIds,
} from "@/features/tsl/server/cupPlayerProfile";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

// Yabanci kupa takiminin TEK profili (tek-profil birlestirme, Faz 4).
// Route: /dashboard/euro-cups/team/[teamId] — kupa ayrimi SAYFA ICINDE
// (?comp= pilleri + Results'ta competition rozeti), kupa basina ayri sayfa YOK.
// (Dual Turk takimlari bu sayfaya hic gelmez; route slug cozup football takim
// profiline redirect eder.) Super Lig/tff1 takim profiliyle ayni sol-menu duzeni.
const CUPS = [
  {
    key: "ucl",
    prefix: "ucl",
    competition: "UEFA Şampiyonlar Ligi",
    nameKey: "tsl.uclName",
    logo: "/images/leagues/ucl.png",
    matchBase: "/dashboard/euro-cups/cl/match",
  },
  {
    key: "uel",
    prefix: "uel",
    competition: "UEFA Avrupa Ligi",
    nameKey: "tsl.uelName",
    logo: "/images/leagues/uel.png",
    matchBase: "/dashboard/euro-cups/el/match",
  },
  {
    key: "uecl",
    prefix: "uecl",
    competition: "UEFA Konferans Ligi",
    nameKey: "tsl.ueclName",
    logo: "/images/leagues/uecl.png",
    matchBase: "/dashboard/euro-cups/conf/match",
  },
] as const;
type CupDef = (typeof CUPS)[number];

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

export default async function EuroCupTeamDetail({
  teamId,
  tab,
  comp,
  season: seasonParam,
}: {
  teamId: string;
  tab?: string;
  comp?: string;
  season?: string;
}) {
  const activeTab: TeamTab = isValidTab(tab) ? tab : "overview";
  const [cupTeamRows, allCupMatches, logos, infos, t, locale] = await Promise.all([
    Promise.all(CUPS.map((c) => getCupTeamSeasonStats(c.prefix))),
    getCupMatches(),
    getTff1TeamLogos(),
    getTff1PlayerInfo(),
    getT(),
    getLocale(),
  ]);

  // Takimin bulundugu (kupa, sezon) baglamlari.
  type Ctx = { cup: CupDef; cupIdx: number; row: Tff1TeamRow };
  const contexts: Ctx[] = [];
  CUPS.forEach((c, i) => {
    for (const r of cupTeamRows[i])
      if (r.team_id === teamId) contexts.push({ cup: c, cupIdx: i, row: r });
  });
  if (contexts.length === 0) notFound();

  const compByName = new Map<string, CupDef>(CUPS.map((c) => [c.competition, c]));
  const teamMatchesAll = allCupMatches
    .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
    .sort((a, b) => (b.match_datetime ?? "").localeCompare(a.match_datetime ?? ""));

  // Birincil baglam: ?comp/?season gecerliyse o; degilse en son oynanan macin
  // kupasi+sezonu; o da yoksa en guncel sezonlu baglam.
  const cupsPresent = CUPS.filter((c) => contexts.some((x) => x.cup.key === c.key));
  const requestedCup = cupsPresent.find((c) => c.key === comp) ?? null;
  let primary: Ctx | null = null;
  if (requestedCup) {
    const inCup = contexts
      .filter((x) => x.cup.key === requestedCup.key)
      .sort((a, b) => b.row.season_label.localeCompare(a.row.season_label));
    primary =
      inCup.find((x) => x.row.season_label === seasonParam) ?? inCup[0] ?? null;
  }
  if (!primary) {
    const lastPlayed = teamMatchesAll.find(
      (m) => m.home_score !== null && m.away_score !== null
    );
    if (lastPlayed) {
      const c = compByName.get(lastPlayed.competition);
      primary =
        contexts.find(
          (x) =>
            x.cup.key === c?.key && x.row.season_label === lastPlayed.season_label
        ) ?? null;
    }
  }
  if (!primary) {
    primary = [...contexts].sort((a, b) =>
      b.row.season_label.localeCompare(a.row.season_label)
    )[0];
  }

  const season = primary.row.season_label;
  const team = primary.row;
  const primaryPlayers = await getCupPlayerSeasonStats(primary.cup.prefix);

  const teamSeasons = contexts
    .filter((x) => x.cup.key === primary!.cup.key)
    .map((x) => x.row)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));

  const seasonTeams = cupTeamRows[primary.cupIdx]
    .filter((r) => r.season_label === season)
    .sort((a, b) => num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff));
  const rank = seasonTeams.findIndex((r) => r.team_id === teamId) + 1;
  const logo = logos.find((l) => l.team_id === teamId)?.logo_url ?? null;

  // Vitrin (form/son maclar/puan): birincil kupa+sezon maclari.
  const primaryMatches = teamMatchesAll.filter(
    (m) => m.competition === primary!.cup.competition && m.season_label === season
  );

  const squad = primaryPlayers
    .filter((p) => p.season_label === season && p.team_id === teamId)
    .sort((a, b) => num(b.minutes) - num(a.minutes));
  const squadSlugs = await getFootballSlugsByIds(squad.map((p) => p.player_id));

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

  const radarTeam = teamSeasons.find((r) => num(r.played) >= 5) ?? team;
  const radarSeasonTeams =
    radarTeam.season_label === season
      ? seasonTeams
      : cupTeamRows[primary.cupIdx].filter(
          (r) => r.season_label === radarTeam.season_label
        );

  const compLabel = t(primary.cup.nameKey);
  const base = `/dashboard/euro-cups/team/${encodeURIComponent(teamId)}`;

  const chrome: TeamShowcaseChrome = {
    competitionLabel: compLabel,
    leagueLogoSrc: primary.cup.logo,
    teamSeasonHref: (s) =>
      `${base}?comp=${primary!.cup.key}&season=${encodeURIComponent(s)}`,
    matchHref: (mid) => `${primary!.cup.matchBase}/${encodeURIComponent(mid)}`,
    showSquadValue: false,
  };

  const sideItems = TABS.map((tb) => ({
    key: tb,
    href: `${base}?comp=${primary!.cup.key}&season=${encodeURIComponent(season)}${tb === "overview" ? "" : `&tab=${tb}`}`,
    label: t(TAB_LABEL_KEYS[tb]),
    icon: tb === "overview" ? <LayoutDashboard /> : tb === "squad" ? <Users /> : <Goal />,
    count: tb === "squad" ? squad.length : tb === "results" ? teamMatchesAll.length : null,
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
          {/* Kupa kirilimi sayfa ICINDE: takimin bulundugu kupalar (pil), ayri sayfa yok */}
          {cupsPresent.length > 1 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {cupsPresent.map((c) => {
                const current = c.key === primary!.cup.key;
                const cls = current
                  ? "inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-on-accent"
                  : "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:text-ink";
                const inner = (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.logo}
                      alt=""
                      width={16}
                      height={16}
                      className="tsl-league-mark h-4 w-4 shrink-0 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    {t(c.nameKey)}
                  </>
                );
                return current ? (
                  <span key={c.key} className={cls}>
                    {inner}
                  </span>
                ) : (
                  <Link key={c.key} href={`${base}?comp=${c.key}`} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          ) : null}

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
              leagueMatches={primaryMatches}
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
                      // Oyuncu linki TEK football profiline (slug); slug yoksa duz metin.
                      const href = getPlayerDetailHref(squadSlugs[p.player_id] ?? null);
                      const cell = (
                        <span className="flex items-center gap-2">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt={name} width={24} height={24} referrerPolicy="no-referrer" className="h-6 w-6 shrink-0 rounded-full border border-line bg-card-2 object-cover" />
                          ) : null}
                          {name}
                        </span>
                      );
                      return (
                        <tr key={p.player_id} className="border-t border-line text-ink transition hover:bg-veil">
                          <td className="whitespace-nowrap px-3 py-2 font-medium">
                            {href ? (
                              <Link href={href} className="transition hover:text-accent-ink hover:underline">
                                {cell}
                              </Link>
                            ) : (
                              cell
                            )}
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
                {t("tff1.drawerResults", { count: teamMatchesAll.length })}
              </h2>
              {/* TUM kupa maclari tek listede; her satirda kupa rozeti */}
              <div className="mt-2 max-h-[560px] overflow-y-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <tbody>
                    {teamMatchesAll.map((m) => {
                      const r = resultFor(m);
                      const cup = compByName.get(m.competition) ?? null;
                      const row = (
                        <>
                          <span className={m.home_team_id === teamId ? "font-semibold" : ""}>{m.home_team_name}</span>
                          <span className="mx-1.5 rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                            {m.home_score ?? "-"}:{m.away_score ?? "-"}
                          </span>
                          <span className={m.away_team_id === teamId ? "font-semibold" : ""}>{m.away_team_name}</span>
                        </>
                      );
                      return (
                        <tr key={`${m.competition}-${m.match_id}`} className="border-t border-line text-ink first:border-t-0">
                          <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                            {formatMatchDate(m.match_datetime, locale)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {cup ? (
                              <span className="inline-flex items-center" title={t(cup.nameKey)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={cup.logo}
                                  alt={t(cup.nameKey)}
                                  width={16}
                                  height={16}
                                  className="tsl-league-mark h-4 w-4 object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {cup ? (
                              <Link href={`${cup.matchBase}/${encodeURIComponent(m.match_id)}`} className="transition hover:text-accent-ink">
                                {row}
                              </Link>
                            ) : (
                              row
                            )}
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
