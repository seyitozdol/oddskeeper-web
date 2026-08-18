import Link from "next/link";
import type { ReactNode } from "react";

// Takim sayfalari icin sol mini menu: bolucu cizgili dikey liste, sticky
// (sekmeler arasi ayni yerde sabit). Mobilde yatay kaydirilabilir serit.
// TFF1 + Super Lig takim sayfalari ortak kullanir. Ikonlar currentColor
// kullanir; metinle ayni renkte gorunur.

export type SideTabItem = {
  key: string;
  href: string;
  label: string;
  icon?: ReactNode;
  count?: number | null;
};

export function SideTabMenu({
  items,
  activeKey,
  teamName,
  teamLogo,
}: {
  items: SideTabItem[];
  activeKey: string;
  // Menunun ustunde takim kimligi (logo + ad); her sekmede ayni yerde durur.
  teamName?: string;
  teamLogo?: string | null;
}) {
  return (
    <aside className="overflow-hidden rounded-xl border border-line bg-card lg:sticky lg:top-20">
      {teamName ? (
        <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-b from-card-2 to-card px-4 py-3">
          {teamLogo ? (
            // Harici CDN (SofaScore/FlashScore) hotlink referrer'i bloklar +
            // Vercel optimizer bunlari guvenilmez ceker -> plain img + no-referrer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo}
              alt={teamName}
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 object-contain"
            />
          ) : null}
          <span className="truncate text-[14px] font-semibold leading-tight text-ink">
            {teamName}
          </span>
        </div>
      ) : null}
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
            <span className="flex items-center gap-2 whitespace-nowrap">
              {m.icon ? <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{m.icon}</span> : null}
              {m.label}
            </span>
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
