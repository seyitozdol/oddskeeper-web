import { getLocale, getT } from "@/lib/i18n/server";
import type { PlayersBundle } from "@/features/tsl/server/loaders";
import {
  formMeta,
  formatMetric,
  pickBasis,
  positionLabel,
  usageMeta,
} from "@/features/tsl/lib";
import type { TslLeaderRow, TslPlayerOverview } from "@/features/tsl/types";
import TslMetricNav from "@/features/tsl/shared/TslMetricNav";
import PercentBar from "@/features/tsl/shared/PercentBar";

export default async function RadarPlayers({ data }: { data: PlayersBundle }) {
  const t = await getT();
  const locale = await getLocale();
  const { catalog, metricKey, metric, rows, overview } = data;

  if (!catalog.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const basis = metric?.defaultBasis ?? "total";
  const withVal = rows
    .map((r) => ({ r, v: pickBasis(r, basis) }))
    .filter((x) => x.v != null) as { r: TslLeaderRow; v: number }[];
  withVal.sort((a, b) => b.v - a.v);
  const podium = withVal.slice(0, 3);
  const rest = withVal.slice(3, 24);
  const maxVal = Math.max(1, ...withVal.map((x) => x.v));

  // Yildizlar: en guclu yonu yuksek yuzdelikte olan oyuncular
  const stars = overview
    .filter((p) => p.primaryLabel && (p.primaryPct ?? 0) >= 60 && (p.minutes ?? 0) > 900)
    .sort((a, b) => (b.primaryPct ?? 0) - (a.primaryPct ?? 0))
    .slice(0, 8);

  const podiumTone = ["text-pos", "text-accent-ink", "text-ink"];
  const podiumBg = ["border-pos/40 bg-pos/5", "border-accent/40 bg-accent-soft", "border-line bg-card"];

  return (
    <div className="space-y-5">
      {/* Metrik secici */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{metric?.categoryLabel}</p>
          <h2 className="text-[18px] font-semibold text-ink">{metric?.metricLabel}</h2>
        </div>
        <TslMetricNav catalog={catalog} metricKey={metricKey} accent="pos" />
      </div>

      {/* Podyum */}
      {podium.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {podium.map(({ r, v }, i) => (
            <div key={r.playerId} className={`relative overflow-hidden rounded-2xl border p-5 ${podiumBg[i]}`}>
              <div className="absolute right-4 top-3 text-[40px] font-black leading-none text-ink/5">
                {i + 1}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                #{i + 1} · {r.teamName}
              </div>
              <div className="mt-1 truncate text-[16px] font-bold text-ink">{r.playerName}</div>
              <div className="text-[11px] text-ink-3">{positionLabel(r.positionCode, locale)}</div>
              <div className={`mt-3 text-[30px] font-black tabular-nums ${podiumTone[i]}`}>
                {formatMetric(v, r.valueFormat)}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-3">
                {metric?.metricLabel}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Siralama barlari */}
      <div className="rounded-2xl border border-line bg-card p-2">
        {rest.map(({ r, v }, i) => {
          const pct = Math.max(4, Math.round((v / maxVal) * 100));
          return (
            <div key={r.playerId} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-veil">
              <span className="w-5 text-center text-[12px] font-bold tabular-nums text-ink-3">{i + 4}</span>
              <div className="w-36 shrink-0 sm:w-48">
                <div className="truncate text-[13px] font-medium text-ink">{r.playerName}</div>
                <div className="truncate text-[11px] text-ink-3">{r.teamName}</div>
              </div>
              <div className="hidden flex-1 sm:block">
                <div className="h-2 overflow-hidden rounded-full bg-veil">
                  <div className="h-full rounded-full bg-pos" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="w-14 text-right text-[14px] font-bold tabular-nums text-ink">
                {formatMetric(v, r.valueFormat)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Sezonun yildizlari (rol + form + guclu yonler) */}
      {stars.length ? (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {t("tsl.seasonStars")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stars.map((p) => (
              <StarCard key={p.playerId} p={p} locale={locale} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-ink-3">{t("tsl.dataNote")}</p>
    </div>
  );
}

function StarCard({
  p,
  locale,
}: {
  p: TslPlayerOverview;
  locale: "en" | "tr";
}) {
  const usage = usageMeta(p.usageLabel, locale);
  const form = formMeta(p.formLabel, locale);
  const usageCls =
    usage?.tone === "pos"
      ? "bg-pos/15 text-pos"
      : usage?.tone === "accent"
        ? "bg-accent-soft text-accent-ink"
        : "bg-veil text-ink-3";
  const formCls =
    form?.tone === "pos" ? "text-pos" : form?.tone === "neg" ? "text-neg" : "text-ink-3";
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-ink">{p.playerName}</div>
          <div className="truncate text-[11px] text-ink-3">
            {positionLabel(p.positionCode, locale)} · {p.teamName}
          </div>
        </div>
        {usage ? (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${usageCls}`}>
            {usage.text}
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <StrengthBar label={p.primaryLabel} pct={p.primaryPct} tone="pos" />
        <StrengthBar label={p.secondaryLabel} pct={p.secondaryPct} tone="accent" />
      </div>

      {form ? (
        <div className={`mt-2 text-[11px] ${formCls}`}>
          {form.arrow} {form.text}
        </div>
      ) : null}
    </div>
  );
}

function StrengthBar({
  label,
  pct,
  tone,
}: {
  label: string | null;
  pct: number | null;
  tone: "pos" | "accent";
}) {
  if (!label) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="truncate text-ink-2">{label}</span>
        <span className="ml-2 shrink-0 tabular-nums text-ink-3">{pct ?? "—"}%</span>
      </div>
      <PercentBar pct={pct} tone={tone} />
    </div>
  );
}
