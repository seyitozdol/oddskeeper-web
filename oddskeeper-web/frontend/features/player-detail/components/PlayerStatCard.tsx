type PlayerStatCardProps = {
  label: string;
  value: string | number;
};

export function PlayerStatCard({ label, value }: PlayerStatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}