import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { getLocale, getT } from "@/lib/i18n/server";

// Kadro denetimi: sabah cronlarinin yazdigi listeler (izin gate'i yok). Spor ve sekme
// query param ile; icerik lig -> takim -> oyuncu sirali.
//   futbol    : football.squad_audit   (referans Transfermarkt; build_squad_audit.py)
//   basketbol : basketball.squad_audit (referans RealGM; build_bsl_squad_audit.py)

const SPORTS = ["football", "basketball"] as const;
type Sport = (typeof SPORTS)[number];

const TABS: Record<Sport, readonly string[]> = {
  football: ["ours_not_tm", "tm_not_ours", "no_participant_id"],
  basketball: ["ours_not_ref", "ref_not_ours", "no_participant_id", "no_photo"],
};

type AuditRow = {
  section: string;
  league: string;
  team_name: string;
  player_name: string;
  detail: string | null;
  run_at: string;
  ref_fetched_at?: string | null;
};

const TAB_LABEL_KEY: Record<string, string> = {
  ours_not_tm: "squadAudit.tabOursNotTm",
  tm_not_ours: "squadAudit.tabTmNotOurs",
  no_participant_id: "squadAudit.tabNoParticipantId",
  ours_not_ref: "squadAudit.tabOursNotRef",
  ref_not_ours: "squadAudit.tabRefNotOurs",
  no_photo: "squadAudit.tabNoPhoto",
};
const TAB_HINT_KEY: Record<Sport, Record<string, string>> = {
  football: {
    ours_not_tm: "squadAudit.hintOursNotTm",
    tm_not_ours: "squadAudit.hintTmNotOurs",
    no_participant_id: "squadAudit.hintNoParticipantId",
  },
  basketball: {
    ours_not_ref: "squadAudit.hintOursNotRef",
    ref_not_ours: "squadAudit.hintRefNotOurs",
    no_participant_id: "squadAudit.hintNoParticipantIdBasketball",
    no_photo: "squadAudit.hintNoPhoto",
  },
};
const LEAGUES: Record<Sport, { key: string; labelKey: string }[]> = {
  football: [
    { key: "tsl", labelKey: "squadAudit.leagueTsl" },
    { key: "tff1", labelKey: "squadAudit.leagueTff1" },
  ],
  basketball: [{ key: "bsl", labelKey: "squadAudit.leagueBsl" }],
};

export default async function SquadAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sport?: string }>;
}) {
  const { tab: tabParam, sport: sportParam } = await searchParams;
  const sport: Sport = SPORTS.includes(sportParam as Sport) ? (sportParam as Sport) : "football";
  const tabs = TABS[sport];
  const activeTab = tabs.includes(tabParam ?? "") ? (tabParam as string) : tabs[0];

  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  // Futbol 566 satir (2026-08-20) ve transfer penceresinde dalgalaniyor (once 900+
  // gorulmustu); sinirsiz select 1000'de kirpilir. SAYFALA (C-2).
  const rows =
    sport === "football"
      ? await fetchAllPaged<AuditRow>((from, to) =>
          supabase
            .schema("analytics")
            .from("squad_audit_v1")
            .select("section, league, team_name, player_name, detail, run_at")
            .order("section")
            .order("team_name")
            .order("player_name")
            .range(from, to)
            .returns<AuditRow[]>()
        )
      : (
          await fetchAllPaged<Omit<AuditRow, "league">>((from, to) =>
            supabase
              .schema("analytics")
              .from("bb_squad_audit_v1")
              .select("section, team_name, player_name, detail, run_at, ref_fetched_at")
              .order("section")
              .order("team_name")
              .order("player_name")
              .range(from, to)
              .returns<Omit<AuditRow, "league">[]>()
          )
        ).map((r) => ({ ...r, league: "bsl" }));

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.section] = (counts[r.section] ?? 0) + 1;
  const runAt = rows[0]?.run_at ?? null;
  const refAt = rows.find((r) => r.ref_fetched_at)?.ref_fetched_at ?? null;

  const active = rows.filter((r) => r.section === activeTab);
  // lig -> takim -> oyuncular
  const leagues: { labelKey: string; key: string; teams: { team: string; players: AuditRow[] }[] }[] = [];
  for (const { key, labelKey } of LEAGUES[sport]) {
    const lr = active.filter((r) => r.league === key);
    if (!lr.length) continue;
    const teams: { team: string; players: AuditRow[] }[] = [];
    for (const r of lr) {
      const last = teams[teams.length - 1];
      if (last && last.team === r.team_name) last.players.push(r);
      else teams.push({ team: r.team_name, players: [r] });
    }
    leagues.push({ key, labelKey, teams });
  }

  const fmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const fmtDay = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium" });
  const href = (s: Sport, tab?: string) =>
    `/dashboard/squad-audit?${s === "football" ? "" : `sport=${s}&`}${tab ? `tab=${tab}` : ""}`.replace(/[?&]$/, "");

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("squadAudit.title")}</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {t(sport === "football" ? "squadAudit.subtitle" : "squadAudit.subtitleBasketball")}
            {runAt ? ` · ${t("squadAudit.lastRun")}: ${fmt.format(new Date(runAt))}` : ""}
            {refAt ? ` · ${t("squadAudit.refSnapshot")}: ${fmtDay.format(new Date(refAt))}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-veil/70 p-1">
          {SPORTS.map((s) => (
            <Link
              key={s}
              href={href(s)}
              className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${
                sport === s
                  ? "bg-card font-semibold text-ink shadow-sm ring-1 ring-line-strong/60"
                  : "font-medium text-ink-3 hover:bg-card/60 hover:text-ink"
              }`}
            >
              {t(s === "football" ? "squadAudit.sportFootball" : "squadAudit.sportBasketball")}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-veil/70 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={href(sport, tab)}
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

      <p className="mb-4 text-[12px] text-ink-3">{t(TAB_HINT_KEY[sport][activeTab])}</p>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-line bg-veil px-4 py-8 text-center text-sm text-ink-2">
          {t("squadAudit.empty")}
        </div>
      ) : (
        <div className="space-y-5">
          {leagues.map(({ key, labelKey, teams }) => (
            <div key={key}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {t(labelKey)}
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
