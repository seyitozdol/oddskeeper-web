import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;

  if (!claims) {
    redirect("/sign-in");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                Dashboard
              </span>
            </div>
          </Link>

          <SignOutButton />
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#8bdfff]">
            Auth Success
          </p>

          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            You are signed in
          </h1>

          <p className="mt-4 text-base leading-8 text-white/62">
            Current user:{" "}
            <span className="font-medium text-white">{user?.email ?? "-"}</span>
          </p>
        </div>
      </div>
    </main>
  );
}