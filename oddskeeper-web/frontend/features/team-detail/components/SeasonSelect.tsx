"use client";

import { useRouter } from "next/navigation";

type SeasonSelectProps = {
  teamSlug: string;
  tab: string;
  seasons: string[];
  selectedSeason: string | null;
  extraParams?: Record<string, string>;
  // Sezon listesinin başına eklenen özel seçenek (ör. fikstür sekmesinde
  // "Yaklaşan fikstür"); seçilince season parametresi URL'den kaldırılır.
  leadingOption?: { value: string; label: string } | null;
};

export function SeasonSelect({
  teamSlug,
  tab,
  seasons,
  selectedSeason,
  extraParams,
  leadingOption,
}: SeasonSelectProps) {
  const router = useRouter();

  if (seasons.length <= 1 && !leadingOption) {
    return null;
  }

  return (
    <select
      value={selectedSeason ?? leadingOption?.value ?? seasons[0]}
      onChange={(event) => {
        const params = new URLSearchParams();
        params.set("team", teamSlug);
        params.set("tab", tab);
        if (event.target.value !== (leadingOption?.value ?? "")) {
          params.set("season", event.target.value);
        }
        for (const [key, value] of Object.entries(extraParams ?? {})) {
          params.set(key, value);
        }
        router.push(
          `/dashboard/stats-analysis/football/team-stats/detail?${params.toString()}`
        );
      }}
      className="rounded-lg border border-line bg-field px-3 py-1.5 text-[12px] text-ink outline-none transition focus:border-line-strong"
    >
      {leadingOption ? (
        <option value={leadingOption.value}>{leadingOption.label}</option>
      ) : null}
      {seasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
    </select>
  );
}
