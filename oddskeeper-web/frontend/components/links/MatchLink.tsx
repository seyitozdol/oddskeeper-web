import Link from "next/link";
import type { ReactNode } from "react";
import { getMatchDetailHref } from "@/lib/routes";

type MatchLinkProps = {
  sourceMatchId?: string | null;
  tab?: string;
  returnTo?: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function MatchLink({
  sourceMatchId,
  tab,
  returnTo,
  children,
  className,
  title,
}: MatchLinkProps) {
  const href = getMatchDetailHref(sourceMatchId, tab, returnTo);

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