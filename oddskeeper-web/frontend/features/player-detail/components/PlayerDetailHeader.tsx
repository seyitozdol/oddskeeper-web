import Image from "next/image";
import Link from "next/link";
import { PLAYER_TAB_LABELS, VALID_PLAYER_TABS } from "../constants";
import type { PlayerProfileRow, ValidPlayerTab } from "../types";
import { getTeamDetailHref } from "@/lib/routes";
import { getTeamLogoPath } from "../utils/getTeamLogoPath";
import { formatDecimal } from "../utils/formatDecimal";

type PlayerDetailHeaderProps = {
  profile: PlayerProfileRow;
  activeTab: ValidPlayerTab;
};

function StatInline({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

export function PlayerDetailHeader({
  profile,
  activeTab,
}: PlayerDetailHeaderProps) {
  const backToTeamHref =
    getTeamDetailHref(profile.team_slug)
      ? `${getTeamDetailHref(profile.team_slug)}&tab=squad`
      : "/dashboard/stats-analysis/football/team-stats";

  const logoPath = getTeamLogoPath(profile.team_slug);

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,10,18,0.98))] p-4 shadow-[0_0_40px_rgba(34,104,189,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            {logoPath ? (
              <Image
                src={logoPath}
                alt={profile.team_name}
                width={52}
                height={52}
                className="h-auto max-h-[52px] w-auto max-w-[52px] object-contain"
              />
            ) : (
              <div className="text-xs text-white/35">—</div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7cbcff]">
              Football Player Profile
            </p>

            <h1 className="mt-1 truncate text-3xl font-semibold text-white lg:text-5xl">
              {profile.player_name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
              <span>{profile.team_name}</span>
              <span>•</span>
              <span>{profile.primary_position_code}</span>
              <span>•</span>
              <span>{profile.competition ?? "—"}</span>
              <span>•</span>
              <span>{profile.season_label ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VALID_PLAYER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const href = `/dashboard/stats-analysis/football/player-stats/detail?player=${encodeURIComponent(
              profile.player_slug
            )}&tab=${tab}`;

            return (
              <Link
                key={tab}
                href={href}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
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
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.06]"
          >
            ← Back
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-x-5 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatInline label="Apps" value={profile.appearances} />
        <StatInline label="Starts" value={profile.starts} />
        <StatInline label="Minutes" value={profile.total_minutes} />
        <StatInline label="Goals" value={profile.goals} />
        <StatInline label="Assists" value={profile.assists} />
        <StatInline
          label="Starter %"
          value={`${formatDecimal(profile.starter_rate_pct)}%`}
        />
      </div>
    </div>
  );
}