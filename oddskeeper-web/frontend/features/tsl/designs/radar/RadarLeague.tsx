import { getLocale, getT } from "@/lib/i18n/server";
import type { LeagueBundle } from "@/features/tsl/server/loaders";
import { formatMetric } from "@/features/tsl/lib";
import type { TslLeaderRow } from "@/features/tsl/types";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import FormPills from "@/features/tsl/shared/FormPills";

export default async function RadarLeague({ data }: { data: LeagueBundle }) {
  const t = await getT();
  await getLocale();
  const { standings, leaders, summary } = data;

  if (!standings.length) {
    return <p className="py-16 text-center text-sm text-ink-3">{t("tsl.noData")}</p>;
  }

  const champ = standings[0];
  const maxPoints = Math.max(...standings.map((s) => s.points), 1);

  const spotlights = [
    { key: t("tsl.topScorer"), row: leaders.goals[0], tone: "accent" as const },
    { key: t("tsl.topAssist"), row: leaders.assists[0], tone: "pos" as const },
    { key: t("tsl.topRated"), row: leaders.rating[0], tone: "accent" as const },
    { key: t("tsl.topXg"), row: leaders.xg[0], tone: "pos" as const },
  ].filter((s) => s.row);

  return (
    <div className="space-y-5">
      {/* Sampiyon hero + ozet */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-accent-soft p-6">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative flex items-center gap-5">
            <TeamCrest logo={champ.logo} name={champ.teamName} size="xl" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-on-accent">
                  {t("tsl.champion")}
                </span>
                {champ.formLabel ? (
                  <span className="text-[11px] text-accent-ink">{champ.formLabel}</span>
                ) : null}
              </div>
              <h2 className="mt-1.5 truncate text-2xl font-bold text-ink">{champ.teamName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
                <span>
                  <b className="text-ink">{champ.points}</b> {t("tsl.points")}
                </span>
                <span className="tabular-nums">
                  {champ.wins}
                  <span className="text-ink-3">{t("tsl.won")}</span> {champ.draws}
                  <span className="text-ink-3">{t("tsl.drawn")}</span> {champ.losses}
                  <span className="text-ink-3">{t("tsl.lost")}</span>
                </span>
                <span className="tabular-nums">
                  {champ.goalsFor}:{champ.goalsAgainst}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {champ.attackLabel ? <Chip tone="accent">{champ.attackLabel}</Chip> : null}
                {champ.defenceLabel ? <Chip tone="pos">{champ.defenceLabel}</Chip> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Ozet mini kartlar */}
        <div className="grid grid-cols-2 gap-2">
          <SummaryTile label={t("tsl.goals")} value={summary.totalGoals.toString()} />
          <SummaryTile label={t("tsl.goalsPerMatch")} value={summary.goalsPerMatch.toFixed(2)} />
          <SummaryTile label={t("tsl.matches")} value={summary.matchesPlayed.toString()} />
          <SummaryTile
            label={`${t("tsl.homeWin")} / ${t("tsl.awayWin")}`}
            value={`${summary.homeWinPct}·${summary.awayWinPct}%`}
          />
        </div>
      </div>

      {/* Sezonun yildizlari (spotlight) */}
      <div>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {t("tsl.seasonStars")}
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {spotlights.map((s) => (
            <Spotlight key={s.key} label={s.key} row={s.row!} tone={s.tone} />
          ))}
        </div>
      </div>

      {/* Gorsel puan durumu */}
      <div className="rounded-2xl border border-line bg-card p-2">
        {standings.map((r) => (
          <div
            key={r.teamId}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-veil"
          >
            <span className="w-6 text-center text-[13px] font-bold tabular-nums text-ink-3">{r.rank}</span>
            <TeamCrest logo={r.logo} name={r.teamName} size="md" />
            <div className="w-32 shrink-0 sm:w-44">
              <div className="truncate text-[14px] font-semibold text-ink">{r.teamName}</div>
              <div className="text-[11px] text-ink-3">
                {r.wins}-{r.draws}-{r.losses} · {r.goalsFor}:{r.goalsAgainst}
              </div>
            </div>
            <div className="hidden flex-1 items-center gap-3 md:flex">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-veil">
                <div
                  className={`h-full rounded-full ${r.rank === 1 ? "bg-accent" : r.rank <= 5 ? "bg-accent/60" : r.rank > standings.length - 3 ? "bg-neg/60" : "bg-ink-3/50"}`}
                  style={{ width: `${(r.points / maxPoints) * 100}%` }}
                />
              </div>
              <FormPills form={r.form} />
            </div>
            <span className="w-9 text-right text-[16px] font-bold tabular-nums text-ink">{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "accent" | "pos" }) {
  const cls = tone === "pos" ? "bg-pos/15 text-pos" : "bg-card/60 text-accent-ink";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-line bg-card px-4 py-3">
      <div className="text-[20px] font-bold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-3">{label}</div>
    </div>
  );
}

function Spotlight({
  label,
  row,
  tone,
}: {
  label: string;
  row: TslLeaderRow;
  tone: "accent" | "pos";
}) {
  const ring = tone === "pos" ? "text-pos" : "text-accent-ink";
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className={`mt-2 text-[26px] font-black tabular-nums ${ring}`}>
        {formatMetric(row.total, row.valueFormat)}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold text-ink">{row.playerName}</div>
      <div className="truncate text-[11px] text-ink-3">{row.teamName}</div>
    </div>
  );
}
