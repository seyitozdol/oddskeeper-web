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
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,40,0.95),rgba(7,14,24,0.95))] p-8 shadow-[0_0_60px_rgba(34,104,189,0.12)]">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-[#7cbcff]">
          {t("statsHub.hubKicker")}
        </p>

        <h1 className="text-3xl font-semibold text-white lg:text-5xl">
          {t("statsHub.hubTitle")}
        </h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[22px] border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-0.5 hover:border-[#4da2ff]/30 hover:bg-[#0e1d30]"
            >
              <div className="text-lg font-semibold text-white transition group-hover:text-[#9fd3ff]">
                {card.title}
              </div>
              <div className="mt-2 text-sm text-white/50">{card.subtitle}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
