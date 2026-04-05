"use client";

import Link from "next/link";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password.trim() || !passwordRepeat.trim()) {
      setSuccessMessage("");
      setError("Tüm alanlar zorunlu.");
      return;
    }

    if (password !== passwordRepeat) {
      setSuccessMessage("");
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage("Demo kayıt başarılı. Auth henüz bağlı değil.");
      setEmail("");
      setPassword("");
      setPasswordRepeat("");
    }, 800);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <AppHeader title="Üye Ol" subtitle="Yeni hesap oluştur" />

        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifreni gir"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Şifre Tekrar
              </label>
              <input
                type="password"
                value={passwordRepeat}
                onChange={(e) => setPasswordRepeat(e.target.value)}
                placeholder="Şifreni tekrar gir"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-sm text-slate-600">
              Zaten hesabın var mı?
            </p>

            <Link
              href="/login"
              className="mt-3 inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Login Sayfasına Git
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Not: Bu şu an demo kayıt formu. Gerçek auth bağlı değil.
          </p>
        </div>
      </div>
    </main>
  );
}