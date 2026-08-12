import Link from "next/link";
import type { ReactNode } from "react";

// Modern sekme cubugu: hap seklinde kapsayici, aktif sekme kabarik kart.
// Takim detay basligi (futbol) + TFF1 takim sayfasi ortak kullanir.

export function TabPillBar({ children }: { children: ReactNode }) {
  return (
    <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-veil/70 p-1">
      {children}
    </nav>
  );
}

export function TabPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm whitespace-nowrap transition ${
        active
          ? "bg-card font-semibold text-ink shadow-sm ring-1 ring-line-strong/60"
          : "font-medium text-ink-3 hover:bg-card/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
