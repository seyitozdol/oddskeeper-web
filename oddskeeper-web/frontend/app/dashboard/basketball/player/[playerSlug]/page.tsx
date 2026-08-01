import Link from "next/link";
import {
  getBasketballPlayer,
  getBasketballPlayerMatchLog,
  getBasketballPlayerEuroSeasons,
  getBasketballPlayerEuroLog,
} from "@/features/basketball/server/getBasketballStats";
import PlayerProfileTabs from "@/features/basketball/components/PlayerProfileTabs";
import { bslPlayerToComp, euroSeasonToComp } from "@/features/basketball/unified";
import { normalizeSeason, EURO_SEASONS } from "@/features/euroleague/config";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function BasketballPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerSlug: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ playerSlug }, { season }, t] = await Promise.all([params, searchParams, getT()]);
  const seasonLabel = normalizeSeason(season);
  const [player, log, euroSeasons, euroLog] = await Promise.all([
    getBasketballPlayer(playerSlug, seasonLabel),
    getBasketballPlayerMatchLog(playerSlug, seasonLabel),
    getBasketballPlayerEuroSeasons(playerSlug, seasonLabel),
    getBasketballPlayerEuroLog(playerSlug, seasonLabel),
  ]);

  const comps = player
    ? [bslPlayerToComp(player, log), ...euroSeasons.map((s) => euroSeasonToComp(s, euroLog))]
    : [];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>
        <div className="mt-4">
          {player ? (
            <PlayerProfileTabs
              name={player.player_name}
              jerseyNo={player.jersey_no}
              teamName={player.team_name}
              teamSlug={player.team_slug}
              photoUrl={euroSeasons.find((s) => s.image_url)?.image_url ?? null}
              comps={comps}
            />
          ) : (
            <p className="mt-6 text-sm text-ink-3">{t("basketball.noData")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
