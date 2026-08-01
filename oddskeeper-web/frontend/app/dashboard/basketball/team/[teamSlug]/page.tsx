import Link from "next/link";
import {
  getBasketballTeam,
  getBasketballTeamRoster,
  getBasketballTeamMatchLog,
  getBasketballTeamModel,
} from "@/features/basketball/server/getBasketballStats";
import {
  getEuroTeamsForBslSlug,
  getEuroTeamRoster,
  getEuroTeamLog,
} from "@/features/euroleague/server";
import { bslTeamToComp } from "@/features/basketball/unified";
import { euroTeamToComp } from "@/features/euroleague/unified";
import TeamProfileTabs from "@/features/basketball/components/TeamProfileTabs";
import BasketballOdds from "@/features/basketball/components/BasketballOdds";
import { normalizeSeason, EURO_SEASONS } from "@/features/euroleague/config";
import SeasonToggle from "@/components/SeasonToggle";
import { getT } from "@/lib/i18n/server";

export default async function BasketballTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ teamSlug }, { season }, t] = await Promise.all([params, searchParams, getT()]);
  const seasonLabel = normalizeSeason(season);
  const [team, roster, log, model, euroTeams] = await Promise.all([
    getBasketballTeam(teamSlug, seasonLabel),
    getBasketballTeamRoster(teamSlug, seasonLabel),
    getBasketballTeamMatchLog(teamSlug, seasonLabel),
    getBasketballTeamModel(teamSlug, seasonLabel),
    getEuroTeamsForBslSlug(teamSlug, seasonLabel),
  ]);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
        ← {t("basketball.backToLeague")}
      </Link>
      <SeasonToggle seasons={EURO_SEASONS} current={seasonLabel} />
    </div>
  );

  if (!team) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          {header}
          <p className="mt-6 text-sm text-ink-3">{t("basketball.noData")}</p>
        </div>
      </section>
    );
  }

  // Euro (EL/EC) kulvarlarını çek (varsa)
  const euroComps = await Promise.all(
    euroTeams.map(async (et) => {
      const code = et.competition as "E" | "U";
      const [er, el] = await Promise.all([
        getEuroTeamRoster(code, et.season_code, et.team_code),
        getEuroTeamLog(code, et.season_code, et.team_code),
      ]);
      return euroTeamToComp(et, er, el);
    })
  );

  const comps = [bslTeamToComp(team, log, roster), ...euroComps];

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        {header}
        <div className="mt-4">
          <TeamProfileTabs name={team.team_name} teamSlug={team.team_slug} comps={comps} />
        </div>

        {model.length > 0 ? (
          <>
            <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("basketball.odds")}</h2>
            <BasketballOdds models={model} defaultPayback={0.915} />
          </>
        ) : null}
      </div>
    </section>
  );
}
