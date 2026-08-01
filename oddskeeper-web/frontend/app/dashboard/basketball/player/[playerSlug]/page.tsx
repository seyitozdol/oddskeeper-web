import Link from "next/link";
import {
  getBasketballPlayer,
  getBasketballPlayerMatchLog,
  getBasketballPlayerEuroSeasons,
  getBasketballPlayerEuroLog,
} from "@/features/basketball/server/getBasketballStats";
import PlayerProfileTabs from "@/features/basketball/components/PlayerProfileTabs";
import { bslPlayerToComp, euroSeasonToComp } from "@/features/basketball/unified";
import { getT } from "@/lib/i18n/server";

export default async function BasketballPlayerPage({
  params,
}: {
  params: Promise<{ playerSlug: string }>;
}) {
  const { playerSlug } = await params;
  const [player, log, euroSeasons, euroLog, t] = await Promise.all([
    getBasketballPlayer(playerSlug),
    getBasketballPlayerMatchLog(playerSlug),
    getBasketballPlayerEuroSeasons(playerSlug),
    getBasketballPlayerEuroLog(playerSlug),
    getT(),
  ]);

  if (!player) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
          <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundPlayer")}</p>
        </div>
      </section>
    );
  }

  const comps = [
    bslPlayerToComp(player, log),
    ...euroSeasons.map((s) => euroSeasonToComp(s, euroLog)),
  ];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
          ← {t("basketball.backToLeague")}
        </Link>
        <div className="mt-4">
          <PlayerProfileTabs
            name={player.player_name}
            jerseyNo={player.jersey_no}
            teamName={player.team_name}
            teamSlug={player.team_slug}
            comps={comps}
          />
        </div>
      </div>
    </section>
  );
}
