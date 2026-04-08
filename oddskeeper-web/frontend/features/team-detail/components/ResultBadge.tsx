import { getResultBadgeClass } from "../utils/getResultBadgeClass";

type ResultBadgeProps = {
  resultCode: "W" | "D" | "L" | null;
  compact?: boolean;
};

export function ResultBadge({
  resultCode,
  compact = false,
}: ResultBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-semibold ${getResultBadgeClass(
        resultCode
      )} ${compact ? "min-w-[28px] px-2 py-[2px] text-[10px]" : "min-w-[30px] px-2 py-0.5 text-[11px]"}`}
    >
      {resultCode ?? "—"}
    </span>
  );
}