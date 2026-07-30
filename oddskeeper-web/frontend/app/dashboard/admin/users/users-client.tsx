"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { Translator } from "@/lib/i18n/messages";
import {
  NAV_KEYS,
  NAV_PERMISSION_ITEMS,
  isNavKeyAllowed,
  type NavKey,
} from "@/lib/nav-permissions";

type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
  allowedKeys: string[] | null;
  directAlias: string | null;
};

type AdminUsersClientProps = {
  requesterId: string | null;
};

const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export default function AdminUsersClient({
  requesterId,
}: AdminUsersClientProps) {
  const { t, locale } = useI18n();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);

    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { users: AdminUserRow[] };
      setUsers(data.users);
    } catch (error) {
      console.error("Admin users load error:", error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");

    const email = newEmail.trim().toLowerCase();
    const alias = newAlias.trim().toLowerCase();

    if (newPassword.length < 8) {
      setCreateError(t("adminUsers.createPasswordTooShort"));
      return;
    }
    if (alias && !ALIAS_RE.test(alias)) {
      setCreateError(t("adminUsers.invalidAlias"));
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: newPassword,
          isAdmin: newIsAdmin,
          directAlias: alias || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { user?: AdminUserRow; error?: string }
        | null;

      if (!res.ok || !data?.user) {
        if (data?.error === "email_exists") {
          setCreateError(t("adminUsers.emailExists"));
        } else if (data?.error === "alias_taken") {
          setCreateError(t("adminUsers.aliasTaken"));
          void loadUsers();
        } else {
          setCreateError(t("adminUsers.createFailed"));
        }
        return;
      }

      setUsers((prev) => [...prev, data.user!]);
      setNewEmail("");
      setNewPassword("");
      setNewIsAdmin(false);
      setNewAlias("");
    } catch (error) {
      console.error("Admin user create error:", error);
      setCreateError(t("adminUsers.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(
    user: AdminUserRow,
    patch: {
      allowedKeys?: string[] | null;
      isAdmin?: boolean;
      directAlias?: string | null;
    }
  ): Promise<boolean> {
    const previous = users;

    setSaveError(false);
    setSavingIds((prev) => new Set(prev).add(user.id));
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              ...(patch.allowedKeys !== undefined
                ? { allowedKeys: patch.allowedKeys }
                : {}),
              ...(patch.isAdmin !== undefined ? { isAdmin: patch.isAdmin } : {}),
              ...(patch.directAlias !== undefined
                ? { directAlias: patch.directAlias }
                : {}),
            }
          : u
      )
    );

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (error) {
      console.error("Admin users save error:", error);
      setUsers(previous);
      setSaveError(true);
      return false;
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }

  function toggleNavKey(user: AdminUserRow, key: NavKey) {
    const current = user.allowedKeys ?? [...NAV_KEYS];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];

    void patchUser(user, { allowedKeys: next });
  }

  function toggleAdmin(user: AdminUserRow) {
    void patchUser(user, { isAdmin: !user.isAdmin });
  }

  function formatDate(value: string | null) {
    if (!value) return t("adminUsers.never");
    return new Date(value).toLocaleDateString(
      locale === "tr" ? "tr-TR" : "en-GB",
      { day: "2-digit", month: "short", year: "numeric" }
    );
  }

  const hasFullAccess = (user: AdminUserRow) =>
    NAV_KEYS.every((key) => isNavKeyAllowed(key, user.allowedKeys));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">
          {t("adminUsers.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-3">
          {t("adminUsers.subtitle")}
        </p>
      </div>

      <form
        onSubmit={createUser}
        className="mb-4 rounded-xl border border-line bg-card px-4 py-3"
      >
        <p className="mb-2 text-[13px] font-medium text-ink">
          {t("adminUsers.createTitle")}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminUsers.createEmailLabel")}
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-56 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminUsers.createPasswordLabel")}
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="off"
              className="w-40 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-3">
              {t("adminUsers.createAliasLabel")}
            </label>
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder={t("adminUsers.aliasPlaceholder")}
              autoComplete="off"
              className="w-44 rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="h-3.5 w-3.5 accent-current"
            />
            {t("adminUsers.adminColumn")}
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg border border-line-strong bg-accent px-3 py-1.5 text-[13px] font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating
              ? t("adminUsers.creating")
              : t("adminUsers.createButton")}
          </button>
        </div>
        {createError ? (
          <p className="mt-2 text-[12px] text-neg">{createError}</p>
        ) : null}
      </form>

      {saveError ? (
        <div className="mb-3 rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-neg">
          {t("adminUsers.saveError")}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[13px] text-ink-3">
          {t("adminUsers.loading")}
        </div>
      ) : loadFailed ? (
        <div className="rounded-xl border border-line bg-card px-4 py-8 text-center">
          <p className="text-[13px] text-neg">{t("adminUsers.loadError")}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="mt-3 rounded-lg border border-line bg-veil px-3 py-1.5 text-[13px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {t("adminUsers.retry")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[1020px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-ink-3">
                <th className="px-4 py-2.5 font-medium">
                  {t("adminUsers.userColumn")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminUsers.createdColumn")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminUsers.lastSignInColumn")}
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  {t("adminUsers.adminColumn")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminUsers.superColumn")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("adminUsers.accessColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = requesterId !== null && user.id === requesterId;
                const isSaving = savingIds.has(user.id);

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-line last:border-b-0 ${
                      isSaving ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">
                          {user.email}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                            hasFullAccess(user)
                              ? "border-line text-ink-3"
                              : "border-line-strong text-neg"
                          }`}
                        >
                          {hasFullAccess(user)
                            ? t("adminUsers.fullAccess")
                            : t("adminUsers.restricted")}
                        </span>
                        {user.directAlias ? (
                          <span className="rounded-md border border-line-strong bg-card-2 px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
                            {t("adminUsers.superBadge")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-ink-2">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-ink-2">
                      {formatDate(user.lastSignInAt)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAdmin(user)}
                        disabled={isSelf || isSaving}
                        title={isSelf ? t("adminUsers.selfAdminHint") : undefined}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
                          user.isAdmin
                            ? "border-line-strong bg-accent"
                            : "border-line bg-veil"
                        } ${
                          isSelf || isSaving
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-canvas shadow transition-transform ${
                            user.isAdmin ? "translate-x-[18px]" : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <AliasCell
                        user={user}
                        isSaving={isSaving}
                        onSave={(alias) =>
                          patchUser(user, { directAlias: alias })
                        }
                        t={t}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {NAV_PERMISSION_ITEMS.map((item) => {
                          const checked = isNavKeyAllowed(
                            item.key,
                            user.allowedKeys
                          );

                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => toggleNavKey(user, item.key)}
                              disabled={isSaving}
                              className={`rounded-md border px-2 py-1 text-[12px] transition ${
                                checked
                                  ? "border-line-strong bg-card-2 font-medium text-ink"
                                  : "border-line bg-veil text-ink-3 line-through"
                              } ${
                                isSaving
                                  ? "cursor-not-allowed"
                                  : "hover:border-line-strong hover:text-ink"
                              }`}
                            >
                              {t(item.labelKey)}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
            {t("adminUsers.userCount", { count: users.length })}
          </div>
        </div>
      )}
    </div>
  );
}

type AliasCellProps = {
  user: AdminUserRow;
  isSaving: boolean;
  onSave: (alias: string | null) => Promise<boolean>;
  t: Translator;
};

function AliasCell({ user, isSaving, onSave, t }: AliasCellProps) {
  const [value, setValue] = useState(user.directAlias ?? "");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setValue(user.directAlias ?? "");
    setInvalid(false);
  }, [user.directAlias]);

  const trimmed = value.trim().toLowerCase();
  const dirty = trimmed !== (user.directAlias ?? "");

  async function save() {
    if (!dirty) return;
    if (trimmed && !ALIAS_RE.test(trimmed)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave(trimmed || null);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("adminUsers.aliasPlaceholder")}
        disabled={isSaving}
        autoComplete="off"
        className={`w-32 rounded-lg border px-2 py-1 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong ${
          invalid ? "border-neg" : "border-line"
        } bg-field`}
      />
      {dirty ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {trimmed
            ? t("adminUsers.aliasSave")
            : t("adminUsers.aliasRemove")}
        </button>
      ) : null}
    </div>
  );
}
