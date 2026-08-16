import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getPlayerDetailHref } from "@/lib/routes";
import type { ResmiTransfersBundle } from "@/features/tsl/server/resmiLoaders";
import type { ResmiTransfer } from "@/features/tsl/server/resmi";
import { PlayerFace, PlayerNameLink } from "./parts";
import TransferLogo from "./TransferLogo";

// Transferler sekmesi (TSL-only). Gelenler + Ayrılanlar iki sütun; takım
// logolari + tiklanabilir oyuncu/kulup adlariyla, ucrete gore azalan.
export default async function ResmiTransfers({
  data,
}: {
  data: ResmiTransfersBundle;
}) {
  const t = await getT();
  const { transfers } = data;

  if (!transfers.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const arrivals = transfers.filter((tr) => tr.isArrival);
  const departures = transfers.filter((tr) => !tr.isArrival);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      <TransferColumn title={t("tsl.transfersIn")} rows={arrivals} loanLabel={t("tsl.loan")} empty={t("tsl.noData")} />
      <TransferColumn title={t("tsl.transfersOut")} rows={departures} loanLabel={t("tsl.loan")} empty={t("tsl.noData")} />
    </div>
  );
}

function TransferColumn({
  title,
  rows,
  loanLabel,
  empty,
}: {
  title: string;
  rows: ResmiTransfer[];
  loanLabel: string;
  empty: string;
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
        {title}
        <span className="rounded-full bg-veil px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-3">
          {rows.length}
        </span>
      </h2>
      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="divide-y divide-line/60">
            {rows.map((tr, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                <PlayerFace photo={tr.photo} name={tr.playerName} size={32} />
                <div className="min-w-0 flex-1">
                  <PlayerNameLink
                    name={tr.playerName}
                    href={tr.playerSlug ? getPlayerDetailHref(tr.playerSlug) : null}
                    className="block truncate text-[13px] font-medium text-ink"
                  />
                  <div className="flex items-center gap-1 text-[11px] text-ink-3">
                    <TransferClub name={tr.fromName} logo={tr.fromLogo} href={tr.fromHref} />
                    <span className="text-ink-3">→</span>
                    <TransferClub name={tr.toName} logo={tr.toLogo} href={tr.toHref} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[13px] font-bold tabular-nums text-accent-ink">
                    {tr.isLoan ? loanLabel : tr.feeEur ? formatFee(tr.feeEur) : tr.feeText ?? "—"}
                  </span>
                  {tr.isLoan && tr.feeEur ? (
                    <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
                      {formatFee(tr.feeEur)}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card py-10 text-center text-[12px] text-ink-3">{empty}</p>
      )}
    </div>
  );
}

function TransferClub({
  name,
  logo,
  href,
}: {
  name: string | null;
  logo: string | null;
  href: string | null;
}) {
  const inner = (
    <span className="inline-flex max-w-[130px] items-center gap-1 truncate">
      <TransferLogo logo={logo} name={name} />
      <span className="truncate">{name ?? "—"}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="transition hover:text-ink hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function formatFee(eur: number): string {
  if (eur >= 1_000_000) {
    const m = eur / 1_000_000;
    return `€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (eur >= 1000) return `€${Math.round(eur / 1000)}K`;
  return `€${eur}`;
}
