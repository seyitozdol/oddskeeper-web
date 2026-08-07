"use client";

import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { TeamNote } from "@/lib/team-notes";

// Match Stats Model: takım logosunun sağ üstünde not sayısı rozeti. Üzerine
// gelince (hover/focus) o takımın notları küçük bir kutuda listelenir.
// Salt-okunur (MSM'de not eklenmez); notlar parent'ta tek istekle çekilip
// prop olarak geçilir. Not yoksa hiçbir şey render edilmez.
export default function TeamNoteBadge({ notes }: { notes: TeamNote[] }) {
  const { t, locale } = useI18n();
  if (!notes || notes.length === 0) return null;

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(
        locale === "tr" ? "tr-TR" : "en-US",
        { day: "2-digit", month: "short" }
      );
    } catch {
      return "";
    }
  };

  return (
    <span className="group absolute -right-1.5 -top-1.5 z-10">
      <span
        tabIndex={0}
        role="button"
        aria-label={t("notes.countLabel", { count: notes.length })}
        className="flex h-4 min-w-4 cursor-default items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent shadow"
      >
        {notes.length}
      </span>

      <span className="pointer-events-none absolute right-0 top-5 hidden w-64 flex-col gap-2 rounded-xl border border-line bg-card p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.35)] group-hover:flex group-focus-within:flex">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent-ink">
          {t("notes.countLabel", { count: notes.length })}
        </span>
        {notes.slice(0, 6).map((note) => (
          <span key={note.id} className="flex flex-col gap-0.5">
            <span className="whitespace-pre-wrap break-words text-[12px] leading-snug text-ink">
              {note.body}
            </span>
            <span className="text-[10px] text-ink-3">
              {note.authorName} · {fmtDate(note.createdAt)}
            </span>
          </span>
        ))}
        {notes.length > 6 ? (
          <span className="text-[10px] text-ink-3">+{notes.length - 6}</span>
        ) : null}
      </span>
    </span>
  );
}
