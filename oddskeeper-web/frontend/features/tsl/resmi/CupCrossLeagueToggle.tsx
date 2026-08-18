import Link from "next/link";
import type { CupCrossLink } from "@/features/tsl/server/cupPlayerProfile";
import type { Translator } from "@/lib/i18n/messages";

// Avrupa kupasi profillerinde capraz-lig toggle: ayni oyuncunun/takimin diger
// liglerdeki profiline gecis. Sag-uste yaslanir (buyuk gorselin ustunde). Kupa
// logolari koyu -> koyu modda tsl-league-mark ile beyaza cevrilir (invert).
// Etiketler i18n (nameKey) -> EN/TR site diline uyar.
export function CupCrossLeagueToggle({
  links,
  t,
}: {
  links: CupCrossLink[];
  t: Translator;
}) {
  if (links.length <= 1) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {links.map((x) => {
        const logoCls = `h-4 w-4 shrink-0 object-contain${x.invert ? " tsl-league-mark" : ""}`;
        const label = t(x.nameKey);
        return x.current ? (
          <span
            key={x.key}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.logo} alt="" width={16} height={16} className={logoCls} referrerPolicy="no-referrer" />
            {label}
          </span>
        ) : (
          <Link
            key={x.key}
            href={x.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition hover:text-ink"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.logo} alt="" width={16} height={16} className={logoCls} referrerPolicy="no-referrer" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
