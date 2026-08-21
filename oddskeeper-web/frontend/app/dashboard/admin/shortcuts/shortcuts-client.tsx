"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
// (useEffect yalnizca ilk liste yuklemesinde kullanilir; satir taslaklari
// composite key ile senkron tutulur, asagiya bak.)
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";

// Admin ShortCuts sekmesi: header'daki Shortcuts menusunde listelenen dis-site
// kisayollarinin yonetimi (ekle / duzenle / sil). Veri /api/shortcuts (liste)
// + /api/admin/shortcuts (yazma) uzerinden akar; tablo service-role-only.

type ShortcutRow = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  sortOrder: number;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminShortcutsClient() {
  const { t } = useI18n();

  const [shortcuts, setShortcuts] = useState<ShortcutRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadShortcuts = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);

    try {
      const res = await fetch("/api/shortcuts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { shortcuts: ShortcutRow[] };
      setShortcuts(data.shortcuts);
    } catch (error) {
      console.error("Admin shortcuts load error:", error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  async function createShortcut(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");

    const name = newName.trim();
    const url = newUrl.trim();
    const logoUrl = newLogoUrl.trim();

    if (!name || name.length > 80) {
      setCreateError(t("adminShortcuts.invalidName"));
      return;
    }
    if (!isValidHttpUrl(url)) {
      setCreateError(t("adminShortcuts.invalidUrl"));
      return;
    }
    if (logoUrl && !isValidHttpUrl(logoUrl)) {
      setCreateError(t("adminShortcuts.invalidLogoUrl"));
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/admin/shortcuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, logoUrl: logoUrl || undefined }),
      });

      const data = (await res.json().catch(() => null)) as
        | { shortcut?: ShortcutRow }
        | null;

      if (!res.ok || !data?.shortcut) {
        setCreateError(t("adminShortcuts.createFailed"));
        return;
      }

      setShortcuts((prev) => [...prev, data.shortcut!]);
      setNewName("");
      setNewUrl("");
      setNewLogoUrl("");
    } catch (error) {
      console.error("Admin shortcut create error:", error);
      setCreateError(t("adminShortcuts.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function saveShortcut(
    id: string,
    patch: { name: string; url: string; logoUrl: string | null }
  ): Promise<boolean> {
    const previous = shortcuts;

    setSaveError(false);
    setSavingIds((prev) => new Set(prev).add(id));
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

    try {
      const res = await fetch(`/api/admin/shortcuts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (error) {
      console.error("Admin shortcut save error:", error);
      setShortcuts(previous);
      setSaveError(true);
      return false;
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteShortcut(shortcut: ShortcutRow) {
    if (
      !window.confirm(
        t("adminShortcuts.deleteConfirm", { name: shortcut.name })
      )
    ) {
      return;
    }

    setSaveError(false);
    setSavingIds((prev) => new Set(prev).add(shortcut.id));

    try {
      const res = await fetch(`/api/admin/shortcuts/${shortcut.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShortcuts((prev) => prev.filter((s) => s.id !== shortcut.id));
    } catch (error) {
      console.error("Admin shortcut delete error:", error);
      setSaveError(true);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(shortcut.id);
        return next;
      });
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">
          {t("adminShortcuts.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-3">
          {t("adminShortcuts.subtitle")}
        </p>
      </div>

      <form
        onSubmit={createShortcut}
        className="mb-4 rounded-xl border border-line bg-card px-4 py-3"
      >
        <p className="mb-2 text-[13px] font-medium text-ink">
          {t("adminShortcuts.createTitle")}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminShortcuts.nameLabel")}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-44 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminShortcuts.urlLabel")}
            </label>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="w-72 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminShortcuts.logoLabel")}
            </label>
            <input
              type="text"
              value={newLogoUrl}
              onChange={(e) => setNewLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-72 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg border border-line-strong bg-accent px-3 py-1.5 text-[13px] font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating
              ? t("adminShortcuts.creating")
              : t("adminShortcuts.createButton")}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">
          {t("adminShortcuts.logoHint")}
        </p>
        {createError ? (
          <p className="mt-2 text-[12px] text-neg">{createError}</p>
        ) : null}
      </form>

      {saveError ? (
        <div className="mb-3 rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-neg">
          {t("adminShortcuts.saveError")}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[13px] text-ink-3">
          {t("adminShortcuts.loading")}
        </div>
      ) : loadFailed ? (
        <div className="rounded-xl border border-line bg-card px-4 py-8 text-center">
          <p className="text-[13px] text-neg">{t("adminShortcuts.loadError")}</p>
          <button
            type="button"
            onClick={() => void loadShortcuts()}
            className="mt-3 rounded-lg border border-line bg-veil px-3 py-1.5 text-[13px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {t("adminShortcuts.retry")}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-card">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2.5 font-medium">
                  {t("adminShortcuts.logoColumn")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminShortcuts.nameLabel")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminShortcuts.urlLabel")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminShortcuts.logoLabel")}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("adminShortcuts.actionsColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((shortcut) => (
                <ShortcutRowEditor
                  // Sunucu degeri degisince (kayit/geri alma) satir remount
                  // olur ve taslaklar guncel degerlerle sifirlanir; boylece
                  // effect icinde setState gerekmez.
                  key={`${shortcut.id}:${shortcut.name}:${shortcut.url}:${shortcut.logoUrl ?? ""}`}
                  shortcut={shortcut}
                  isSaving={savingIds.has(shortcut.id)}
                  onSave={(patch) => saveShortcut(shortcut.id, patch)}
                  onDelete={() => void deleteShortcut(shortcut)}
                  t={t}
                />
              ))}
              {shortcuts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-[13px] text-ink-3"
                  >
                    {t("adminShortcuts.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
            {t("adminShortcuts.count", { count: shortcuts.length })}
          </div>
        </div>
      )}
    </div>
  );
}

type ShortcutRowEditorProps = {
  shortcut: ShortcutRow;
  isSaving: boolean;
  onSave: (patch: {
    name: string;
    url: string;
    logoUrl: string | null;
  }) => Promise<boolean>;
  onDelete: () => void;
  t: Translator;
};

function ShortcutRowEditor({
  shortcut,
  isSaving,
  onSave,
  onDelete,
  t,
}: ShortcutRowEditorProps) {
  const [name, setName] = useState(shortcut.name);
  const [url, setUrl] = useState(shortcut.url);
  const [logoUrl, setLogoUrl] = useState(shortcut.logoUrl ?? "");
  const [invalid, setInvalid] = useState(false);

  const dirty =
    name.trim() !== shortcut.name ||
    url.trim() !== shortcut.url ||
    (logoUrl.trim() || null) !== (shortcut.logoUrl ?? null);

  async function save() {
    const nextName = name.trim();
    const nextUrl = url.trim();
    const nextLogo = logoUrl.trim();

    if (
      !nextName ||
      nextName.length > 80 ||
      !isValidHttpUrl(nextUrl) ||
      (nextLogo && !isValidHttpUrl(nextLogo))
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave({ name: nextName, url: nextUrl, logoUrl: nextLogo || null });
  }

  const inputClass = `rounded-lg border px-2 py-1 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong ${
    invalid ? "border-neg" : "border-line"
  } bg-field`;

  return (
    <tr
      className={`border-b border-line last:border-b-0 ${
        isSaving ? "opacity-60" : ""
      }`}
    >
      <td className="px-4 py-2.5">
        {shortcut.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shortcut.logoUrl}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-sm object-contain"
          />
        ) : (
          <span className="inline-block h-5 w-5 rounded-sm bg-veil" />
        )}
      </td>
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSaving}
          className={`w-40 ${inputClass}`}
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isSaving}
          className={`w-full min-w-56 ${inputClass}`}
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder={t("adminShortcuts.noLogo")}
          disabled={isSaving}
          className={`w-full min-w-56 ${inputClass}`}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {dirty ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="mr-1.5 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("adminShortcuts.save")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          className={`rounded-md border border-line px-2 py-1 text-[11px] font-medium transition ${
            isSaving
              ? "cursor-not-allowed text-ink-3 opacity-60"
              : "cursor-pointer text-neg hover:border-neg/50"
          }`}
        >
          {t("adminShortcuts.delete")}
        </button>
      </td>
    </tr>
  );
}
