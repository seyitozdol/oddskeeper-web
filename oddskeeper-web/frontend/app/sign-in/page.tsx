"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
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
            href="/"
            className="text-sm text-white/60 transition hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-[560px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8bdfff]">
              Sign In
            </p>

            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Access your workspace
            </h1>

            <p className="mt-5 text-base leading-8 text-white/62 sm:text-lg">
              Sign in to continue into the platform interface and access your
              structured workflow environment.
            </p>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-x-10 top-10 h-[78%] rounded-[44px] bg-[#0aa8ff]/8 blur-3xl" />

            <div className="relative z-10 mx-auto w-full max-w-[560px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-[0_28px_110px_rgba(0,0,0,0.42)] backdrop-blur">
              <div className="rounded-[28px] border border-white/8 bg-[#0a1320]/95 p-5 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                      required
                    />
                  </div>

                  {errorText ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                      {errorText}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full cursor-pointer rounded-2xl border border-[#13b0ff]/35 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
                    No account yet?{" "}
                    <Link
                      href="/sign-up"
                      className="font-medium text-[#8bdfff] transition hover:text-white"
                    >
                      Sign Up
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