import { initials } from "../lib";

const SIZES: Record<string, { box: string; text: string; px: number }> = {
  xs: { box: "h-4 w-4", text: "text-[8px]", px: 16 },
  sm: { box: "h-5 w-5", text: "text-[9px]", px: 20 },
  md: { box: "h-7 w-7", text: "text-[11px]", px: 28 },
  lg: { box: "h-10 w-10", text: "text-[13px]", px: 40 },
  xl: { box: "h-14 w-14", text: "text-base", px: 56 },
};

export default function TeamCrest({
  logo,
  name,
  size = "sm",
}: {
  logo: string | null | undefined;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size] ?? SIZES.sm;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name ?? ""}
        referrerPolicy="no-referrer"
        className={`${s.box} shrink-0 object-contain`}
        style={{ width: s.px, height: s.px }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={`${s.box} ${s.text} flex shrink-0 items-center justify-center rounded-full bg-veil font-semibold text-ink-3`}
    >
      {initials(name ?? "?")}
    </span>
  );
}
