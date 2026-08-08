"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  TRACKED_SPORTS,
  type TrackedSport,
  type UpcomingEventRow,
} from "../types";
import { eventStarCount } from "../priority";

// Kullanıcı Malta'da; tüm saatler Malta saatine göre gösterilir.
const TZ = "Europe/Malta";

type SiteKey = "bet365" | "bets10" | "oddsportal";

const SPORT_ICON: Record<TrackedSport, string> = {
  football: "/icons/football.svg",
  basketball: "/icons/basketball.svg",
  volleyball: "/icons/volleyball.svg",
};

const SPORT_LABEL_KEY: Record<TrackedSport, string> = {
  football: "upcomingEvents.football",
  basketball: "upcomingEvents.basketball",
  volleyball: "upcomingEvents.volleyball",
};

// Istanbul saatine gore YYYY-MM-DD (gun gruplama anahtari).
function istanbulDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function UpcomingEventsPanel({
  events,
}: {
  events: UpcomingEventRow[];
}) {
  const { t, locale } = useI18n();
  const [sportFilter, setSportFilter] = useState<TrackedSport | "all">("all");
  // "Low Profile Gizle": yıldızı olmayan (öncelik puanı 0) maçları listeden çıkar.
  const [hideLowProfile, setHideLowProfile] = useState(false);
  // Hydration uyusmazligini onlemek icin geri sayim yalnizca mount sonrasi
  // hesaplanir; her 30 sn'de bir tazelenir.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Low Profile gizliyken yıldızsız maçlar sayımlardan da düşülür.
  const visibleEvents = useMemo(
    () =>
      hideLowProfile ? events.filter((e) => eventStarCount(e) > 0) : events,
    [events, hideLowProfile]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visibleEvents.length };
    for (const sport of TRACKED_SPORTS) {
      c[sport] = visibleEvents.filter((e) => e.sport === sport).length;
    }
    return c;
  }, [visibleEvents]);

  const filtered = useMemo(
    () =>
      sportFilter === "all"
        ? visibleEvents
        : visibleEvents.filter((e) => e.sport === sportFilter),
    [visibleEvents, sportFilter]
  );

  const dayGroups = useMemo(() => {
    const groups = new Map<string, UpcomingEventRow[]>();
    for (const e of filtered) {
      const key = istanbulDayKey(new Date(e.start_ts));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const timeFmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayFmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    weekday: "long",
  });

  const todayKey = istanbulDayKey(new Date());
  const tomorrowKey = istanbulDayKey(new Date(Date.now() + 86_400_000));

  function dayLabel(key: string, first: UpcomingEventRow): string {
    const formatted = dayFmt.format(new Date(first.start_ts));
    if (key === todayKey) return `${t("upcomingEvents.today")}, ${formatted}`;
    if (key === tomorrowKey) return `${t("upcomingEvents.tomorrow")}, ${formatted}`;
    return formatted;
  }

  function countdown(e: UpcomingEventRow): {
    text: string;
    tone: "live" | "soon" | "normal";
  } {
    if (e.status_type === "inprogress") {
      const score =
        e.home_score != null && e.away_score != null
          ? ` ${e.home_score}:${e.away_score}`
          : "";
      return { text: `${t("upcomingEvents.live")}${score}`, tone: "live" };
    }
    if (now == null) return { text: "", tone: "normal" };
    const diffMin = Math.round((new Date(e.start_ts).getTime() - now) / 60_000);
    if (diffMin <= 0) return { text: t("upcomingEvents.started"), tone: "live" };
    const d = Math.floor(diffMin / 1440);
    const h = Math.floor((diffMin % 1440) / 60);
    const m = diffMin % 60;
    const dU = t("upcomingEvents.dayShort");
    const hU = t("upcomingEvents.hourShort");
    const mU = t("upcomingEvents.minuteShort");
    const text =
      d > 0 ? `${d}${dU} ${h}${hU}` : h > 0 ? `${h}${hU} ${m}${mU}` : `${m}${mU}`;
    return { text, tone: diffMin <= 120 ? "soon" : "normal" };
  }

  const badgeClass = (tone: "live" | "soon" | "normal") =>
    tone === "live"
      ? "bg-red-500/15 text-red-500"
      : tone === "soon"
        ? "bg-amber-500/15 text-amber-500"
        : "bg-veil text-ink-2";

  // Uyari: rakip kaynakta (OddsPortal veya bet365) oran VAR ama Bets10'da YOK.
  // Bets10 birincil kaynak; bu durum bir kapsam bosluğu/firsat isaretidir.
  const needsAlert = (e: UpcomingEventRow) =>
    (e.bet365_has_odds === true || e.oddsportal_has_odds === true) &&
    e.bets10_has_odds !== true;

  // Öncelik yıldızları: puan kadar (1..5) küçük sarı yıldız, satır başına 3'lük
  // sararak. Tooltip toplam puanı gösterir.
  function Stars({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
      <span
        className="flex flex-nowrap items-center justify-center gap-[1px]"
        title={t("upcomingEvents.priorityStars", { count })}
      >
        {Array.from({ length: count }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-2.5 w-2.5 shrink-0 text-amber-400"
            aria-hidden="true"
          >
            <path d="M12 2.5l2.9 6.06 6.6.79-4.86 4.53 1.28 6.52L12 17.9l-5.92 3.5 1.28-6.52L2.5 9.35l6.6-.79L12 2.5z" />
          </svg>
        ))}
      </span>
    );
  }

  function AlertIcon() {
    return (
      <span title={t("upcomingEvents.alertBets10Missing")}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 text-red-500"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
    );
  }

  // Marka rozeti (metin yerine gorsel kimlik). Dis logo dosyasi yok; her rozet
  // sitenin marka renginde stillendirilmis kucuk bir isaret.
  function brandBadge(site: SiteKey) {
    if (site === "bets10")
      return (
        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-[3px] bg-[#0aa84f] px-1 text-[10px] font-bold leading-none text-white">
          10
        </span>
      );
    if (site === "bet365")
      return (
        <span className="inline-flex h-4 items-center rounded-[3px] bg-[#027b5b] px-1 text-[10px] font-bold leading-none tracking-tight text-[#ffdf1a]">
          bet365
        </span>
      );
    return (
      <span className="inline-flex h-4 items-center rounded-[3px] bg-[#e8522b] px-1 text-[10px] font-bold leading-none text-white">
        OP
      </span>
    );
  }

  function SiteMark({
    site,
    value,
    marketCount,
    listed,
  }: {
    site: SiteKey;
    value: boolean | null;
    marketCount: number;
    listed: boolean;
  }) {
    if (value) {
      return (
        <span
          className="inline-flex items-center"
          title={t("upcomingEvents.marketCountTitle", { count: marketCount })}
        >
          {brandBadge(site)}
        </span>
      );
    }
    if (!value && listed) {
      return (
        <span
          className="inline-flex opacity-40 grayscale"
          title={t("upcomingEvents.oddsListedTitle")}
        >
          {brandBadge(site)}
        </span>
      );
    }
    return (
      <span className="text-[11px] text-ink-3/50" title={t("upcomingEvents.oddsUnchecked")}>
        ·
      </span>
    );
  }

  // Takım sayfası varsa (Süper Lig / 1. Lig) ad linklenir; yoksa düz metin.
  function TeamName({
    href,
    name,
  }: {
    href: string | null;
    name: string;
  }) {
    if (href) {
      return (
        <Link
          href={href}
          className="font-medium underline-offset-2 transition hover:text-accent-ink hover:underline"
        >
          {name}
        </Link>
      );
    }
    return <span className="font-medium">{name}</span>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...TRACKED_SPORTS] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSportFilter(key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
              sportFilter === key
                ? "border-line-strong bg-card-2 text-ink"
                : "border-line bg-veil text-ink-2 hover:text-ink"
            }`}
          >
            {key !== "all" ? (
              <Image
                src={SPORT_ICON[key]}
                alt=""
                width={14}
                height={14}
                className="opacity-85"
              />
            ) : null}
            <span>
              {key === "all"
                ? t("upcomingEvents.filterAll")
                : t(SPORT_LABEL_KEY[key])}
            </span>
            <span className="text-[11px] tabular-nums text-ink-3">
              {counts[key] ?? 0}
            </span>
          </button>
        ))}

        {/* Low Profile Gizle: yıldızsız maçları listeden çıkarır. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={hideLowProfile}
          onClick={() => setHideLowProfile((v) => !v)}
          title={t("upcomingEvents.hideLowProfileHint")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
            hideLowProfile
              ? "border-amber-500/50 bg-amber-500/15 text-amber-500"
              : "border-line bg-veil text-ink-2 hover:text-ink"
          }`}
        >
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
              hideLowProfile
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-line-strong bg-transparent"
            }`}
            aria-hidden="true"
          >
            {hideLowProfile ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-2.5 w-2.5"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
          </span>
          <span>{t("upcomingEvents.hideLowProfile")}</span>
        </button>
      </div>

      {dayGroups.length === 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
          {t("upcomingEvents.noEvents")}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="min-w-[560px] table-auto border-collapse text-[13px]">
            <colgroup>
              <col className="w-[66px]" />
              <col className="w-[46px]" />
              <col className="w-[74px]" />
              <col />
              <col />
              <col className="w-[48px]" />
              <col className="w-[48px]" />
              <col className="w-[48px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-ink-3">
                <th className="px-1 py-1" />
                <th className="px-2 py-1 font-semibold">
                  {t("upcomingEvents.thTime")}
                </th>
                <th className="whitespace-nowrap px-1.5 py-1 font-semibold">
                  {t("upcomingEvents.thStartsIn")}
                </th>
                <th className="px-2 py-1 font-semibold">
                  {t("upcomingEvents.thMatch")}
                </th>
                <th className="px-2 py-1 font-semibold">
                  {t("upcomingEvents.thTournament")}
                </th>
                <th className="px-1 py-1 text-center">{brandBadge("bet365")}</th>
                <th className="px-1 py-1 text-center">{brandBadge("bets10")}</th>
                <th className="px-1 py-1 text-center">
                  {brandBadge("oddsportal")}
                </th>
              </tr>
            </thead>
            <tbody>
              {dayGroups.map(([key, rows]) => (
                <Fragment key={key}>
                  <tr>
                    <td
                      colSpan={8}
                      className="border-y border-line bg-veil px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3"
                    >
                      {dayLabel(key, rows[0])}
                    </td>
                  </tr>
                  {rows.map((e) => {
                    const cd = countdown(e);
                    const alert = needsAlert(e);
                    const stars = eventStarCount(e);
                    return (
                      <tr
                        key={e.event_id}
                        className={`text-ink ${
                          alert
                            ? "bg-red-500/[0.06] [&>td]:border-y [&>td]:border-red-500/70 [&>td:first-child]:border-l [&>td:last-child]:border-r"
                            : "border-t border-line first:border-t-0"
                        }`}
                      >
                        <td className="px-1 py-1">
                          <span className="flex flex-col items-center gap-0.5">
                            <Stars count={stars} />
                            {alert ? <AlertIcon /> : null}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-[12px] tabular-nums text-ink-2">
                          {timeFmt.format(new Date(e.start_ts))}
                        </td>
                        <td
                          className="whitespace-nowrap px-1.5 py-1"
                          suppressHydrationWarning
                        >
                          {cd.text ? (
                            <span
                              className={`rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${badgeClass(cd.tone)}`}
                            >
                              {cd.text}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">
                          <span className="flex items-center gap-1.5">
                            <Image
                              src={SPORT_ICON[e.sport] ?? SPORT_ICON.football}
                              alt={e.sport}
                              width={13}
                              height={13}
                              className="shrink-0 opacity-80"
                            />
                            <span>
                              <TeamName
                                href={e.home_team_href}
                                name={e.home_team_name}
                              />
                              <span className="px-1 text-ink-3">-</span>
                              <TeamName
                                href={e.away_team_href}
                                name={e.away_team_name}
                              />
                            </span>
                            {e.gender === "F" ? (
                              <span className="shrink-0 rounded bg-fuchsia-500/15 px-1 py-0.5 text-[9px] font-semibold text-fuchsia-400">
                                {t("upcomingEvents.women")}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-[11px] text-ink-3">
                          <span className="block">
                            {e.tournament_name}
                            {e.round_info ? (
                              <span className="ml-1 text-ink-3/80">
                                {e.round_info}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-1 py-1 text-center">
                          <SiteMark
                            site="bet365"
                            value={e.bet365_has_odds}
                            marketCount={e.bet365_market_count}
                            listed={e.bet365_listed}
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <SiteMark
                            site="bets10"
                            value={e.bets10_has_odds}
                            marketCount={e.bets10_market_count}
                            listed={e.bets10_listed}
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <SiteMark
                            site="oddsportal"
                            value={e.oddsportal_has_odds}
                            marketCount={e.oddsportal_market_count}
                            listed={e.oddsportal_listed}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
