type CompactInfoCardProps = {
  label: string;
  value: string;
};

export function CompactInfoCard({ label, value }: CompactInfoCardProps) {
  return (
    <div className="rounded-xl border border-line bg-veil px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}