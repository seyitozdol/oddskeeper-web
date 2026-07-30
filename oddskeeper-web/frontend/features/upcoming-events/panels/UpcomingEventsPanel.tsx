"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  TRACKED_SPORTS,
  type TrackedSport,
  type UpcomingEventRow,
} from "../types";

const TZ = "Europe/Istanbul";

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
  // Hydration uyusmazligini onlemek icin geri sayim yalnizca mount sonrasi
  // hesaplanir; her 30 sn'de bir tazelenir.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length };
    for (const sport of TRACKED_SPORTS) {
      c[sport] = events.filter((e) => e.sport === sport).length;
    }
    return c;
  }, [events]);

  const filtered = useMemo(
    () =>
      sportFilter === "all"
        ? events
        : events.filter((e) => e.sport === sportFilter),
    [events, sportFilter]
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
      </div>

      {dayGroups.length === 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-veil p-4 text-sm text-ink-2">
          {t("upcomingEvents.noEvents")}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {dayGroups.map(([key, rows]) => (
            <div key={key} className="rounded-lg border border-line">
              <p className="border-b border-line bg-veil px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                {dayLabel(key, rows[0])}
              </p>
              <table className="min-w-full border-collapse text-[13px]">
                <tbody>
                  {rows.map((e) => {
                    const cd = countdown(e);
                    return (
                      <tr
                        key={e.event_id}
                        className="border-t border-line text-ink first:border-t-0"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] tabular-nums text-ink-2">
                          {timeFmt.format(new Date(e.start_ts))}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2"
                          suppressHydrationWarning
                        >
                          {cd.text ? (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${badgeClass(cd.tone)}`}
                            >
                              {cd.text}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <Image
                            src={SPORT_ICON[e.sport] ?? SPORT_ICON.football}
                            alt={e.sport}
                            width={15}
                            height={15}
                            className="opacity-85"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">
                              {e.home_team_name}
                            </span>
                            <span className="text-ink-3">-</span>
                            <span className="font-medium">
                              {e.away_team_name}
                            </span>
                            {e.gender === "F" ? (
                              <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-400">
                                {t("upcomingEvents.women")}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 text-[12px] text-ink-3 md:table-cell">
                          {e.tournament_name}
                          {e.round_info ? (
                            <span className="ml-1.5 text-ink-3/80">
                              {e.round_info}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
