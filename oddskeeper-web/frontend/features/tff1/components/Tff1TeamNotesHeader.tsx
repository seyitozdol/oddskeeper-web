"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import TeamNotesModal from "@/components/TeamNotesModal";
import type { TeamNote } from "@/lib/team-notes";

// 1. Lig takım sayfası başlığı: logo (tıklanınca not modalı) + ad + alt satır
// + "not ekle" butonu. teamSlug null ise (takım MSM slug haritasında yok)
// notlar gösterilmez, sade logo+ad render edilir.
export default function Tff1TeamNotesHeader({
  teamSlug,
  teamName,
  logoUrl,
  initialNotes,
  subtitle,
}: {
  teamSlug: string | null;
  teamName: string;
  logoUrl: string | null;
  initialNotes: TeamNote[];
  subtitle: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>(initialNotes);
  const notesEnabled = Boolean(teamSlug);
  const count = notes.length;

  const logoInner = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={teamName} className="h-16 w-16 object-contain" />
  ) : (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-veil text-2xl font-semibold text-ink-3">
      {teamName.slice(0, 1)}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      {notesEnabled ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("notes.title")}
          className="relative shrink-0 rounded-2xl transition hover:opacity-90"
        >
          {logoInner}
          {count > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-on-accent">
              {count}
            </span>
          ) : null}
        </button>
      ) : (
        logoInner
      )}

      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink lg:text-3xl">
          {teamName}
        </h1>
        {subtitle}
      </div>

      {notesEnabled ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 self-start rounded-lg border border-line bg-veil px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:border-line-strong hover:bg-card-2 hover:text-ink"
        >
          <span className="text-base leading-none">+</span>
          <span>{t("notes.add")}</span>
          {count > 0 ? (
            <span className="rounded-md border border-line bg-card-2 px-1.5 py-0.5 text-[11px] leading-none text-ink-2">
              {count}
            </span>
          ) : null}
        </button>
      ) : null}

      {open && teamSlug ? (
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
