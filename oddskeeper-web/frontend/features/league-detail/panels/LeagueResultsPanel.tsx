import MatchLink from "@/components/links/MatchLink";
import TeamLink from "@/components/links/TeamLink";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";

type LeagueResultRow = {
  source_match_id: string | null;
  competition: string | null;
  season_label: string | null;
  match_datetime: string | null;
  match_date: string | null;
  home_team_source_id: string | null;
  home_team_slug: string | null;
  home_team_name: string | null;
  away_team_source_id: string | null;
  away_team_slug: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  match_status: string | null;
  result_code: "H" | "A" | "D" | string | null;
  round_number?: number | null;
};

type LeagueResultsPanelProps = {
  rows?: LeagueResultRow[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMatchDetailHref(sourceMatchId?: string | null, returnTo?: string) {
  if (!sourceMatchId || !sourceMatchId.trim()) return null;

  const params = new URLSearchParams();
  params.set("match", sourceMatchId);

  if (returnTo && returnTo.trim()) {
    params.set("returnTo", returnTo);
  }

  return `/dashboard/stats-analysis/football/match-stats/detail?${params.toString()}`;
}

function getResultBadgeClass(resultCode: LeagueResultRow["result_code"]) {
  if (resultCode === "H") {
    return "border-pos/25 bg-pos/10 text-pos";
  }

  if (resultCode === "A") {
    return "border-neg/25 bg-neg/10 text-neg";
  }

  if (resultCode === "D") {
    return "border-amber-500/25 bg-amber-400/15 text-amber-500";
  }

  return "border-line bg-veil text-ink-2";
}

function getResultLabel(t: Translator, resultCode: LeagueResultRow["result_code"]) {
  if (resultCode === "H") return t("common.home");
  if (resultCode === "A") return t("common.away");
  if (resultCode === "D") return t("leagueDetail.resultDraw");
  return "—";
}

function TeamNameLink({
  teamSlug,
  teamName,
}: {
  teamSlug: string | null | undefined;
  teamName: string | null | undefined;
}) {
  const displayName = teamName ?? "—";

  if (!teamSlug) {
    return <span>{displayName}</span>;
  }

  return (
    <TeamLink
      teamSlug={teamSlug}
      className="font-medium text-ink transition hover:text-ink hover:underline"
      title={displayName}
    >
      {displayName}
    </TeamLink>
  );
}

export async function LeagueResultsPanel({ rows = [] }: LeagueResultsPanelProps) {
  const t = await getT();
  const resultsReturnTo =
    "/dashboard/stats-analysis/football/league-stats/detail?competition=S%C3%BCper%20Lig&season=2025%2F2026&tab=results";

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
            {t("leagueDetail.tabResults")}
          </div>
          <div className="text-sm text-ink-2">{t("leagueDetail.matchesCount", { count: 0 })}</div>
        </div>

        <div className="rounded-xl border border-line bg-veil px-3 py-3 text-sm text-ink-2">
          {t("leagueDetail.noResultsFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
          {t("leagueDetail.tabResults")}
        </div>
        <div className="text-sm text-ink-2">{t("leagueDetail.matchesCount", { count: rows.length })}</div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full border-collapse">
          <thead className="bg-field">
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-3">
              <th className="px-3 py-2 font-medium">{t("common.date")}</th>
              <th className="px-3 py-2 font-medium">{t("common.home")}</th>
              <th className="px-3 py-2 font-medium">{t("common.score")}</th>
              <th className="px-3 py-2 font-medium">{t("common.away")}</th>
              <th className="px-3 py-2 font-medium">{t("common.result")}</th>
              <th className="px-3 py-2 font-medium">{t("leagueDetail.colVenue")}</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const matchHref = getMatchDetailHref(
                row.source_match_id,
                resultsReturnTo,
              );

              return (
                <tr
                  key={row.source_match_id ?? `${row.match_datetime}-${row.home_team_name}-${row.away_team_name}`}
                  className="border-t border-line text-[13px] text-ink transition hover:bg-veil"
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {matchHref ? (
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={resultsReturnTo}
                        className="transition hover:text-ink hover:underline"
                        title={t("leagueDetail.openMatchDetail")}
                      >
                        {formatDate(row.match_datetime ?? row.match_date)}
                      </MatchLink>
                    ) : (
                      <span>{formatDate(row.match_datetime ?? row.match_date)}</span>
                    )}
                  </td>

                  <td className="px-3 py-1.5 min-w-[220px] text-ink">
                    <TeamNameLink
                      teamSlug={row.home_team_slug}
                      teamName={row.home_team_name}
                    />
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-ink">
                    {matchHref ? (
                      <MatchLink
                        sourceMatchId={row.source_match_id}
                        returnTo={resultsReturnTo}
                        className="transition hover:text-ink hover:underline"
                        title={t("leagueDetail.openMatchDetail")}
                      >
                        {row.home_score ?? "—"} - {row.away_score ?? "—"}
                      </MatchLink>
                    ) : (
                      <span>
                        {row.home_score ?? "—"} - {row.away_score ?? "—"}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-1.5 min-w-[220px] text-ink">
                    <TeamNameLink
                      teamSlug={row.away_team_slug}
                      teamName={row.away_team_name}
                    />
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span
                      className={`inline-flex min-w-[56px] items-center justify-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase ${getResultBadgeClass(
                        row.result_code,
                      )}`}
                    >
                      {getResultLabel(t, row.result_code)}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-2">
                    {row.venue ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
