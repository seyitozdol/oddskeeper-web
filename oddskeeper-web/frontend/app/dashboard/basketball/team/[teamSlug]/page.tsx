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
import { getT } from "@/lib/i18n/server";

const SEASON = "2025-2026";

export default async function BasketballTeamPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const [team, roster, log, model, euroTeams, t] = await Promise.all([
    getBasketballTeam(teamSlug),
    getBasketballTeamRoster(teamSlug),
    getBasketballTeamMatchLog(teamSlug),
    getBasketballTeamModel(teamSlug),
    getEuroTeamsForBslSlug(teamSlug, SEASON),
    getT(),
  ]);

  if (!team) {
    return (
      <section className="w-full">
        <div className="rounded-2xl border border-line bg-card p-8">
          <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
            ← {t("basketball.backToLeague")}
          </Link>
          <p className="mt-6 text-sm text-ink-3">{t("basketball.notFoundTeam")}</p>
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
        <Link href="/dashboard/basketball" className="text-xs text-accent-ink hover:underline">
          ← {t("basketball.backToLeague")}
        </Link>
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
