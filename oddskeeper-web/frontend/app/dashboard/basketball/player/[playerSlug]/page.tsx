import Link from "next/link";
import {
  getBasketballPlayer,
  getBasketballPlayerAny,
  getBasketballPlayerMatchLog,
  getBasketballPlayerEuroSeasons,
  getBasketballPlayerEuroLog,
} from "@/features/basketball/server/getBasketballStats";
import PlayerProfileTabs from "@/features/basketball/components/PlayerProfileTabs";
import { bslPlayerToComp, euroSeasonToComp, emptyBslComp } from "@/features/basketball/unified";
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

  // Seçili sezonda veri yoksa kimliği en yeni sezondan çek → boş şablon (takım gibi).
  const identity = player ?? (await getBasketballPlayerAny(playerSlug));

  const comps = player
    ? [bslPlayerToComp(player, log), ...euroSeasons.map((s) => euroSeasonToComp(s, euroLog))]
    : identity || euroSeasons.length > 0
      ? [emptyBslComp(seasonLabel, identity?.team_name ?? null), ...euroSeasons.map((s) => euroSeasonToComp(s, euroLog))]
      : [];

  // Oyuncu fotografi: once SofaScore yuz-kirpimli headshot (sofascore_player_id varsa),
  // yoksa EuroLeague headshot'ina dus (cortextech, yalniz EL/EC oynayanlarda var).
  const sid = player?.sofascore_player_id ?? identity?.sofascore_player_id;
  const photoUrl = sid
    ? `https://img.sofascore.com/api/v1/player/${sid}/image`
    : euroSeasons.find((s) => s.image_url)?.image_url ?? null;

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
          {comps.length > 0 && identity ? (
            <PlayerProfileTabs
              name={identity.player_name}
              jerseyNo={identity.jersey_no}
              teamName={identity.team_name}
              teamSlug={identity.team_slug}
              position={identity.position}
              height={identity.height_cm}
              country={identity.country_code}
              country2={identity.country_code2}
              photoUrl={photoUrl}
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
