import Link from "next/link";
import {
  getBasketballFixtures,
  getBasketballHomeAwaySplits,
  getBasketballTeamMetricForms,
  getBasketballPlayerWindows,
  getBasketballAllTeamMatchLogs,
} from "@/features/basketball/server/getBasketballStats";
import BasketballTools from "@/features/basketball/components/BasketballTools";
import { getT } from "@/lib/i18n/server";

export default async function BasketballToolsPage() {
  const [fixtures, splits, forms, windows, teamLogs, t] = await Promise.all([
    getBasketballFixtures(),
    getBasketballHomeAwaySplits(),
    getBasketballTeamMetricForms(),
    getBasketballPlayerWindows(),
    getBasketballAllTeamMatchLogs(),
    getT(),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-ink">{t("basketball.toolsTitle")}</h1>
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
        </div>

        <BasketballTools fixtures={fixtures} splits={splits} forms={forms} windows={windows} teamLogs={teamLogs} />
      </div>
    </section>
  );
}
