import UpcomingEventsPanel from "@/features/upcoming-events/panels/UpcomingEventsPanel";
import { getUpcomingEvents } from "@/features/upcoming-events/server/getUpcomingEvents";
import { getLocale, getT } from "@/lib/i18n/server";

// Veri periyodik pipeline ile guncellendigi icin sayfa her istekte taze okur.
export const dynamic = "force-dynamic";

export default async function UpcomingEventsPage() {
  const [events, t, locale] = await Promise.all([
    getUpcomingEvents(),
    getT(),
    getLocale(),
  ]);

  const lastUpdated = events.reduce(
    (max, e) => (e.updated_at > max ? e.updated_at : max),
    ""
  );

  return (
    <section className="w-full">
      <div className="rounded-2xl border border-line bg-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold text-ink lg:text-3xl">
            {t("upcomingEvents.title")}
          </h1>
          {lastUpdated ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-veil px-2.5 py-1 text-[12px] text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-ink-3">
                {t("upcomingEvents.lastUpdated")}:
              </span>
              <span className="font-medium tabular-nums text-ink-2">
                {new Intl.DateTimeFormat(
                  locale === "tr" ? "tr-TR" : "en-GB",
                  {
                    timeZone: "Europe/Malta",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                ).format(new Date(lastUpdated))}
              </span>
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-ink-3">
          {t("upcomingEvents.timeZoneNote")}
        </p>

        <div className="mt-6">
          <UpcomingEventsPanel events={events} />
        </div>
      </div>
    </section>
  );
}
