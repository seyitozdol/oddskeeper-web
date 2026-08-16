import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getPlayerDetailHref } from "@/lib/routes";
import type { ResmiTransfersBundle } from "@/features/tsl/server/resmiLoaders";
import { PlayerFace, PlayerNameLink } from "./parts";
import TransferLogo from "./TransferLogo";

// Transferler sekmesi (Team Rankings ile modeller arasi, TSL-only). Takim
// logolari + tiklanabilir oyuncu/hedef-kulup adlariyla, ucrete gore azalan.
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

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
        {t("tsl.transfers")}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="divide-y divide-line/60">
          {transfers.map((tr, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <PlayerFace photo={tr.photo} name={tr.playerName} size={32} />
              <div className="min-w-0 flex-1">
                <PlayerNameLink
                  name={tr.playerName}
                  href={tr.playerSlug ? getPlayerDetailHref(tr.playerSlug) : null}
                  className="block truncate text-[13px] font-medium text-ink"
                />
                <div className="flex items-center gap-1 text-[11px] text-ink-3">
                  <TransferClub name={tr.fromName} logo={tr.fromLogo} href={null} />
                  <span className="text-ink-3">→</span>
                  <TransferClub name={tr.toName} logo={tr.toLogo} href={tr.toHref} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[13px] font-bold tabular-nums text-accent-ink">
                  {tr.isLoan ? t("tsl.loan") : tr.feeEur ? formatFee(tr.feeEur) : tr.feeText ?? "—"}
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
