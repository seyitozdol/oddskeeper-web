import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEuroComp } from "@/features/euroleague/config";
import {
  getEuroToolsSplits, getEuroToolsForms, getEuroToolsWindows,
  getEuroToolsTeamLogs, getEuroToolsPlayerList,
} from "@/features/euroleague/toolsServer";
import BasketballParticipantTools from "@/features/basketball/components/BasketballParticipantTools";
import { getT } from "@/lib/i18n/server";

// EL/EC Match-Player Tools — BSL araçlarının EL/EC portu (aynı bileşen, el_* tools view'ları).
// pm sayı (PM Pts Model odds tab'ı) hariç; Config/Player List/Fixtures/Model/Input tam.
// Veri sezonu: oynanmış sezon (2025-2026). league = cfg.key (euroleague/eurocup).
const DATA_SEASON = "2025-2026";

export default async function EuroToolsPage({ params }: { params: Promise<{ comp: string }> }) {
  const [{ comp }, t] = await Promise.all([params, getT()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const code = cfg.code; // 'E' | 'U'

  const [splits, forms, windows, teamLogs, players] = await Promise.all([
    getEuroToolsSplits(code, DATA_SEASON),
    getEuroToolsForms(code, DATA_SEASON),
    getEuroToolsWindows(code, DATA_SEASON),
    getEuroToolsTeamLogs(code, DATA_SEASON),
    getEuroToolsPlayerList(code, DATA_SEASON),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logo} alt={cfg.name} width={28} height={28} className="h-7 w-7 object-contain" />
            <h1 className="text-lg font-semibold text-ink">{cfg.name} · {t("basketball.toolsTitle")}</h1>
          </div>
          <Link href={`/dashboard/euro/${cfg.key}`} className="text-xs text-accent-ink hover:underline">
            ← {cfg.name}
          </Link>
        </div>
        <BasketballParticipantTools splits={splits} forms={forms} windows={windows} teamLogs={teamLogs}
          players={players} league={cfg.key} toolsBase={`/dashboard/euro/${cfg.key}`} />
      </div>
    </section>
  );
}
