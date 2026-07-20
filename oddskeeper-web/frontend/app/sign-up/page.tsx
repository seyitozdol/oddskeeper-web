"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccessText(t("auth.signUpSuccess"));
    setLoading(false);
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
            href="/"
            className="text-sm text-ink-2 transition hover:text-ink"
          >
            {t("auth.backToHome")}
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-[560px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent-ink">
              {t("auth.signUpKicker")}
            </p>

            <h1 className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-4xl lg:text-5xl">
              {t("auth.signUpTitle")}
            </h1>

            <p className="mt-5 text-base leading-8 text-ink-2 sm:text-lg">
              {t("auth.signUpDescription")}
            </p>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-x-10 top-10 h-[78%] rounded-full bg-accent/10 blur-3xl" />

            <div className="relative z-10 mx-auto w-full max-w-[560px] rounded-2xl border border-line bg-card-2 p-4 backdrop-blur">
              <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">
                      {t("auth.fullNameLabel")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("auth.fullNamePlaceholder")}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-field px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">
                      {t("auth.emailLabel")}
                    </label>
                    <input
                      type="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-field px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-line-strong"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink">
                      {t("auth.passwordLabel")}
                    </label>
                    <input
                      type="password"
                      placeholder={t("auth.createPasswordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                    {loading ? t("auth.signingUp") : t("auth.signUpButton")}
                  </button>

                  <div className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink-2">
                    {t("auth.alreadyHaveAccount")}{" "}
                    <Link
                      href="/sign-in"
                      className="font-medium text-accent-ink transition hover:text-ink"
                    >
                      {t("landing.signIn")}
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
