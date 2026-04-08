type CompactInfoCardProps = {
  label: string;
  value: string;
};

export function CompactInfoCard({ label, value }: CompactInfoCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}