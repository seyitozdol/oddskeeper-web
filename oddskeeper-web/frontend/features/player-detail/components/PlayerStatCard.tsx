type PlayerStatCardProps = {
  label: string;
  value: string | number;
};

export function PlayerStatCard({ label, value }: PlayerStatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-veil px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink">
        {value}
      </div>
    </div>
  );
}
