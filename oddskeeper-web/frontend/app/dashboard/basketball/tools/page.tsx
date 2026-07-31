import Link from "next/link";
import {
  getBasketballHomeAwaySplits,
  getBasketballTeamMetricForms,
  getBasketballPlayerWindows,
  getBasketballAllTeamMatchLogs,
  getBasketballPlayerList,
} from "@/features/basketball/server/getBasketballStats";
import BasketballParticipantTools from "@/features/basketball/components/BasketballParticipantTools";
import { getT } from "@/lib/i18n/server";

export default async function BasketballToolsPage() {
  const [splits, forms, windows, teamLogs, players, t] = await Promise.all([
    getBasketballHomeAwaySplits(),
    getBasketballTeamMetricForms(),
    getBasketballPlayerWindows(),
    getBasketballAllTeamMatchLogs(),
    getBasketballPlayerList(),
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

        <BasketballParticipantTools splits={splits} forms={forms} windows={windows} teamLogs={teamLogs} players={players} />
      </div>
    </section>
  );
}
