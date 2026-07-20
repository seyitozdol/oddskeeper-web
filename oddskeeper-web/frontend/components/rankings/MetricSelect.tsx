"use client";

import { useRouter } from "next/navigation";

type MetricOption = {
  key: string;
  label: string;
  category: string;
};

type MetricSelectProps = {
  options: MetricOption[];
  selectedKey: string | null;
  basePath: string;
  // metric dışındaki korunacak parametreler (team/player/season/view vb.)
  baseParams: Record<string, string>;
};

// Kategoriye göre gruplanmış tek bir açılır menü: eski çip duvarının
// kapladığı alanın çok küçük bir kısmında aynı işi görür.
export default function MetricSelect({
  options,
  selectedKey,
  basePath,
  baseParams,
}: MetricSelectProps) {
  const router = useRouter();

  const groups = new Map<string, MetricOption[]>();
  for (const option of options) {
    if (!groups.has(option.category)) {
      groups.set(option.category, []);
    }
    groups.get(option.category)!.push(option);
  }

  return (
    <select
      value={selectedKey ?? ""}
      onChange={(event) => {
        const params = new URLSearchParams(baseParams);
        params.set("metric", event.target.value);
        router.push(`${basePath}?${params.toString()}`);
      }}
      className="min-w-[220px] rounded-lg border border-white/10 bg-[#0d1624] px-3 py-2 text-[13px] text-white outline-none transition focus:border-[#4da2ff]/40"
    >
      {Array.from(groups.entries()).map(([category, groupOptions]) => (
        <optgroup key={category} label={category}>
          {groupOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
