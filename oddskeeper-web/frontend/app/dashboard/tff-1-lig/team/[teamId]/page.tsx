import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountryFlagUrl } from "@/lib/country-flags";
import {
  formatMarketValue,
  formatMatchDate,
  positionLabel,
  ROLE_CHIP_CLASS,
  ROLE_LABEL_KEYS,
  squadRole,
} from "@/features/tff1/lib";
import {
  getTff1Fixtures,
  getTff1Matches,
  getTff1MarketValues,
  getTff1PlayerInfo,
  getTff1PlayerSeasonStats,
  getTff1TeamLogos,
  getTff1TeamSeasonStats,
} from "@/features/tff1/server/getTff1Stats";
import type { Tff1MatchRow } from "@/features/tff1/types";
import { getAnyFootballTeamBySlug, slugifyTeamName } from "@/lib/football-teams";
import { getLocale, getT } from "@/lib/i18n/server";
import { getNavAccess } from "@/lib/nav-access-server";
import { getNotesForSlugs } from "@/lib/team-notes";
import { tff1SlugForTeamId } from "@/lib/tff1-team-slugs";
import Tff1TeamNotesHeader from "@/features/tff1/components/Tff1TeamNotesHeader";
import { Tff1TeamShowcase } from "@/features/tff1/components/Tff1TeamShowcase";

function num(v: number | string | null | undefined): number {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
}

const RESULT_CLASS: Record<string, string> = {
  W: "bg-pos/15 text-pos",
  D: "bg-veil text-ink-2",
  L: "bg-neg/15 text-neg",
};

const TEAM_TABS = ["overview", "fixtures", "squad", "results"] as const;
type TeamTab = (typeof TEAM_TABS)[number];

