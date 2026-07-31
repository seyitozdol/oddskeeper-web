import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getT } from "@/lib/i18n/server";
import { formatDate } from "@/features/tsl/lib";
import { RESMI_BASE_PATH } from "@/features/tsl/constants";
import {
  getTslMatch,
  getTslMatchPlayers,
  type TslMatchPlayer,
} from "@/features/tsl/server/match";
import TeamCrest from "@/features/tsl/shared/TeamCrest";

function statusRank(s: string | null): number {
  if (s === "starter") return 0;
  if (s === "substitute") return 1;
  return 2;
}

export default async function TslMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { matchId } = await params;
  const { returnTo } = await searchParams;
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const match = await getTslMatch(matchId);
  if (!match) notFound();
  const players = await getTslMatchPlayers(matchId);

  const home = players
    .filter((p) => p.teamId === match.homeId)
    .sort((a, b) => statusRank(a.lineupStatus) - statusRank(b.lineupStatus) || (b.minutes ?? 0) - (a.minutes ?? 0));
  const away = players
    .filter((p) => p.teamId === match.awayId)
    .sort((a, b) => statusRank(a.lineupStatus) - statusRank(b.lineupStatus) || (b.minutes ?? 0) - (a.minutes ?? 0));

  const back = returnTo && returnTo.startsWith("/dashboard") ? returnTo : RESMI_BASE_PATH;

  return (
    <section className="px-4 py-6 lg:px-8">
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-[13px] text-ink-2 transition hover:text-ink">
        ‹ {t("tsl.backToDesigns")}
      </Link>

      {/* Skor basligi */}
      <div className="mb-6 rounded-2xl border border-line bg-card p-6">
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="truncate text-right text-[16px] font-semibold text-ink">{match.homeName}</span>
            <TeamCrest logo={match.homeLogo} name={match.homeName} size="xl" />
          </div>
          <div className="shrink-0 text-center">
            <div className="text-[28px] font-black tabular-nums text-ink">
              {match.homeScore ?? "–"} <span className="text-ink-3">-</span> {match.awayScore ?? "–"}
            </div>
            <div className="mt-1 text-[11px] text-ink-3">
              {formatDate(match.datetime, locale)} · {match.competition}
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <TeamCrest logo={match.awayLogo} name={match.awayName} size="xl" />
            <span className="truncate text-[16px] font-semibold text-ink">{match.awayName}</span>
          </div>
        </div>
      </div>

      {/* Kadrolar */}
      <div className="grid gap-5 xl:grid-cols-2">
        <TeamTable title={match.homeName} rows={home} t={t} />
        <TeamTable title={match.awayName} rows={away} t={t} />
      </div>
    </section>
  );
}

function TeamTable({
  title,
  rows,
  t,
}: {
  title: string;
  rows: TslMatchPlayer[];
  t: (k: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <h2 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold text-ink">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-ink-3">
              <th className="py-2 pl-4 text-left font-medium">{t("tsl.player")}</th>
              <Th>{t("tsl.minutes")}</Th>
              <Th>{t("tsl.rating")}</Th>
              <Th>{t("tsl.goals")}</Th>
              <Th>A</Th>
              <Th>Ş</Th>
              <Th>{t("tsl.topKeyPass")}</Th>
              <Th>T</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const isGk = (p.positionCode ?? "").toUpperCase() === "G";
              return (
                <tr key={p.playerId} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink">{p.playerName}</span>
                      {p.lineupStatus === "substitute" ? (
                        <span className="rounded bg-veil px-1 text-[9px] text-ink-3">yd</span>
                      ) : null}
                      {p.positionCode ? (
                        <span className="text-[10px] text-ink-3">{p.positionCode}</span>
                      ) : null}
                    </div>
                  </td>
                  <Td>{p.minutes ?? "—"}</Td>
                  <Td className={p.rating != null ? "font-semibold text-ink" : ""}>
                    {p.rating != null ? p.rating.toFixed(1) : "—"}
                  </Td>
                  <Td className={p.goals ? "font-bold text-pos" : ""}>{p.goals ?? 0}</Td>
                  <Td>{p.assists ?? 0}</Td>
                  <Td>{isGk ? (p.saves ?? 0) : (p.shots ?? 0)}</Td>
                  <Td>{p.keyPasses ?? 0}</Td>
                  <Td>{p.tackles ?? 0}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-center font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 text-center tabular-nums text-ink-2 ${className}`}>{children}</td>;
}
