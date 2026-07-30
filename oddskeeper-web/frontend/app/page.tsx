"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";

// Karartilmis giris sayfasi: disariya acik bir vitrin yok. Sadece logo ve
// giris/kayit butonlari; marka adi ve tanitim icerigi gosterilmez.
export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08090c] px-4 text-zinc-100">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
        <span className="text-lg font-semibold text-zinc-100">OK</span>
      </div>

      <div className="mt-10 flex w-full max-w-[280px] flex-col gap-3">
        <div
          aria-disabled="true"
          className="relative w-full cursor-not-allowed select-none rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-2.5 text-center text-sm font-semibold text-zinc-600"
          title={t("auth.signUpOffline")}
        >
          {t("landing.signUp")}
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-black/40" />
        </div>

        <Link
          href="/sign-in"
          className="w-full rounded-2xl bg-zinc-100 px-6 py-2.5 text-center text-sm font-semibold text-zinc-900 transition hover:opacity-90"
        >
          {t("landing.signIn")}
        </Link>
      </div>
    </main>
  );
}
