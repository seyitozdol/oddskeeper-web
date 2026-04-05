"use client";

import MatchCard from "@/components/MatchCard";
import StateMessage from "@/components/StateMessage";
import AppHeader from "@/components/AppHeader";
import useStagingMatches from "@/hooks/useStagingMatches";

export default function FootballPage() {
  const { apiStatus, matches, error, isLoading, refetch } = useStagingMatches();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <AppHeader
          title="Football"
          subtitle="Futbol veri akışı ekranı"
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium">
            API durum: {apiStatus}
          </div>

          <button
            onClick={refetch}
            disabled={isLoading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Yükleniyor..." : "Yenile"}
          </button>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Football Maç Önizleme</h2>
          <p className="mt-1 text-sm text-slate-600">
            Supabase üzerinden gelen futbol maç listesi
          </p>
        </div>

        {error ? (
          <StateMessage type="error" message={error} />
        ) : isLoading ? (
          <StateMessage type="loading" message="Yükleniyor..." />
        ) : matches.length === 0 ? (
          <StateMessage type="empty" message="Gösterilecek maç bulunamadı." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}