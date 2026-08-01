import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEuroComp, EURO_SEASONS } from "@/features/euroleague/config";
import {
  getEuroToolsSplits, getEuroToolsForms, getEuroToolsWindows,
  getEuroToolsTeamLogs, getEuroToolsPlayerList,
} from "@/features/euroleague/toolsServer";
import BasketballParticipantTools from "@/features/basketball/components/BasketballParticipantTools";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

// EL/EC Match-Player Tools — BSL araçlarının EL/EC portu (aynı bileşen, el_* tools view'ları).
// pm sayı (PM Pts Model odds tab'ı) hariç; Config/Player List/Fixtures/Model/Input tam.
// Sezon seçici (?season); default 2025-2026 (verili sezon; 2026-27 oynanınca dolar).
const DEFAULT_TOOLS_SEASON = "2025-2026";
const normalizeToolsSeason = (s: string | undefined) =>
  (EURO_SEASONS as readonly string[]).includes(s ?? "") ? (s as string) : DEFAULT_TOOLS_SEASON;

export default async function EuroToolsPage({
  params, searchParams,
}: {
  params: Promise<{ comp: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp }, { season }, t] = await Promise.all([params, searchParams, getT()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const code = cfg.code; // 'E' | 'U'
  const seasonLabel = normalizeToolsSeason(season);

  const [splits, forms, windows, teamLogs, players] = await Promise.all([
    getEuroToolsSplits(code, seasonLabel),
    getEuroToolsForms(code, seasonLabel),
    getEuroToolsWindows(code, seasonLabel),
    getEuroToolsTeamLogs(code, seasonLabel),
    getEuroToolsPlayerList(code, seasonLabel),
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
          <div className="flex items-center gap-3">
            <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
            <Link href={`/dashboard/euro/${cfg.key}`} className="text-xs text-accent-ink hover:underline">
              ← {cfg.name}
            </Link>
          </div>
        </div>
        <BasketballParticipantTools splits={splits} forms={forms} windows={windows} teamLogs={teamLogs}
          players={players} league={cfg.key} toolsBase={`/dashboard/euro/${cfg.key}`} />
      </div>
    </section>
  );
}
