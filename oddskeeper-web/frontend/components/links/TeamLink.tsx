import Link from "next/link";
import type { ReactNode } from "react";
import { getTeamDetailHref } from "@/lib/routes";

type TeamLinkProps = {
  teamSlug?: string | null;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function TeamLink({
  teamSlug,
  children,
  className,
  title,
}: TeamLinkProps) {
  const href = getTeamDetailHref(teamSlug);

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