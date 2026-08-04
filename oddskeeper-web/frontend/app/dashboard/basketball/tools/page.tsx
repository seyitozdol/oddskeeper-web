import Link from "next/link";
import {
  getBasketballHomeAwaySplits,
  getBasketballTeamMetricForms,
  getBasketballPlayerWindows,
  getBasketballAllTeamMatchLogs,
  getBasketballPlayerList,
  getBasketballPlayerRoles,
} from "@/features/basketball/server/getBasketballStats";
import BasketballParticipantTools from "@/features/basketball/components/BasketballParticipantTools";
import BasketballScrapeButton from "@/features/basketball/components/BasketballScrapeButton";
import SeasonToggle from "@/components/SeasonToggle";
import { EURO_SEASONS } from "@/features/euroleague/config";
import { getT } from "@/lib/i18n/server";
import { getNavAccess } from "@/lib/nav-access-server";

// Tools sezon seçici (?season); default 2025-2026 (verili sezon). 2026-27 kadro/veri
// gelince o sezon çalışır.
const TOOLS_SEASON = "2025-2026";

export default async function BasketballToolsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  const seasonLabel = (EURO_SEASONS as readonly string[]).includes(season ?? "") ? (season as string) : TOOLS_SEASON;
  const [splits, forms, windows, teamLogs, players, roles, t, access] = await Promise.all([
    getBasketballHomeAwaySplits(seasonLabel),
    getBasketballTeamMetricForms(seasonLabel),
    getBasketballPlayerWindows(seasonLabel),
    getBasketballAllTeamMatchLogs(seasonLabel),
    getBasketballPlayerList(seasonLabel),
    getBasketballPlayerRoles(seasonLabel),
    getT(),
    getNavAccess(),
  ]);

  return (
    <section className="w-full px-4 pb-14 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("basketball.toolsTitle")}</h1>
        <div className="flex items-center gap-3">
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
          {access.isAdmin ? <BasketballScrapeButton /> : null}
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
        </div>
      </div>

      <BasketballParticipantTools splits={splits} forms={forms} windows={windows} teamLogs={teamLogs} players={players} roles={roles} />
    </section>
  );
}
