import { FORM_STYLE } from "../lib";
import type { FormResult } from "../types";

export default function FormPills({
  form,
  size = "sm",
}: {
  form: FormResult[];
  size?: "sm" | "md";
}) {
  if (!form.length) return <span className="text-ink-3">—</span>;
  const dim = size === "md" ? "h-6 w-6 text-[11px]" : "h-5 w-5 text-[10px]";
  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`${dim} ${FORM_STYLE[r]} flex items-center justify-center rounded-md border font-bold tabular-nums`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
