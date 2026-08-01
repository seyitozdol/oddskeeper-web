import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEuroTeam, getEuroTeamRoster, getEuroTeamLog } from "@/features/euroleague/server";
import { resolveEuroComp, normalizeSeason, seasonCodeFor } from "@/features/euroleague/config";
import { euroTeamToComp } from "@/features/euroleague/unified";
import { EURO_SEASONS } from "@/features/euroleague/config";
import TeamProfileTabs from "@/features/basketball/components/TeamProfileTabs";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function EuroTeamPage({
  params, searchParams,
}: {
  params: Promise<{ comp: string; teamCode: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ comp, teamCode }, { season }, t] = await Promise.all([params, searchParams, getT()]);
  const cfg = resolveEuroComp(comp);
  if (!cfg) notFound();
  const seasonLabel = normalizeSeason(season);
  const seasonCode = seasonCodeFor(cfg.code, seasonLabel);
  const team = await getEuroTeam(cfg.code, seasonCode, teamCode);
  const base = `/dashboard/euro/${cfg.key}`;

  if (!team) {
    return (
      <section className="w-full"><div className="rounded-2xl border border-line bg-card p-8">
        <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
        <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundTeam")}</p>
      </div></section>
    );
  }

  // Türk takımı ise birleşik BSL takım profiline yönlendir (kulvar toggle'lı).
  if (team.bsl_team_slug) {
    redirect(`/dashboard/basketball/team/${team.bsl_team_slug}`);
  }

  const [roster, log] = await Promise.all([
    getEuroTeamRoster(cfg.code, seasonCode, teamCode),
    getEuroTeamLog(cfg.code, seasonCode, teamCode),
  ]);
  const comps = [euroTeamToComp(team, roster, log)];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="flex items-center justify-between gap-3">
          <Link href={base} className="text-xs text-accent-ink hover:underline">← {cfg.name}</Link>
          <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
        </div>
        <div className="mt-4">
          <TeamProfileTabs name={team.team_name} crestUrl={team.crest_url} comps={comps} />
        </div>
      </div>
    </section>
  );
}
