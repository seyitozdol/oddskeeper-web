import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const FOOTBALL_LEAGUE_DETAIL_HREF =
  "/dashboard/stats-analysis/football/league-stats/detail?competition=S%C3%BCper%20Lig&season=2025%2F2026&tab=overview";

export default async function StatsAnalysisPage() {
  const t = await getT();

  const cards = [
    {
      title: t("nav.playerStats"),
      subtitle: t("nav.playerStatsSubtitle"),
      href: "/dashboard/stats-analysis/football/player-stats",
    },
    {
      title: t("nav.teamStats"),
      subtitle: t("nav.teamStatsSubtitle"),
      href: "/dashboard/stats-analysis/football/team-stats",
    },
    {
      title: t("nav.leagueDetails"),
      subtitle: t("nav.leagueDetailsSubtitle"),
      href: FOOTBALL_LEAGUE_DETAIL_HREF,
    },
    {
      title: t("nav.playerRankings"),
      subtitle: t("nav.playerRankingsSubtitle"),
      href: "/dashboard/stats-analysis/football/player-stats/metric",
    },
    {
      title: t("nav.teamRankings"),
      subtitle: t("nav.teamRankingsSubtitle"),
      href: "/dashboard/stats-analysis/football/team-stats/metric",
    },
  ];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-ink">
          {t("statsHub.hubKicker")}
        </p>

        <h1 className="text-3xl font-semibold text-ink lg:text-5xl">
          {t("statsHub.hubTitle")}
        </h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-line bg-veil p-6 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-card-2"
            >
              <div className="text-lg font-semibold text-ink transition group-hover:text-accent-ink">
                {card.title}
              </div>
              <div className="mt-2 text-sm text-ink-3">{card.subtitle}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
