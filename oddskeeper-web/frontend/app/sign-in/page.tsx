"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function SignInPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!res.ok) {
        setErrorText(t("auth.invalidCredentials"));
        setLoading(false);
        return;
      }
    } catch {
      setErrorText(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090c] px-4 py-8 text-zinc-100">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900"
          >
            <span className="text-sm font-semibold text-zinc-100">OK</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">
                {t("auth.emailLabel")}
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">
                {t("auth.passwordLabel")}
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
              />
            </div>

            {errorText ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {errorText}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-2xl bg-zinc-100 px-6 py-2.5 text-sm font-semibold text-zinc-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("auth.signingIn") : t("auth.signInButton")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
