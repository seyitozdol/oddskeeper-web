import Image from "next/image";
import Link from "next/link";
import { getCountryFlagUrl, canonicalNationality } from "@/lib/country-flags";
import { standingsZone } from "@/features/tsl/constants";
import { formatDate, initials } from "@/features/tsl/lib";
import type { Locale } from "@/lib/i18n/config";
import type { TslMatch, TslStandingRow } from "@/features/tsl/types";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import FormPills from "@/features/tsl/shared/FormPills";

export function Flag({ nationality }: { nationality: string | null }) {
  if (!nationality) return null;
  const url = getCountryFlagUrl(nationality);
  const label = canonicalNationality(nationality) ?? nationality;
  if (!url) return null;
  return (
    <Image
      src={url}
      alt={label}
      width={16}
      height={12}
      className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
    />
  );
}

export function PlayerFace({
  photo,
  name,
  size = 36,
}: {
  photo: string | null;
  name: string;
  size?: number;
}) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-line bg-veil object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-veil text-[11px] font-semibold text-ink-3"
      style={{ width: size, height: size }}
    >
      {initials(name ?? "?")}
    </span>
  );
}

export function TeamNameLink({
  name,
  href,
  className = "",
}: {
  name: string | null;
  href: string | null | undefined;
  className?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={`transition hover:text-ink hover:underline ${className}`}>
        {name}
      </Link>
    );
  }
  return <span className={className}>{name}</span>;
}

export function PlayerNameLink({
  name,
  href,
  className = "",
}: {
  name: string;
  href: string | null | undefined;
  className?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={`transition hover:underline ${className}`} title={name}>
        {name}
      </Link>
    );
  }
  return <span className={className}>{name}</span>;
}

// Kompakt puan durumu tablosu (isimler kesilmez).
export function ResmiStandings({
  standings,
  teamHrefById,
  compact = true,
  labels,
}: {
  standings: TslStandingRow[];
  teamHrefById: Record<string, string | null>;
  compact?: boolean;
  labels: Record<string, string>;
}) {
  const total = standings.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-ink-3">
              <th className="py-2 pl-3 pr-1 text-left font-medium">{labels.rank}</th>
              <th className="px-1 py-2 text-left font-medium">{labels.team}</th>
              <Th>{labels.played}</Th>
              <Th>{labels.won}</Th>
              <Th>{labels.drawn}</Th>
              <Th>{labels.lost}</Th>
              <Th>{labels.goalDiff}</Th>
              {!compact ? (
                <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">{labels.form}</th>
              ) : null}
              <th className="px-2 py-2 pr-3 text-right font-semibold text-ink-2">{labels.points}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r, i) => {
              const zone = standingsZone(r.rank, total);
              const band =
                zone === "champion"
                  ? "border-l-2 border-l-accent"
                  : zone === "europe"
                    ? "border-l-2 border-l-accent/40"
                    : zone === "relegation"
                      ? "border-l-2 border-l-neg"
                      : "border-l-2 border-l-transparent";
              return (
                <tr
                  key={r.teamId}
                  className={`${band} ${i % 2 ? "bg-veil/40" : ""} border-b border-line/50 last:border-0`}
                >
                  <td className="py-1.5 pl-3 pr-1 text-left text-[12px] font-bold tabular-nums text-ink-2">{r.rank}</td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-2">
                      <TeamCrest logo={r.logo} name={r.teamName} size="sm" />
                      <TeamNameLink
                        name={r.teamName}
                        href={teamHrefById[r.teamId]}
                        className="whitespace-nowrap font-medium text-ink"
                      />
                    </div>
                  </td>
                  <Td>{r.played}</Td>
                  <Td className="text-pos">{r.wins}</Td>
                  <Td>{r.draws}</Td>
                  <Td className="text-neg">{r.losses}</Td>
                  <Td className={r.goalDiff > 0 ? "text-pos" : r.goalDiff < 0 ? "text-neg" : ""}>
                    {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                  </Td>
                  {!compact ? (
                    <td className="hidden px-2 py-1.5 sm:table-cell">
                      <FormPills form={r.form} />
                    </td>
                  ) : null}
                  <td className="px-2 py-1.5 pr-3 text-right text-[14px] font-bold tabular-nums text-ink">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tek maç satırı (sonuç veya fikstür), maç detayına link (matchBase'den kurulur).
export function MatchRow({
  match,
  locale,
  returnTo,
  matchBase,
  teamHrefById,
}: {
  match: TslMatch;
  locale: Locale;
  returnTo: string;
  matchBase: string;
  teamHrefById?: Record<string, string | null>;
}) {
  const isFixture = match.homeScore < 0;
  const homeHref = isFixture ? teamHrefById?.[match.homeId] ?? null : null;
  const awayHref = isFixture ? teamHrefById?.[match.awayId] ?? null : null;
  const inner = (
    <div className="flex items-center gap-2 px-3 py-2 text-[12px] transition hover:bg-veil">
      <span className="w-10 shrink-0 text-[10px] text-ink-3">{formatDate(match.datetime, locale)}</span>
      <div className="flex flex-1 items-center gap-1.5 truncate">
        <TeamCrest logo={match.homeLogo} name={match.homeName} size="xs" />
        <TeamNameLink name={match.homeName} href={homeHref} className="truncate text-ink-2" />
      </div>
      <span className="shrink-0 rounded-md bg-veil px-2 py-0.5 font-bold tabular-nums text-ink">
        {isFixture ? "–" : `${match.homeScore}-${match.awayScore}`}
      </span>
      <div className="flex flex-1 items-center justify-end gap-1.5 truncate">
        <TeamNameLink name={match.awayName} href={awayHref} className="truncate text-right text-ink-2" />
        <TeamCrest logo={match.awayLogo} name={match.awayName} size="xs" />
      </div>
    </div>
  );
  if (isFixture) return inner;
  const href = `${matchBase}/${encodeURIComponent(match.matchId)}?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-center font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 text-center tabular-nums text-ink-2 ${className}`}>{children}</td>;
}
