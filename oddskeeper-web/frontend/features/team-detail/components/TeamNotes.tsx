"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import TeamNotesModal from "@/components/TeamNotesModal";
import type { TeamNote } from "@/lib/team-notes";

type TeamNotesProps = {
  teamSlug: string;
  teamName: string;
  logoPath: string;
  initialNotes: TeamNote[];
  // Sağ kümedeki sekmeler + geri linki (server tarafında üretilip geçilir).
  children: ReactNode;
};

// Takım profil başlığı: tıklanabilir logo (not sayısı rozetli) + "not ekle"
// butonu, ikisi de aynı not modalını açar. Modal içinde not ekleme ve mevcut
// notların listesi (sahibi/admin için düzenle-sil) bulunur.
export function TeamNotes({
  teamSlug,
  teamName,
  logoPath,
  initialNotes,
  children,
}: TeamNotesProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>(initialNotes);

  const count = notes.length;

  return (
    <>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("notes.title")}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-card-2 p-2 transition hover:border-line-strong"
            >
              <Image
                src={logoPath}
                alt={teamName}
                width={36}
                height={36}
                className="h-auto max-h-9 w-auto max-w-9 object-contain"
              />
              {count > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-on-accent">
                  {count}
                </span>
              ) : null}
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-none text-ink lg:text-2xl">
                {teamName}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-veil px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:border-line-strong hover:bg-card-2 hover:text-ink"
          >
            <span className="text-base leading-none">+</span>
            <span>{t("notes.add")}</span>
            {count > 0 ? (
              <span className="rounded-md border border-line bg-card-2 px-1.5 py-0.5 text-[11px] leading-none text-ink-2">
                {count}
              </span>
            ) : null}
          </button>

          {children}
        </div>
      </div>

      {open ? (
        <TeamNotesModal
          teamSlug={teamSlug}
          teamName={teamName}
          notes={notes}
          onNotesChange={setNotes}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
