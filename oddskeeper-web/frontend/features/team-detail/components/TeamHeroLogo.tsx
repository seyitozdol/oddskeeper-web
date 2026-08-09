"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import TeamNotesModal from "@/components/TeamNotesModal";
import type { TeamNote } from "@/lib/team-notes";

type TeamHeroLogoProps = {
  // Not slug'ı; null ise not özelliği kapalı, logo düz görsel olur.
  teamSlug: string | null;
  teamName: string;
  logoSrc: string | null;
  initialNotes?: TeamNote[];
};

// Vitrin hero'sundaki BÜYÜK takım logosu. Eski başlıktaki küçük logo gibi
// not modalının tetikleyicisidir (not sayısı rozetli); altında "+ not" pili.
export function TeamHeroLogo({
  teamSlug,
  teamName,
  logoSrc,
  initialNotes = [],
}: TeamHeroLogoProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>(initialNotes);
  const count = notes.length;

  const logoBox = (
    <div className="relative flex h-[176px] w-[176px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-card-2 to-canvas p-5">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={teamName}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-4xl font-semibold text-ink-3">
          {teamName.slice(0, 1)}
        </span>
      )}
      {teamSlug && count > 0 ? (
        <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-semibold leading-none text-on-accent">
          {count}
        </span>
      ) : null}
    </div>
  );

  if (!teamSlug) {
    return logoBox;
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("notes.title")}
        className="transition hover:opacity-90"
      >
        {logoBox}
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-line bg-veil px-2.5 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink"
      >
        <span className="text-sm leading-none">+</span>
        <span>{t("notes.add")}</span>
        {count > 0 ? (
          <span className="rounded bg-card-2 px-1 py-0.5 text-[10px] leading-none text-ink-2">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <TeamNotesModal
          teamSlug={teamSlug}
          teamName={teamName}
          notes={notes}
          onNotesChange={setNotes}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
