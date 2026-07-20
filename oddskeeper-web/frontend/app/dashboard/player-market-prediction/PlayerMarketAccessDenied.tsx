"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export default function PlayerMarketAccessDenied({ userEmail }: { userEmail?: string | null }) {
  const { t } = useI18n();
  const [email, setEmail] = useState(userEmail ?? "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError(t("playerMarket.invalidEmailError"));
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/player-market-access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) throw new Error("Failed to send");
      setSent(true);
    } catch {
      setError(t("playerMarket.genericError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card px-8 py-10 text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-veil">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink-3" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="text-[18px] font-bold text-ink">{t("playerMarket.accessRestrictedTitle")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          {t("playerMarket.accessRestrictedDescription")}
        </p>

        {sent ? (
          <div className="mt-8 rounded-lg border border-teal-500/20 bg-teal-500/10 px-4 py-4 text-[13px] text-teal-300">
            ✓ {t("playerMarket.requestSentMessage")}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-line bg-field px-4 py-3 text-[13px] text-ink placeholder-ink-3 focus:border-line-strong focus:outline-none"
            />

            {error && (
              <p className="text-left text-[12px] text-neg">{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full rounded-lg border border-line-strong bg-accent-soft py-3 text-[13px] font-medium text-ink transition hover:border-accent hover:bg-card-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? t("playerMarket.sendingLabel") : t("playerMarket.sendAccessRequestLabel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
