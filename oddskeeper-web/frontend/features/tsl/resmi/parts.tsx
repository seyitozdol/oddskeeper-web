import Image from "next/image";
import Link from "next/link";
import { getCountryFlagUrl, canonicalNationality } from "@/lib/country-flags";
import { formatDate, initials } from "@/features/tsl/lib";
import { zoneColor, zoneForRank, type ZoneStyle } from "@/features/tsl/standingsZones";
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
      // Harici foto CDN'leri (Mackolik) hotlink korumali -> düz img + no-referrer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        referrerPolicy="no-referrer"
        loading="lazy"
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

// Puan durumu baslik + legend etiketleri (ResmiLig / ResmiResults ortak).
export function standingsLabels(t: (key: string) => string): Record<string, string> {
  return {
    rank: t("tsl.rank"),
    team: t("tsl.team"),
    played: t("tsl.played"),
    won: t("tsl.won"),
    drawn: t("tsl.drawn"),
    lost: t("tsl.lost"),
    goals: t("tsl.goalsFA"),
    goalDiff: t("tsl.goalDiff"),
    form: t("tsl.form"),
    points: t("tsl.points"),
    "tsl.zoneUcl": t("tsl.zoneUcl"),
    "tsl.zoneUclQ": t("tsl.zoneUclQ"),
    "tsl.zoneUelQ": t("tsl.zoneUelQ"),
    "tsl.zoneConfQ": t("tsl.zoneConfQ"),
    "tsl.zonePromotion": t("tsl.zonePromotion"),
    "tsl.zonePlayoff": t("tsl.zonePlayoff"),
    "tsl.zoneRelegation": t("tsl.zoneRelegation"),
  };
}

// Kompakt puan durumu tablosu (isimler kesilmez). SofaScore tarzi: solda bolge
// renk cubugu (kume/Avrupa/yukselme), GLS (attigi:yedigi) + Son 5 form kolonlari,
// tablo altinda renk aciklamalari (legend). league: "tsl" | "tff1" | "cup".
export function ResmiStandings({
  standings,
  teamHrefById,
  labels,
  league,
  legend = [],
}: {
  standings: TslStandingRow[];
  teamHrefById: Record<string, string | null>;
  compact?: boolean;
  labels: Record<string, string>;
  league: string;
  legend?: ZoneStyle[];
}) {
  const total = standings.length;
  return (
    <div className="space-y-2">
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
                <Th>{labels.goals}</Th>
                <Th>{labels.goalDiff}</Th>
                <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">{labels.form}</th>
                <th className="px-2 py-2 pr-3 text-right font-semibold text-ink-2">{labels.points}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => {
                const zone = zoneForRank(league, r.rank, total);
                return (
                  <tr
                    key={r.teamId}
                    className={`${i % 2 ? "bg-veil/40" : ""} border-b border-line/50 last:border-0`}
                  >
                    <td className="relative py-1.5 pl-3 pr-1 text-left text-[12px] font-bold tabular-nums text-ink-2">
                      {zone ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 h-full w-[3px]"
                          style={{ backgroundColor: zoneColor(zone) }}
                        />
                      ) : null}
                      {r.rank}
                    </td>
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
                    <Td className="whitespace-nowrap">{r.goalsFor}:{r.goalsAgainst}</Td>
                    <Td className={r.goalDiff > 0 ? "text-pos" : r.goalDiff < 0 ? "text-neg" : ""}>
                      {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                    </Td>
                    <td className="hidden px-2 py-1.5 sm:table-cell">
                      <FormPills form={r.form.slice(-5)} />
                    </td>
                    <td className="px-2 py-1.5 pr-3 text-right text-[14px] font-bold tabular-nums text-ink">{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {legend.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-ink-3">
          {legend.map((z) => (
            <span key={z.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: z.color }}
              />
              {labels[z.labelKey] ?? z.labelKey}
            </span>
          ))}
        </div>
      ) : null}
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
