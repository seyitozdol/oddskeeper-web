import type { PlayerProfileRow } from "../types";
import { formatDate } from "../utils/formatDate";
import { formatDecimal } from "../utils/formatDecimal";

type PlayerOverviewPanelProps = {
  profile: PlayerProfileRow;
};

export function PlayerOverviewPanel({ profile }: PlayerOverviewPanelProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Player Context
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Team
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.team_name}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Competition
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.competition ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Season
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.season_label ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Position Group
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.position_group}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-white/38">
          Season Summary
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Avg Minutes
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {formatDecimal(profile.avg_minutes)}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Sub Appearances
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {profile.sub_appearances}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              First Match
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {formatDate(profile.first_match_datetime)}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Last Match
            </div>
            <div className="mt-1 text-base font-medium text-white">
              {formatDate(profile.last_match_datetime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}