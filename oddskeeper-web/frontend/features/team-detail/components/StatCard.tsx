type StatCardProps = {
  label: string;
  value: string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-veil px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}