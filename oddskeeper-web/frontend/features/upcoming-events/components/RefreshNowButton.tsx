"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";

type Phase = "idle" | "queued" | "running" | "done" | "error";

// Yalnizca admin sayfada render edilir. Butona basinca pipeline tetiklenir
// (public.pipeline_triggers'a pending satir); VPS worker calistirir. Buton
// durumu GET ile poll edilir; bitince sayfa yenilenir (taze oran gelir).
export default function RefreshNowButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function trigger() {
    if (phase === "queued" || phase === "running") return;
    setPhase("queued");
    try {
      const res = await fetch("/api/admin/trigger-refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error("trigger-refresh error:", e);
      setPhase("error");
      return;
    }
    startPolling();
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      // ~20 dk sonra pes et (heavy Bets10 kosusu dahil tum zincir)
      if (ticks > 240) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("idle");
        return;
      }
      try {
        const res = await fetch("/api/admin/trigger-refresh", { method: "GET" });
        const json = await res.json();
        const st = json?.latest?.status as string | undefined;
        if (st === "running") setPhase("running");
        else if (st === "done") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase("done");
          router.refresh();
          setTimeout(() => setPhase("idle"), 4000);
        } else if (st === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase("error");
        }
      } catch {
        // gecici hata: pollamaya devam
      }
    }, 5000);
  }

  const label =
    phase === "queued"
      ? t("upcomingEvents.refreshQueued")
      : phase === "running"
        ? t("upcomingEvents.refreshRunning")
        : phase === "done"
          ? t("upcomingEvents.refreshDone")
          : phase === "error"
            ? t("upcomingEvents.refreshError")
            : t("upcomingEvents.refreshNow");

  const busy = phase === "queued" || phase === "running";

  return (
    <button
      type="button"
      onClick={() => void trigger()}
      disabled={busy}
      title={t("upcomingEvents.refreshHint")}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition disabled:cursor-not-allowed ${
        phase === "error"
          ? "border-red-500/50 text-red-500"
          : phase === "done"
            ? "border-emerald-500/50 text-emerald-500"
            : "border-line bg-veil text-ink-2 hover:border-line-strong hover:text-ink"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
