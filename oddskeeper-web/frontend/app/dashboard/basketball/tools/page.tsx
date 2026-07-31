import Link from "next/link";
import {
  getBasketballHomeAwaySplits,
  getBasketballTeamMetricForms,
  getBasketballPlayerShares,
} from "@/features/basketball/server/getBasketballStats";
import BasketballTools from "@/features/basketball/components/BasketballTools";
import { getT } from "@/lib/i18n/server";

export default async function BasketballToolsPage() {
  const [splits, forms, shares, t] = await Promise.all([
    getBasketballHomeAwaySplits(),
    getBasketballTeamMetricForms(),
    getBasketballPlayerShares(),
    getT(),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
          ← {t("basketball.backToLeague")}
        </Link>
        <div className="mt-3 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-ink">{t("basketball.toolsKicker")}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t("basketball.toolsTitle")}</h1>
          <p className="mt-1 text-sm text-ink-3">{t("basketball.toolsSubtitle")}</p>
        </div>

        <BasketballTools splits={splits} forms={forms} shares={shares} />
      </div>
    </section>
  );
}
