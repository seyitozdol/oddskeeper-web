import Image from "next/image";
import Link from "next/link";
import { PLAYER_TAB_LABELS, VALID_PLAYER_TABS } from "../constants";
import type { PlayerProfileRow, ValidPlayerTab } from "../types";
import { PlayerStatCard } from "./PlayerStatCard";
import { getTeamDetailHref } from "@/lib/routes";
import { getTeamLogoPath } from "../utils/getTeamLogoPath";
import { formatDecimal } from "../utils/formatDecimal";

type PlayerDetailHeaderProps = {
  profile: PlayerProfileRow;
  activeTab: ValidPlayerTab;
};

export function PlayerDetailHeader({
  profile,
  activeTab,
}: PlayerDetailHeaderProps) {
  const backToTeamHref =
    getTeamDetailHref(profile.team_slug)
      ? `${getTeamDetailHref(profile.team_slug)}&tab=squad`
      : "/dashboard/stats-analysis/football/team-stats";

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-6 shadow-[0_0_50px_rgba(34,104,189,0.08)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <Image
              src={getTeamLogoPath(profile.team_slug)}
              alt={profile.team_name}
              width={64}
              height={64}
              className="h-auto max-h-[64px] w-auto max-w-[64px] object-contain"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7cbcff]">
              Football Player Profile
            </p>

            <div className="mt-2 text-sm font-medium text-white/70">
              {profile.team_name}
            </div>

            <h1 className="mt-1 text-3xl font-semibold text-white lg:text-5xl">
              {profile.player_name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
              <span>{profile.primary_position_code}</span>
              <span>•</span>
              <span>{profile.competition ?? "—"}</span>
              <span>•</span>
              <span>{profile.season_label ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {VALID_PLAYER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const href = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
              profile.player_slug
            )}&tab=${tab}`;

            return (
              <Link
                key={tab}
                href={href}
                className={`rounded-xl border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-[#4da2ff]/40 bg-[#10335d]/70 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
                }`}
              >
                {PLAYER_TAB_LABELS[tab]}
              </Link>
            );
          })}

          <Link
            href={backToTeamHref}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06]"
          >
            ← Back to team
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <PlayerStatCard label="Appearances" value={profile.appearances} />
        <PlayerStatCard label="Starts" value={profile.starts} />
        <PlayerStatCard label="Minutes" value={profile.total_minutes} />
        <PlayerStatCard label="Goals" value={profile.goals} />
        <PlayerStatCard label="Assists" value={profile.assists} />
        <PlayerStatCard
          label="Starter %"
          value={`${formatDecimal(profile.starter_rate_pct)}%`}
        />
      </div>
    </div>
  );
}