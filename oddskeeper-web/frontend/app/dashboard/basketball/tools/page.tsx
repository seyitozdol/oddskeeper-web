import Link from "next/link";
import { getBasketballToolsData } from "@/features/basketball/server/toolsProjection";
import BasketballParticipantTools from "@/features/basketball/components/BasketballParticipantTools";
import BasketballScrapeButton from "@/features/basketball/components/BasketballScrapeButton";
import SeasonToggle from "@/components/SeasonToggle";
import { EURO_SEASONS, normalizeSeason } from "@/features/euroleague/config";
import { getT } from "@/lib/i18n/server";
import { getNavAccess } from "@/lib/nav-access-server";

// Tools sezon seçici (?season); default güncel sezon. Sezonun kadrosu (team_rosters) varsa
// "sezon kadrosu" modu çalışır: yeni kadro + oyuncuların geçmiş maç rakamları
// (bkz. features/basketball/server/toolsProjection.ts).

export default async function BasketballToolsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season } = await searchParams;
  const seasonLabel = normalizeSeason(season);
  const [data, t, access] = await Promise.all([getBasketballToolsData(seasonLabel), getT(), getNavAccess()]);
  const { splits, forms, windows, teamLogs, players, roles, rosterMode } = data;

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

      <BasketballParticipantTools splits={splits} forms={forms} windows={windows} teamLogs={teamLogs} players={players} roles={roles} rosterMode={rosterMode} />
    </section>
  );
}