export default async function Tff1TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ season?: string; tab?: string }>;
}) {
  const { teamId } = await params;
  const { season: seasonParam, tab: tabParam } = await searchParams;
  const activeTab: TeamTab = TEAM_TABS.includes(tabParam as TeamTab)
    ? (tabParam as TeamTab)
    : "overview";
  const [players, teams, matches, fixtures, mvRows, logos, playerInfos, t, locale] =
    await Promise.all([
      getTff1PlayerSeasonStats(),
      getTff1TeamSeasonStats(),
      getTff1Matches(),
      getTff1Fixtures(),
      getTff1MarketValues(),
      getTff1TeamLogos(),
      getTff1PlayerInfo(),
      getT(),
      getLocale(),
    ]);

  // Takım notları: 1. Lig team_id -> MSM/notes slug (MSM 1X2 rozetiyle aynı
  // slug uzayı). Haritada olmayan takımda not gösterilmez.
  const noteSlug = tff1SlugForTeamId(teamId);
  let teamNotes: Awaited<ReturnType<typeof getNotesForSlugs>>[string] = [];
  if (noteSlug) {
    const viewer = await getNavAccess();
    const bySlug = await getNotesForSlugs([noteSlug], {
      userId: viewer.userId,
      isAdmin: viewer.isAdmin,
    });
    teamNotes = bySlug[noteSlug] ?? [];
  }

  const teamSeasons = teams
    .filter((tr) => tr.team_id === teamId)
    .sort((a, b) => b.season_label.localeCompare(a.season_label));

  // Bu takımın 1. Lig sezon istatistiği yok (yeni yükselen ya da ligi değişen
  // takım; verisi başka id-uzayında). 404 yerine ad + logo + yaklaşan fikstürü
  // göster; böylece fikstürde yer alan her takımın bir sayfası olur.
  if (teamSeasons.length === 0) {
    const teamFx = fixtures.filter(
      (f) => f.home_team_id === teamId || f.away_team_id === teamId
    );
    const nameFromFx =
      teamFx
        .map((f) => (f.home_team_id === teamId ? f.home_team_name : f.away_team_name))
        .find((n) => Boolean(n)) ?? null;
    const nameFromMatch =
      matches
        .map((m) =>
          m.home_team_id === teamId
            ? m.home_team_name
            : m.away_team_id === teamId
              ? m.away_team_name
              : null
        )
        .find((n) => Boolean(n)) ?? null;
    const logoUrl = logos.find((l) => l.team_id === teamId)?.logo_url ?? null;

    // Takıma dair hiçbir iz yoksa (ne fikstür, ne maç, ne logo) gerçekten 404.
    if (!nameFromFx && !nameFromMatch && !logoUrl) notFound();

    const teamName = nameFromFx ?? nameFromMatch ?? teamId;

    // Köprü: bu takımın verisi başka lig id-uzayında (ör. TSL'den düşen
    // Kayserispor/Antalyaspor) football profilinde slug bazlı duruyor. Adı
    // slug'a çevirip mevcut bir football profili varsa oraya bağla.
    const bridgeSlug = slugifyTeamName(teamName);
    const bridgeTeam = bridgeSlug ? await getAnyFootballTeamBySlug(bridgeSlug) : null;
    const bridgeHref = bridgeTeam
      ? `/dashboard/stats-analysis/football/team-stats/detail?team=${encodeURIComponent(bridgeSlug)}`
      : null;

    const now = new Date().toISOString();
    const upcoming = teamFx
      .filter(
        (f) => f.fixture_status !== "completed" && (f.fixture_datetime ?? "") >= now
      )
      .slice(0, 12);

    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          <Link
            href="/dashboard/stats-analysis/tff1/resmi?season=2026%2F2027&section=league"
            className="text-[13px] text-ink-3 transition hover:text-ink"
          >
            ← {t("tff1.backToLeague")}
          </Link>

          <div className="mt-4">
            <Tff1TeamNotesHeader
              teamSlug={noteSlug}
              teamName={teamName}
              logoUrl={logoUrl}
              initialNotes={teamNotes}
              subtitle={
                <p className="mt-1 text-[13px] text-ink-3">{t("tff1.kicker")}</p>
              }
            />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-veil px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {t("tff1.noSeasonStatsTitle")}
            </p>
            <p className="mt-1 text-[13px] text-ink-3">
              {t("tff1.noSeasonStatsBody")}
            </p>
            {bridgeHref ? (
              <Link
                href={bridgeHref}
                className="mt-3 inline-flex items-center rounded-md border border-line-strong bg-card-2 px-3 py-1.5 text-[13px] font-medium text-ink transition hover:bg-card"
              >
                {t("tff1.bridgeProfileCta")}
              </Link>
            ) : null}
          </div>

          {upcoming.length > 0 ? (
            <>
              <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.teamFixturesSection")}
              </h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-full border-collapse text-[13px]">
                  <tbody>
                    {upcoming.map((f) => (
                      <tr
                        key={f.fixture_id}
                        className="border-t border-line text-ink first:border-t-0"
                      >
                        <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                          {formatMatchDate(f.fixture_datetime, locale)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                          {f.round_number !== null
                            ? t("tff1.roundLabel", { round: f.round_number })
                            : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <span className={f.home_team_id === teamId ? "font-semibold" : ""}>
                            {f.home_team_name}
                          </span>
                          <span className="mx-1.5 text-ink-3">-</span>
                          <span className={f.away_team_id === teamId ? "font-semibold" : ""}>
                            {f.away_team_name}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  const season =
    seasonParam && teamSeasons.some((tr) => tr.season_label === seasonParam)
      ? seasonParam
      : teamSeasons[0].season_label;
  const team = teamSeasons.find((tr) => tr.season_label === season)!;

  const seasonTeams = teams
    .filter((tr) => tr.season_label === season)
    .sort(
      (a, b) => num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff)
    );
  const rank = seasonTeams.findIndex((tr) => tr.team_id === teamId) + 1;

  const logo = logos.find((l) => l.team_id === teamId)?.logo_url;
  const marketValues: Record<string, number | null> = {};
  for (const r of mvRows) marketValues[r.player_id] = r.market_value_eur;

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

  const squadValue = squad.reduce((acc, p) => acc + num(marketValues[p.player_id]), 0);

  // Kadro kartlari icin oyuncu foto/uyruk/yas (tff1_player_info_v1).
  const infoById: Record<string, { photo: string | null; country: string | null; age: number | null }> = {};
  for (const pi of playerInfos) {
    const age = pi.birth_date
      ? Math.floor((Date.now() - new Date(pi.birth_date).getTime()) / (365.25 * 86_400_000))
      : null;
    infoById[pi.player_id] = { photo: pi.photo_url ?? null, country: pi.country ?? null, age };
  }

  // Sol panel istatistikleri (Super Lig kadro gorunumuyle ayni mantik).
  const squadAges = squad
    .map((p) => infoById[p.player_id]?.age)
    .filter((a): a is number => a != null && a > 0);
  const squadAvgAge = squadAges.length
    ? (squadAges.reduce((s, a) => s + a, 0) / squadAges.length).toFixed(1)
    : null;
  const TR_NAT = new Set(["turkey", "türkiye", "turkiye"]);
  const squadForeigners = squad.filter((p) => {
    const cn = infoById[p.player_id]?.country;
    return cn && !TR_NAT.has(cn.toLowerCase());
  }).length;
  const valuedSquad = squad.filter((p) => num(marketValues[p.player_id]) > 0);
  const topValued = valuedSquad
    .slice()
    .sort((a, b) => num(marketValues[b.player_id]) - num(marketValues[a.player_id]))[0];

  // Pozisyon gruplama: G/D/M/F sirasi. Grup basligi jenerik etiket kullanir
  // (oyuncunun detay pozisyonu "Centre back" gibi olabilir).
  const POS_ORDER = ["G", "D", "M", "F"];
  const GROUP_LABEL: Record<string, { tr: string; en: string }> = {
    G: { tr: "Kaleci", en: "Goalkeeper" },
    D: { tr: "Defans", en: "Defender" },
    M: { tr: "Orta saha", en: "Midfielder" },
    F: { tr: "Forvet", en: "Forward" },
    "?": { tr: "Diğer", en: "Other" },
  };
  const groupLabel = (code: string) =>
    locale === "tr" ? GROUP_LABEL[code]?.tr ?? code : GROUP_LABEL[code]?.en ?? code;
  const posGroups: { code: string; rows: typeof squad }[] = [];
  for (const code of [...POS_ORDER, "?"]) {
    const rows = squad.filter((p) =>
      code === "?"
        ? !POS_ORDER.includes((p.position_code ?? "").toUpperCase())
        : (p.position_code ?? "").toUpperCase() === code
    );
    if (rows.length) posGroups.push({ code, rows });
  }

  const resultFor = (m: Tff1MatchRow): "W" | "D" | "L" | null => {
    if (m.home_score === null || m.away_score === null) return null;
    const isHome = m.home_team_id === teamId;
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    return gf > ga ? "W" : gf < ga ? "L" : "D";
  };
  const resultLetter = (r: "W" | "D" | "L" | null) =>
    r === "W" ? "G" : r === "L" ? "M" : r === "D" ? "B" : "—";

  const leagueMatches = teamMatches.filter((m) => !m.competition.includes("Play-off"));

  const now = new Date().toISOString();
  const teamFixtures = fixtures
    .filter(
      (f) =>
        (f.home_team_id === teamId || f.away_team_id === teamId) &&
        f.fixture_status !== "completed" &&
        (f.fixture_datetime ?? "") >= now
    )
    .slice(0, 8);

  // Radar için: seçili sezonda 5 maçtan az oynandıysa yeterli maçı olan
  // en güncel sezon esas alınır (sezon başı gürültüsü).
  const radarTeam =
    teamSeasons.find((tr) => num(tr.played) >= 5) ?? team;
  const radarSeasonTeams =
    radarTeam.season_label === season
      ? seasonTeams
      : teams.filter((tr) => tr.season_label === radarTeam.season_label);

  const tabHref = (tab: TeamTab) =>
    `/dashboard/tff-1-lig/team/${teamId}?season=${encodeURIComponent(season)}` +
    (tab === "overview" ? "" : `&tab=${tab}`);

  const menuItems: { tab: TeamTab; label: string; count?: number }[] = [
    { tab: "overview", label: t("tff1.jumpOverview") },
    ...(teamFixtures.length > 0
      ? [{ tab: "fixtures" as TeamTab, label: t("tff1.jumpFixtures") }]
      : []),
    { tab: "squad", label: t("tff1.jumpSquad"), count: squad.length },
    { tab: "results", label: t("tff1.jumpResults"), count: teamMatches.length },
  ];

  return (
    <section className="w-full">
      {/* Sol mini menu: bolucu cizgili dikey liste, sekmeler arasi sabit
          (sticky). Mobilde yatay serite doner. */}
      <div className="grid items-start gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-line bg-card lg:sticky lg:top-20">
          <nav className="flex flex-row lg:flex-col lg:divide-y lg:divide-line/60">
            {menuItems.map((m) => (
              <Link
                key={m.tab}
                href={tabHref(m.tab)}
                className={`flex flex-1 items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition lg:flex-none ${
                  activeTab === m.tab
                    ? "border-l-2 border-l-accent bg-veil font-semibold text-ink"
                    : "border-l-2 border-l-transparent font-medium text-ink-2 hover:bg-veil/60 hover:text-ink"
                }`}
              >
                <span className="whitespace-nowrap">{m.label}</span>
                {m.count != null ? (
                  <span className="rounded-md bg-card-2 px-1.5 py-0.5 text-[11px] leading-none text-ink-3">
                    {m.count}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-3">
      {activeTab === "overview" ? (
      <Tff1TeamShowcase
        teamId={teamId}
        team={team}
        teamSeasons={teamSeasons}
        seasonTeams={seasonTeams}
        radarTeam={radarTeam}
        radarSeasonTeams={radarSeasonTeams}
        rank={rank}
        logoUrl={logo ?? null}
        noteSlug={noteSlug}
        teamNotes={teamNotes}
        leagueMatches={leagueMatches}
        squadValue={squadValue}
        resultFor={resultFor}
        t={t}
        locale={locale}
      />
      ) : null}

      {activeTab === "fixtures" && teamFixtures.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-6">
          <>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {t("tff1.teamFixturesSection")}
            </h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full border-collapse text-[13px]">
                <tbody>
                  {teamFixtures.map((f) => (
                    <tr
                      key={f.fixture_id}
                      className="border-t border-line text-ink first:border-t-0"
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                        {formatMatchDate(f.fixture_datetime, locale)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-ink-3">
                        {f.round_number !== null
                          ? t("tff1.roundLabel", { round: f.round_number })
                          : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <span className={f.home_team_id === teamId ? "font-semibold" : ""}>
                          {f.home_team_name}
                        </span>
                        <span className="mx-1.5 text-ink-3">-</span>
                        <span className={f.away_team_id === teamId ? "font-semibold" : ""}>
                          {f.away_team_name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        </div>
      ) : null}

      {activeTab === "squad" ? (
        <>
        {/* Super Lig kadro gorunumuyle ayni duzen: 1/3 takim bilgi paneli
            (hep acik) + 2/3 pozisyona gruplu oyuncu kartlari. */}
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex flex-col items-center gap-4 border-b border-line bg-gradient-to-b from-card-2 to-card px-4 pb-5 pt-6 text-center">
              {logo ? (
                <div className="flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-5">
                  <Image
                    src={logo}
                    alt={team.team_name ?? teamId}
                    width={120}
                    height={120}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
              <div>
                <div className="text-xl font-bold leading-tight tracking-tight text-ink">
                  {team.team_name ?? teamId}
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  {t("teamDetail.squadSize")}: {squad.length}
                  {squadValue > 0 ? ` · ${formatMarketValue(squadValue)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {posGroups.map((g) => (
                  <span
                    key={g.code}
                    className="rounded-md border border-line bg-card px-2 py-1 text-[11px] font-medium text-ink-2"
                  >
                    {groupLabel(g.code)}{" "}
                    <span className="font-semibold text-ink">{g.rows.length}</span>
                  </span>
                ))}
              </div>
            </div>
            <dl className="divide-y divide-line/60">
              {(
                [
                  [t("teamDetail.squadAvgAge"), squadAvgAge],
                  [
                    t("teamDetail.squadForeigners"),
                    squad.length ? `${squadForeigners} / ${squad.length}` : null,
                  ],
                  [
                    t("teamDetail.squadAvgValue"),
                    valuedSquad.length
                      ? formatMarketValue(squadValue / valuedSquad.length)
                      : null,
                  ],
                  [
                    t("teamDetail.squadTopValue"),
                    topValued
                      ? `${topValued.player_name ?? ""} · ${formatMarketValue(marketValues[topValued.player_id])}`
                      : null,
                  ],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v != null && v !== "")
                .map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">
                      {label}
                    </dt>
                    <dd className="text-right text-[13px] font-semibold text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-card lg:col-span-2">
            <div className="border-b border-line bg-veil px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
                {t("tff1.drawerSquad", { count: squad.length })}
              </div>
            </div>
            <div className="space-y-3 p-3">
              {posGroups.map((g) => (
                <div key={g.code}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    {groupLabel(g.code)}
                  </div>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {g.rows.map((p) => {
                      const pi = infoById[p.player_id];
                      const flagUrl = getCountryFlagUrl(pi?.country ?? null);
                      const name = p.player_name ?? p.player_id;
                      return (
                        <div
                          key={p.player_id}
                          className="flex items-center gap-2.5 rounded-lg border border-line/70 bg-card-2/40 px-2.5 py-1.5"
                        >
                          {pi?.photo ? (
                            <Image
                              src={pi.photo}
                              alt={name}
                              width={34}
                              height={34}
                              className="h-[34px] w-[34px] shrink-0 rounded-full border border-line bg-card-2 object-cover"
                            />
                          ) : (
                            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3">
                              {name
                                .split(/\s+/)
                                .map((x) => x[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <Link
                                href={`/dashboard/tff-1-lig/player/${p.player_id}`}
                                className="truncate text-[13px] font-medium text-accent-ink transition hover:text-accent hover:underline"
                                title={name}
                              >
                                {name}
                              </Link>
                              {flagUrl && pi?.country ? (
                                <Image
                                  src={flagUrl}
                                  alt={pi.country}
                                  title={pi.country}
                                  width={16}
                                  height={12}
                                  className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                                />
                              ) : null}
                            </span>
                            <span className="block text-[11px] text-ink-3">
                              {positionLabel(p, locale)}
                              {pi?.age != null ? ` · ${pi.age}` : ""}
                            </span>
                          </div>
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-2">
                            {formatMarketValue(marketValues[p.player_id])}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.squadStatsTitle")}
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-3 py-2 font-medium">{t("tff1.colPlayer")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.colPosition")}</th>
                <th className="px-3 py-2 font-medium">{t("tff1.drawerRole")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAppearances")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMinutes")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colGoals")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colAssists")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colRating")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("tff1.colMarketValue")}</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => {
                const role = squadRole(p, num(team.played));
                return (
                  <tr
                    key={p.player_id}
                    className="border-t border-line text-ink transition hover:bg-veil"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      <Link
                        href={`/dashboard/tff-1-lig/player/${p.player_id}`}
                        className="transition hover:text-accent-ink hover:underline"
                      >
                        {p.player_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                      {positionLabel(p, locale)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[11px] ${ROLE_CHIP_CLASS[role]}`}
                      >
                        {t(ROLE_LABEL_KEYS[role])}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.appearances)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.minutes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.goals)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(p.assists)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.rating_avg === null ? "—" : Number(p.rating_avg).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMarketValue(marketValues[p.player_id])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] text-ink-3">{t("tff1.tmNote")}</p>
        </div>
        </>
      ) : null}

      {activeTab === "results" ? (
        <div className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {t("tff1.drawerResults", { count: teamMatches.length })}
        </h2>
        <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-line">
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
                      <Link
                        href={`/dashboard/tff-1-lig/match/${m.match_id}`}
                        className="transition hover:text-accent-ink"
                      >
                        <span className={m.home_team_id === teamId ? "font-semibold" : ""}>
                          {m.home_team_name}
                        </span>
                        <span className="mx-1.5 rounded bg-veil px-1.5 py-0.5 text-[12px] tabular-nums">
                          {m.home_score ?? "-"}:{m.away_score ?? "-"}
                        </span>
                        <span className={m.away_team_id === teamId ? "font-semibold" : ""}>
                          {m.away_team_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {m.competition.includes("Play-off") ? (
                        <span className="mr-1.5 text-[10px] uppercase text-ink-3">PO</span>
                      ) : null}
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold ${
                          r ? RESULT_CLASS[r] : "bg-veil text-ink-3"
                        }`}
                      >
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
      ) : null}
        </div>
      </div>
    </section>
  );
}
