import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getT } from "@/lib/i18n/server";

// Kadro denetimi: sabah TM cronunun yazdigi 3 liste (herkese acik, izin
// gate'i yok). Sekmeler query param ile; icerik lig -> takim -> oyuncu sirali.

const TABS = ["ours_not_tm", "tm_not_ours", "no_participant_id"] as const;
type AuditTab = (typeof TABS)[number];

type AuditRow = {
  section: string;
  league: string;
  team_name: string;
  player_name: string;
  detail: string | null;
  run_at: string;
};

const TAB_LABEL_KEY: Record<AuditTab, string> = {
  ours_not_tm: "squadAudit.tabOursNotTm",
  tm_not_ours: "squadAudit.tabTmNotOurs",
  no_participant_id: "squadAudit.tabNoParticipantId",
};
const TAB_HINT_KEY: Record<AuditTab, string> = {
  ours_not_tm: "squadAudit.hintOursNotTm",
  tm_not_ours: "squadAudit.hintTmNotOurs",
  no_participant_id: "squadAudit.hintNoParticipantId",
};

export default async function SquadAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const activeTab: AuditTab = TABS.includes(tabParam as AuditTab)
    ? (tabParam as AuditTab)
    : "ours_not_tm";

  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data } = await supabase
    .schema("analytics")
    .from("squad_audit_v1")
    .select("section, league, team_name, player_name, detail, run_at")
    .returns<AuditRow[]>();
  const rows = data ?? [];

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.section] = (counts[r.section] ?? 0) + 1;
  const runAt = rows[0]?.run_at ?? null;

  const active = rows.filter((r) => r.section === activeTab);
  // lig -> takim -> oyuncular
  const leagues: { league: string; teams: { team: string; players: AuditRow[] }[] }[] = [];
  for (const league of ["tsl", "tff1"]) {
    const lr = active.filter((r) => r.league === league);
    if (!lr.length) continue;
    const teams: { team: string; players: AuditRow[] }[] = [];
    for (const r of lr) {
      const last = teams[teams.length - 1];
      if (last && last.team === r.team_name) last.players.push(r);
      else teams.push({ team: r.team_name, players: [r] });
    }
    leagues.push({ league, teams });
  }

  const fmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">{t("squadAudit.title")}</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {t("squadAudit.subtitle")}
          {runAt ? ` · ${t("squadAudit.lastRun")}: ${fmt.format(new Date(runAt))}` : ""}
        </p>
      </div>

      <div className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-veil/70 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/squad-audit?tab=${tab}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm whitespace-nowrap transition ${
              activeTab === tab
                ? "bg-card font-semibold text-ink shadow-sm ring-1 ring-line-strong/60"
                : "font-medium text-ink-3 hover:bg-card/60 hover:text-ink"
            }`}
          >
            {t(TAB_LABEL_KEY[tab])}
            <span className="rounded-md bg-veil px-1.5 py-0.5 text-[11px] leading-none text-ink-2">
              {counts[tab] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <p className="mb-4 text-[12px] text-ink-3">{t(TAB_HINT_KEY[activeTab])}</p>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-line bg-veil px-4 py-8 text-center text-sm text-ink-2">
          {t("squadAudit.empty")}
        </div>
      ) : (
        <div className="space-y-5">
          {leagues.map(({ league, teams }) => (
            <div key={league}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {league === "tsl" ? t("squadAudit.leagueTsl") : t("squadAudit.leagueTff1")}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {teams.map(({ team, players }) => (
                  <div key={team} className="rounded-xl border border-line bg-card">
                    <div className="flex items-center justify-between border-b border-line bg-veil px-3 py-2">
                      <span className="text-[13px] font-semibold text-ink">{team}</span>
                      <span className="text-[11px] text-ink-3">
                        {t("squadAudit.playersCount", { count: String(players.length) })}
                      </span>
                    </div>
                    <ul className="divide-y divide-line/60">
                      {players.map((p, i) => (
                        <li
                          key={`${p.player_name}-${i}`}
                          className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] text-ink-2"
                        >
                          <span className="truncate">{p.player_name}</span>
                          {p.detail ? (
                            <span className="shrink-0 tabular-nums text-ink-3">{p.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
