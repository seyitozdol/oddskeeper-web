import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEuroPlayer, getEuroPlayerLog } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor } from "@/features/euroleague/config";
import { euroLeaderToComp } from "@/features/euroleague/unified";
import { normalizePlayerName } from "@/features/basketball/unified";
import { EURO_SEASONS } from "@/features/euroleague/config";
import PlayerProfileTabs from "@/features/basketball/components/PlayerProfileTabs";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function EuroPlayerPage({
  params, searchParams,
}: {
  params: Promise<{ comp: string; personCode: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp, personCode }, { season }, t] = await Promise.all([params, searchParams, getT()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const seasonLabel = normalizeSeason(season);
  const seasonCode = seasonCodeFor(cfg.code, seasonLabel);
  const player = await getEuroPlayer(cfg.code, seasonCode, personCode);
  const base = `/dashboard/euro/${cfg.key}`;

  if (!player) {
    return (
      <section className="w-full"><div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundPlayer")}</p>
      </div></section>
    );
  }

  // BSL'de eşleşen (Türk) oyuncu ise birleşik BSL profiline yönlendir (kulvar toggle'lı).
  if (player.bsl_player_slug) {
    redirect(`/dashboard/basketball/player/${player.bsl_player_slug}?season=${seasonLabel}`);
  }

  // Euro-only (Türk olmayan) oyuncu: aynı birleşik profil, tek kulvar.
  const log = await getEuroPlayerLog(cfg.code, seasonCode, personCode);
  const comps = [euroLeaderToComp(player, log)];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="flex items-center justify-between gap-3">
          <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>
        <div className="mt-4">
          <PlayerProfileTabs name={normalizePlayerName(player.player_name)} teamName={player.team_name} photoUrl={player.image_url} comps={comps} />
        </div>
      </div>
    </section>
  );
}
