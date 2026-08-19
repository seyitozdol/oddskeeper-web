"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { TeamNote } from "@/lib/team-notes";

// Takım notları modalı: not ekleme + mevcut notların listesi (sahibi/admin
// için düzenle-sil). Hem futbol takım profili hem 1. Lig takım sayfası kullanır.
export default function TeamNotesModal({
  teamSlug,
  teamName,
  notes,
  onNotesChange,
  onClose,
}: {
  teamSlug: string;
  teamName: string;
  notes: TeamNote[];
  onNotesChange: (next: TeamNote[]) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Esc ile kapat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmtDate = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleDateString(
          locale === "tr" ? "tr-TR" : "en-US",
          { day: "2-digit", month: "short", year: "numeric" }
        );
      } catch {
        return "";
      }
    },
    [locale]
  );

  async function handleAdd() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/team-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: teamSlug, body }),
      });
      if (!res.ok) throw new Error("save_failed");
      const { note } = (await res.json()) as { note: TeamNote };
      onNotesChange([note, ...notes]);
      setDraft("");
    } catch {
      setError(t("notes.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const body = editDraft.trim();
    if (!body || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/team-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("save_failed");
      const { note } = (await res.json()) as { note: TeamNote };
      onNotesChange(notes.map((n) => (n.id === id ? note : n)));
      setEditingId(null);
      setEditDraft("");
    } catch {
      setError(t("notes.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (saving) return;
    if (!window.confirm(t("notes.confirmDelete"))) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/team-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      onNotesChange(notes.filter((n) => n.id !== id));
    } catch {
      setError(t("notes.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("notes.close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <div className="absolute left-1/2 top-1/2 flex max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent-ink">
              {t("notes.title")}
            </p>
            <h2 className="truncate text-lg font-semibold text-ink">
              {teamName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line bg-veil px-2.5 py-1 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b border-line px-5 py-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("notes.placeholder")}
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
          />
          <div className="flex items-center justify-end gap-2">
            {error ? (
              <span className="mr-auto text-[12px] text-neg">{error}</span>
            ) : null}
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || draft.trim().length === 0}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t("notes.saving") : t("notes.save")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {notes.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-3">
              {t("notes.empty")}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg border border-line bg-card-2 px-3 py-2.5"
                >
                  {editingId === note.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-line bg-veil px-3 py-1 text-[13px] text-ink-2 transition hover:text-ink"
                        >
                          {t("notes.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={saving || editDraft.trim().length === 0}
                          className="rounded-lg bg-accent px-3 py-1 text-[13px] font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
                        >
                          {t("notes.save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words text-sm text-ink">
                        {note.body}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-3">
                        <span className="truncate">
                          {t("notes.by", { name: note.authorName })} ·{" "}
                          {fmtDate(note.createdAt)}
                        </span>
                        {note.canEdit ? (
                          <span className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(note.id);
                                setEditDraft(note.body);
                                setError("");
                              }}
                              className="text-ink-2 transition hover:text-ink"
                            >
                              {t("notes.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(note.id)}
                              className="text-ink-2 transition hover:text-neg"
                            >
                              {t("notes.delete")}
                            </button>
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
