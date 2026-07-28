import Tff1Explorer from "@/features/tff1/components/Tff1Explorer";
import {
  getTff1MarketValues,
  getTff1PlayerSeasonStats,
  getTff1TeamLogos,
  getTff1TeamSeasonStats,
} from "@/features/tff1/server/getTff1Stats";
import type { Tff1MarketValue } from "@/features/tff1/types";
import { getT } from "@/lib/i18n/server";

export default async function Tff1LigPage() {
  const [players, teams, mvRows, logoRows, t] = await Promise.all([
    getTff1PlayerSeasonStats(),
    getTff1TeamSeasonStats(),
    getTff1MarketValues(),
    getTff1TeamLogos(),
    getT(),
  ]);

  const marketValues: Record<string, Tff1MarketValue> = {};
  for (const row of mvRows) marketValues[row.player_id] = row;
  const teamLogos: Record<string, string> = {};
  for (const row of logoRows) if (row.logo_url) teamLogos[row.team_id] = row.logo_url;

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-ink">
            {t("tff1.kicker")}
          </p>

          <h1 className="text-3xl font-semibold text-ink lg:text-5xl">
            {t("tff1.title")}
          </h1>

          <p className="mt-3 text-sm text-ink-2">{t("tff1.subtitle")}</p>
        </div>

        {players.length === 0 && teams.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-line bg-veil p-6 text-sm text-ink-2">
            {t("tff1.noRows")}
          </div>
        ) : (
          <Tff1Explorer
            players={players}
            teams={teams}
            marketValues={marketValues}
            teamLogos={teamLogos}
          />
        )}
      </div>
    </section>
  );
}
