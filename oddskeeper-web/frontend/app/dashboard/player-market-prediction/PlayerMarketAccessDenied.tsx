"use client";

import { useState } from "react";

export default function PlayerMarketAccessDenied({ userEmail }: { userEmail?: string | null }) {
  const [email, setEmail] = useState(userEmail ?? "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
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
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[20px] border border-white/10 bg-[#0d1624] px-8 py-10 text-center">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white/40" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="text-[18px] font-bold text-white">Access Restricted</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">
          Sorry, you don&apos;t have access to this page right now.
          If you&apos;d like to request access, please enter your email address below.
        </p>

        {sent ? (
          <div className="mt-8 rounded-[12px] border border-teal-500/20 bg-teal-500/10 px-4 py-4 text-[13px] text-teal-300">
            ✓ Your request has been sent. We&apos;ll get back to you shortly.
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="your@email.com"
              className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white placeholder-white/25 focus:border-[#4da2ff]/40 focus:outline-none"
            />

            {error && (
              <p className="text-left text-[12px] text-red-400">{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full rounded-[10px] border border-[#4da2ff]/25 bg-[#10233b] py-3 text-[13px] font-medium text-white transition hover:border-[#4da2ff]/45 hover:bg-[#14304f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Access Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
