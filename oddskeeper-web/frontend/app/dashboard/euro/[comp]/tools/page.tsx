import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEuroComp } from "@/features/euroleague/config";
import { getT } from "@/lib/i18n/server";

// Match-Player Tools EL/EC icin simdilik yer tutucu (kullanici karari: "simdilik link").
// Tam arac (fikstur/market/oran dagitimi) sonra kurulacak.
export default async function EuroToolsPage({ params }: { params: Promise<{ comp: string }> }) {
  const [{ comp }, t] = await Promise.all([params, getT()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-ink">{cfg.name} · {t("basketball.toolsTitle")}</h1>
          <Link href={`/dashboard/euro/${cfg.key}`} className="text-xs text-accent-ink hover:underline">
            ← {cfg.name}
          </Link>
        </div>
        <p className="text-sm text-ink-3">{t("basketball.euroToolsSoon")}</p>
      </div>
    </section>
  );
}
