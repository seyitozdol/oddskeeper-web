import Image from "next/image";
import type { MatchTeamStatsRow } from "../types";
import { formatDecimal } from "../utils/formatDecimal";

type MatchTeamStatsPanelProps = {
  rows: MatchTeamStatsRow[];
};

type MetricRow = {
  label: string;
  homeRaw: number | string | null;
  awayRaw: number | string | null;
  homeDisplay: string;
  awayDisplay: string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function toDisplay(value: number | string | null | undefined, digits = 0) {
  if (value === null || value === undefined || value === "") return "—";

  const numeric = Number(value);

  if (Number.isNaN(numeric)) return "—";

  if (digits > 0) {
    return formatDecimal(numeric, digits);
  }

  return String(numeric);
}

function getTeamLogoPath(teamSlug?: string | null) {
  if (!teamSlug) return null;
  return `/images/football_logos/${teamSlug}.png`;
}

function TeamLogo({
  teamSlug,
  teamName,
}: {
  teamSlug?: string | null;
  teamName?: string | null;
}) {
  const logoPath = getTeamLogoPath(teamSlug);

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
      {logoPath ? (
        <Image
          src={logoPath}
          alt={teamName ?? "Team"}
          width={22}
          height={22}
          className="h-auto max-h-[22px] w-auto max-w-[22px] object-contain"
        />
      ) : (
        <div className="text-[10px] text-white/35">—</div>
      )}
    </div>
  );
}

function SplitBar({
  homeValue,
  awayValue,
}: {
  homeValue: number;
  awayValue: number;
}) {
  const total = homeValue + awayValue;

  const homeRatio = total > 0 ? homeValue / total : 0;
  const awayRatio = total > 0 ? awayValue / total : 0;

  const homeWidth = `${homeRatio * 50}%`;
  const awayWidth = `${awayRatio * 50}%`;

  return (
    <div className="relative h-2 w-full rounded-full bg-white/[0.05] overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.08]" />

      <div
        className="absolute right-1/2 top-0 h-full rounded-l-full bg-white/85"
        style={{ width: homeWidth }}
      />

      <div
        className="absolute left-1/2 top-0 h-full rounded-r-full bg-[#4da2ff]"
        style={{ width: awayWidth }}
      />
    </div>
  );
}

export function MatchTeamStatsPanel({ rows }: MatchTeamStatsPanelProps) {
  const home = rows.find((row) => row.team_side === "home");
  const away = rows.find((row) => row.team_side === "away");

  if (!home || !away) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/65">
        No team stats found for this match.
      </div>
    );
  }

  const metrics: MetricRow[] = [
    {
      label: "Expected goals (xG)",
      homeRaw: home.details_expected_goals,
      awayRaw: away.details_expected_goals,
      homeDisplay: toDisplay(home.details_expected_goals, 3),
      awayDisplay: toDisplay(away.details_expected_goals, 3),
    },
    {
      label: "Total shots",
      homeRaw: home.summary_shots,
      awayRaw: away.summary_shots,
      homeDisplay: toDisplay(home.summary_shots),
      awayDisplay: toDisplay(away.summary_shots),
    },
    {
      label: "Shots on target",
      homeRaw: home.summary_shots_on_target,
      awayRaw: away.summary_shots_on_target,
      homeDisplay: toDisplay(home.summary_shots_on_target),
      awayDisplay: toDisplay(away.summary_shots_on_target),
    },
    {
      label: "Blocked shots",
      homeRaw: home.summary_blocked_shots,
      awayRaw: away.summary_blocked_shots,
      homeDisplay: toDisplay(home.summary_blocked_shots),
      awayDisplay: toDisplay(away.summary_blocked_shots),
    },
    {
      label: "Corner kicks",
      homeRaw: home.summary_corners_won,
      awayRaw: away.summary_corners_won,
      homeDisplay: toDisplay(home.summary_corners_won),
      awayDisplay: toDisplay(away.summary_corners_won),
    },
    {
      label: "Passes",
      homeRaw: home.summary_passes,
      awayRaw: away.summary_passes,
      homeDisplay: toDisplay(home.summary_passes),
      awayDisplay: toDisplay(away.summary_passes),
    },
    {
      label: "Accurate pass",
      homeRaw: home.details_accurate_pass,
      awayRaw: away.details_accurate_pass,
      homeDisplay: toDisplay(home.details_accurate_pass),
      awayDisplay: toDisplay(away.details_accurate_pass),
    },
    {
      label: "Tackles",
      homeRaw: home.summary_tackles,
      awayRaw: away.summary_tackles,
      homeDisplay: toDisplay(home.summary_tackles),
      awayDisplay: toDisplay(away.summary_tackles),
    },
    {
      label: "Yellow cards",
      homeRaw: home.summary_yellow_cards,
      awayRaw: away.summary_yellow_cards,
      homeDisplay: toDisplay(home.summary_yellow_cards),
      awayDisplay: toDisplay(away.summary_yellow_cards),
    },
    {
      label: "Red cards",
      homeRaw: home.summary_red_cards,
      awayRaw: away.summary_red_cards,
      homeDisplay: toDisplay(home.summary_red_cards),
      awayDisplay: toDisplay(away.summary_red_cards),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.95),rgba(5,10,18,0.99))] px-4 py-4 md:px-5 md:py-5">
      <div
        className="grid items-center gap-3 border-b border-white/10 pb-3"
        style={{ gridTemplateColumns: "44px 1fr 44px" }}
      >
        <div className="flex justify-start">
          <TeamLogo teamSlug={home.team_slug} teamName={home.team_name} />
        </div>

        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
          Top Stats
        </div>

        <div className="flex justify-end">
          <TeamLogo teamSlug={away.team_slug} teamName={away.team_name} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {metrics.map((metric) => {
          const homeNumeric = toNumber(metric.homeRaw);
          const awayNumeric = toNumber(metric.awayRaw);

          return (
            <div key={metric.label}>
              <div
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: "72px 1fr 72px" }}
              >
                <div className="text-left text-[15px] font-semibold text-white">
                  {metric.homeDisplay}
                </div>

                <div className="text-center text-[14px] font-medium text-white">
                  {metric.label}
                </div>

                <div className="text-right text-[15px] font-semibold text-white">
                  {metric.awayDisplay}
                </div>
              </div>

              <div className="mt-2">
                <SplitBar
                  homeValue={homeNumeric}
                  awayValue={awayNumeric}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}