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
        <h1 className="text-2xl font-semibold text-ink lg:text-3xl">
          {t("upcomingEvents.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {t("upcomingEvents.subtitle")}
        </p>
        <p className="mt-1 text-[12px] text-ink-3">
          {t("upcomingEvents.timeZoneNote")}
          {lastUpdated
            ? ` ${t("upcomingEvents.lastUpdated")}: ${new Intl.DateTimeFormat(
                locale === "tr" ? "tr-TR" : "en-GB",
                {
                  timeZone: "Europe/Istanbul",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              ).format(new Date(lastUpdated))}`
            : null}
        </p>

        <div className="mt-6">
          <UpcomingEventsPanel events={events} />
        </div>
      </div>
    </section>
  );
}
