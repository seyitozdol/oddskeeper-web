import Link from "next/link";

// Takim sayfalari icin sol mini menu: bolucu cizgili dikey liste, sticky
// (sekmeler arasi ayni yerde sabit). Mobilde yatay kaydirilabilir serit.
// TFF1 + Super Lig takim sayfalari ortak kullanir.

export type SideTabItem = {
  key: string;
  href: string;
  label: string;
  count?: number | null;
};

export function SideTabMenu({
  items,
  activeKey,
}: {
  items: SideTabItem[];
  activeKey: string;
}) {
  return (
    <aside className="overflow-hidden rounded-xl border border-line bg-card lg:sticky lg:top-20">
      <nav className="flex flex-row overflow-x-auto lg:flex-col lg:divide-y lg:divide-line/60">
        {items.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className={`flex flex-1 items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition lg:flex-none ${
              activeKey === m.key
                ? "border-l-2 border-l-accent bg-veil font-semibold text-ink"
                : "border-l-2 border-l-transparent font-medium text-ink-2 hover:bg-veil/60 hover:text-ink"
            }`}
          >
            <span className="whitespace-nowrap">{m.label}</span>
            {m.count != null ? (
              <span className="rounded-md bg-card-2 px-1.5 py-0.5 text-[11px] leading-none text-ink-3">
                {m.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
