import Link from "next/link";
import {
  getVbTeamMatches,
  getVbPlayerMatches,
  getVbToolsPlayers,
  getVbTeams,
} from "@/features/volleyball/server/getVolleyballTools";
import VolleyballTools from "@/features/volleyball/components/VolleyballTools";
import { getT } from "@/lib/i18n/server";

export default async function VolleyballToolsPage() {
  const [teamMatches, playerMatches, players, teams, t] = await Promise.all([
    getVbTeamMatches(),
    getVbPlayerMatches(),
    getVbToolsPlayers(),
    getVbTeams(),
    getT(),
  ]);

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/flags/tr.png" alt="Türkiye" width={32} height={22} className="h-[22px] w-8 rounded-[3px] object-cover" />
            <h1 className="text-lg font-semibold text-ink">{t("volleyball.toolsTitle")}</h1>
          </div>
          <Link href="/dashboard/volleyball" className="text-xs text-accent-ink hover:underline">
            ← {t("volleyball.title")}
          </Link>
        </div>

        <VolleyballTools teamMatches={teamMatches} playerMatches={playerMatches} players={players} teams={teams} />
      </div>
    </section>
  );
}
