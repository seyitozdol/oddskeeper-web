"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

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
      setErrorText("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
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

    setSuccessText("Password updated successfully. Redirecting to sign in...");
    setLoading(false);

    setTimeout(() => {
      router.replace("/sign-in");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[#06111f] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#13b0ff]/40 bg-white/5 shadow-[0_0_30px_rgba(19,176,255,0.12)]">
              <span className="bg-gradient-to-r from-[#13b0ff] to-[#7de8ff] bg-clip-text text-sm font-semibold text-transparent">
                OK
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-white">
                OddsKeeper
              </span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                Sports Data Intelligence
              </span>
            </div>
          </Link>

          <Link
            href="/sign-in"
            className="text-sm text-white/60 transition hover:text-white"
          >
            Back to Sign In
          </Link>
        </div>

        <div className="mx-auto max-w-[560px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-[0_28px_110px_rgba(0,0,0,0.42)] backdrop-blur">
          <div className="rounded-[28px] border border-white/8 bg-[#0a1320]/95 p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8bdfff]">
              New Password
            </p>

            <h1 className="mt-4 text-3xl font-semibold text-white">
              Set a new password
            </h1>

            <p className="mt-4 text-sm leading-7 text-white/62">
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  New password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                  required
                />
              </div>

              {errorText ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {errorText}
                </div>
              ) : null}

              {successText ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  {successText}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-2xl border border-[#13b0ff]/35 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}