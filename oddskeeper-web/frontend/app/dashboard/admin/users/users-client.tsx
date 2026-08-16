"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (!email && !alias) {
      setCreateError(t("adminUsers.emailOrAliasRequired"));
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      setCreateError(t("adminUsers.invalidEmail"));
      return;
    }
    if (newPassword && newPassword.length < 8) {
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
          email: email || undefined,
          password: newPassword || undefined,
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
      email?: string;
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
              ...(patch.email !== undefined ? { email: patch.email } : {}),
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

  // Sifre yaziliktir, satirda gosterilmez; optimistik guncelleme yok, sadece
  // POST edip basari/hata dondururuz.
  async function setPassword(
    user: AdminUserRow,
    password: string
  ): Promise<boolean> {
    setSaveError(false);
    setSavingIds((prev) => new Set(prev).add(user.id));

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (error) {
      console.error("Admin set password error:", error);
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

  async function deleteUser(user: AdminUserRow) {
    if (!window.confirm(t("adminUsers.deleteConfirm", { email: user.email }))) {
      return;
    }

    setSaveError(false);
    setSavingIds((prev) => new Set(prev).add(user.id));

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (error) {
      console.error("Admin user delete error:", error);
      setSaveError(true);
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
        <div className="overflow-visible rounded-xl border border-line bg-card">
          <table className="w-full border-collapse text-left">
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
                <th className="px-3 py-2.5 font-medium">
                  {t("adminUsers.passwordColumn")}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {t("adminUsers.actionsColumn")}
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
                        <InlineTextCell
                          value={user.email}
                          placeholder={t("adminUsers.createEmailLabel")}
                          width="w-52"
                          allowEmpty={false}
                          validate={(v) => EMAIL_RE.test(v)}
                          normalize={(v) => v.trim().toLowerCase()}
                          isSaving={isSaving}
                          saveLabel={t("adminUsers.aliasSave")}
                          removeLabel={t("adminUsers.aliasSave")}
                          onSave={(v) => patchUser(user, { email: v ?? "" })}
                        />
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
                      <InlineTextCell
                        value={user.directAlias ?? ""}
                        placeholder={t("adminUsers.aliasPlaceholder")}
                        width="w-32"
                        allowEmpty
                        validate={(v) => ALIAS_RE.test(v)}
                        normalize={(v) => v.trim().toLowerCase()}
                        isSaving={isSaving}
                        saveLabel={t("adminUsers.aliasSave")}
                        removeLabel={t("adminUsers.aliasRemove")}
                        onSave={(v) => patchUser(user, { directAlias: v })}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <AccessDropdown
                        user={user}
                        isSaving={isSaving}
                        fullAccess={hasFullAccess(user)}
                        onToggle={(key) => toggleNavKey(user, key)}
                        t={t}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <PasswordCell
                        isSaving={isSaving}
                        onSave={(pw) => setPassword(user, pw)}
                        t={t}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => void deleteUser(user)}
                        disabled={isSelf || isSaving}
                        title={
                          isSelf ? t("adminUsers.selfDeleteHint") : undefined
                        }
                        className={`rounded-md border border-line px-2 py-1 text-[11px] font-medium transition ${
                          isSelf || isSaving
                            ? "cursor-not-allowed text-ink-3 opacity-60"
                            : "cursor-pointer text-neg hover:border-neg/50"
                        }`}
                      >
                        {t("adminUsers.deleteButton")}
                      </button>
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

type PasswordCellProps = {
  isSaving: boolean;
  onSave: (password: string) => Promise<boolean>;
  t: Translator;
};

function PasswordCell({ isSaving, onSave, t }: PasswordCellProps) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (value.length < 8) {
      setInvalid(true);
      setSaved(false);
      return;
    }
    setInvalid(false);
    const ok = await onSave(value);
    if (ok) {
      setValue("");
      setSaved(true);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
          setInvalid(false);
        }}
        placeholder={t("adminUsers.passwordPlaceholder")}
        disabled={isSaving}
        autoComplete="new-password"
        title={invalid ? t("adminUsers.createPasswordTooShort") : undefined}
        className={`w-32 rounded-lg border px-2 py-1 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong ${
          invalid ? "border-neg" : "border-line"
        } bg-field`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("adminUsers.passwordSet")}
        </button>
      ) : saved ? (
        <span className="text-[11px] font-medium text-accent-ink">
          {t("adminUsers.passwordSaved")}
        </span>
      ) : null}
    </div>
  );
}

type InlineTextCellProps = {
  value: string;
  placeholder: string;
  width: string;
  // true ise bos deger "kaldir" olarak kaydedilebilir (alias); false ise
  // bos deger kaydedilmez (e-posta).
  allowEmpty: boolean;
  validate: (value: string) => boolean;
  normalize: (value: string) => string;
  isSaving: boolean;
  saveLabel: string;
  removeLabel: string;
  onSave: (value: string | null) => Promise<boolean>;
};

function InlineTextCell({
  value,
  placeholder,
  width,
  allowEmpty,
  validate,
  normalize,
  isSaving,
  saveLabel,
  removeLabel,
  onSave,
}: InlineTextCellProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const normalized = normalize(draft);
  const dirty = normalized !== value;
  const canSave = dirty && (normalized ? true : allowEmpty);

  async function save() {
    if (!canSave) return;
    if (normalized && !validate(normalized)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave(normalized || null);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={isSaving}
        autoComplete="off"
        className={`${width} rounded-lg border px-2 py-1 text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong ${
          invalid ? "border-neg" : "border-line"
        } bg-field`}
      />
      {canSave ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {normalized ? saveLabel : removeLabel}
        </button>
      ) : null}
    </div>
  );
}

type AccessDropdownProps = {
  user: AdminUserRow;
  isSaving: boolean;
  fullAccess: boolean;
  onToggle: (key: NavKey) => void;
  t: Translator;
};

function AccessDropdown({
  user,
  isSaving,
  fullAccess,
  onToggle,
  t,
}: AccessDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const checkedCount = NAV_PERMISSION_ITEMS.filter((item) =>
    isNavKeyAllowed(item.key, user.allowedKeys)
  ).length;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition hover:border-line-strong hover:text-ink ${
          fullAccess
            ? "border-line text-ink-2"
            : "border-line-strong font-medium text-neg"
        }`}
      >
        {fullAccess
          ? t("adminUsers.fullAccess")
          : t("adminUsers.accessSummary", {
              checked: checkedCount,
              total: NAV_PERMISSION_ITEMS.length,
            })}
        <span
          className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          &#9662;
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-line bg-card p-1.5 shadow-lg">
          {NAV_PERMISSION_ITEMS.map((item) => {
            const checked = isNavKeyAllowed(item.key, user.allowedKeys);

            return (
              <label
                key={item.key}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition ${
                  isSaving
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-veil"
                } ${checked ? "text-ink" : "text-ink-3"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isSaving}
                  onChange={() => onToggle(item.key)}
                  className="h-3.5 w-3.5 accent-current"
                />
                {t(item.labelKey)}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
