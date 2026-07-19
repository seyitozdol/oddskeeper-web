"use client";

import { useRouter } from "next/navigation";

type SeasonSelectProps = {
  teamSlug: string;
  seasons: string[];
  selectedSeason: string | null;
};

export function SeasonSelect({
  teamSlug,
  seasons,
  selectedSeason,
}: SeasonSelectProps) {
  const router = useRouter();

  if (seasons.length <= 1) {
    return null;
  }

  return (
    <select
      value={selectedSeason ?? seasons[0]}
      onChange={(event) => {
        const params = new URLSearchParams();
        params.set("team", teamSlug);
        params.set("tab", "team-statistics");
        params.set("season", event.target.value);
        router.push(
          `/dashboard/stats-analysis/football/team-stats/detail?${params.toString()}`
        );
      }}
      className="rounded-lg border border-white/10 bg-[#0d1624] px-3 py-1.5 text-[12px] text-white outline-none transition focus:border-[#4da2ff]/40"
    >
      {seasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
    </select>
  );
}
