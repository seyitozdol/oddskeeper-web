import Link from "next/link";

export default function SignUpPage() {
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
              Sign Up
            </p>

            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Create your workspace
            </h1>

            <p className="mt-5 text-base leading-8 text-white/62 sm:text-lg">
              Set up your account to access platform workflows, structured data
              layers, and future analytical tools.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-x-10 top-10 h-[78%] rounded-[44px] bg-[#0aa8ff]/8 blur-3xl" />

            <div className="relative mx-auto w-full max-w-[560px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-[0_28px_110px_rgba(0,0,0,0.42)] backdrop-blur">
              <div className="rounded-[28px] border border-white/8 bg-[#0a1320]/95 p-5 sm:p-6">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your full name"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Create a password"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#13b0ff]/40"
                    />
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-2xl border border-[#13b0ff]/35 bg-gradient-to-r from-[#0d8fff] to-[#25c8ff] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(19,176,255,0.18)] transition hover:scale-[1.01]"
                  >
                    Sign Up
                  </button>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
                    Already have an account?{" "}
                    <Link
                      href="/sign-in"
                      className="font-medium text-[#8bdfff] transition hover:text-white"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}