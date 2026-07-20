"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    if (password.length < 8) {
      setErrorText(t("auth.passwordTooShortError"));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorText(t("auth.passwordMismatchError"));
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    setSuccessText(t("auth.passwordUpdatedSuccess"));
    setLoading(false);

    setTimeout(() => {
      router.replace("/sign-in");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-veil">
              <span className="text-sm font-semibold text-accent-ink">
                OK
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-ink">
                OddsKeeper
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-ink-3">
                {t("landing.brandTagline")}
              </span>
            </div>
          </Link>

          <Link
            href="/sign-in"
            className="text-sm text-ink-2 transition hover:text-ink"
          >
            {t("auth.backToSignIn")}
          </Link>
        </div>

        <div className="mx-auto max-w-[560px] rounded-2xl border border-line bg-card-2 p-4 backdrop-blur">
          <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-ink">
              {t("auth.newPasswordKicker")}
            </p>

            <h1 className="mt-4 text-2xl font-semibold text-ink">
              {t("auth.setNewPasswordTitle")}
            </h1>

            <p className="mt-4 text-sm leading-7 text-ink-2">
              {t("auth.setNewPasswordDescription")}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">
                  {t("auth.newPasswordLabel")}
                </label>
                <input
                  type="password"
                  placeholder={t("auth.newPasswordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-line bg-field px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink">
                  {t("auth.confirmPasswordLabel")}
                </label>
                <input
                  type="password"
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-line bg-field px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
                  required
                />
              </div>

              {errorText ? (
                <div className="rounded-2xl border border-neg/30 bg-neg/10 px-4 py-3 text-sm text-neg">
                  {errorText}
                </div>
              ) : null}

              {successText ? (
                <div className="rounded-2xl border border-pos/30 bg-pos/10 px-4 py-3 text-sm text-pos">
                  {successText}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-2xl bg-accent px-6 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t("auth.updatingPassword") : t("auth.updatePasswordButton")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
