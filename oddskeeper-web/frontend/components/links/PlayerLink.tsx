import Link from "next/link";
import type { ReactNode } from "react";
import { getPlayerDetailHref } from "@/lib/routes";

type PlayerLinkProps = {
  playerSlug?: string | null;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function PlayerLink({
  playerSlug,
  children,
  className,
  title,
}: PlayerLinkProps) {
  const href = getPlayerDetailHref(playerSlug);

  if (!href) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}