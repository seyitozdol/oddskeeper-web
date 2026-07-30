"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";

// Kayit kapali: site disariya acik degil, yeni hesaplar sadece admin
// panelinden manuel olarak acilir.
export default function SignUpPage() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08090c] px-4 text-zinc-100">
      <Link
        href="/"
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900"
      >
        <span className="text-lg font-semibold text-zinc-100">OK</span>
      </Link>

      <p className="mt-8 text-sm text-zinc-400">{t("auth.signUpOffline")}</p>

      <Link
        href="/sign-in"
        className="mt-6 rounded-2xl bg-zinc-100 px-6 py-2.5 text-sm font-semibold text-zinc-900 transition hover:opacity-90"
      >
        {t("auth.signInButton")}
      </Link>
    </main>
  );
}
