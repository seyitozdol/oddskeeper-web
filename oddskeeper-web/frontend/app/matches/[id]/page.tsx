"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getStagingMatchDetail, type MatchDetail } from "@/lib/api";
import StateMessage from "@/components/StateMessage";
import AppHeader from "@/components/AppHeader";

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString("tr-TR");
  } catch {
    return dateString;
  }
}

function showValue(value: string | null) {
  return value ?? "-";
}

function showPageStatus(
  value:
    | {
        reason: string;
        status: string;
        body_excerpt: string;
        matched_text: string;
      }
    | null
) {
  if (!value) return "-";
  return value.status || "-";
}

export default function MatchDetailPage() {
  const params = useParams();
  const idParam = params.id;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const matchId = Number(idParam);

    if (!matchId || Number.isNaN(matchId)) {
      setError("Geçersiz maç id");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getStagingMatchDetail(matchId)
      .then((data) => {
        setMatch(data);
        setError("");
      })
      .catch((err: Error) => {
        setError(err.message || "Maç detayı alınamadı");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [idParam]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <AppHeader
          title="Maç Detayı"
          subtitle="Seçilen staging maç kaydının detay ekranı"
        />

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              ← Geri Dön
            </Link>

            {match?.match_url && (
              <a
                href={match.match_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Match URL Aç
              </a>
            )}
          </div>
        </div>

        {error ? (
          <StateMessage type="error" message={error} />
        ) : isLoading ? (
          <StateMessage type="loading" message="Detay yükleniyor..." />
        ) : !match ? (
          <StateMessage type="empty" message="Maç bulunamadı." />
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {match.source}
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {match.score ?? "-"}
                </span>
              </div>

              <h2 className="text-2xl font-bold">
                {match.home_team ?? "-"} vs {match.away_team ?? "-"}
              </h2>

              <div className="mt-6 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-semibold">Competition:</span>{" "}
                  {showValue(match.competition)}
                </p>
                <p>
                  <span className="font-semibold">Match Date Text:</span>{" "}
                  {showValue(match.match_date_text)}
                </p>
                <p>
                  <span className="font-semibold">Created At:</span>{" "}
                  {formatDate(match.created_at)}
                </p>
                <p>
                  <span className="font-semibold">Attendance:</span>{" "}
                  {showValue(match.attendance_text)}
                </p>
                <p>
                  <span className="font-semibold">Hakem:</span>{" "}
                  {showValue(match.referee)}
                </p>
                <p>
                  <span className="font-semibold">Stadyum:</span>{" "}
                  {showValue(match.venue)}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Home Team ID:</span>{" "}
                  {showValue(match.home_team_id)}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Away Team ID:</span>{" "}
                  {showValue(match.away_team_id)}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Source Match ID:</span>{" "}
                  {match.source_match_id}
                </p>
                <p>
                  <span className="font-semibold">Winner Side:</span>{" "}
                  {showValue(match.winner_side)}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Winner Team Source ID:</span>{" "}
                  {showValue(match.winner_team_source_id)}
                </p>
                <p>
                  <span className="font-semibold">Overall Status:</span>{" "}
                  {showValue(match.overall_status)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Sayfa Durumları</h3>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Match Summary Status</p>
                  <p className="mt-2">{showValue(match.match_summary_status)}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Opta Points Status</p>
                  <p className="mt-2">{showValue(match.opta_points_status)}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Match Details Status</p>
                  <p className="mt-2">{showValue(match.match_details_status)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Match Details Page Status</p>
                  <p className="mt-2">{showPageStatus(match.match_details_page_status)}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Match Summary Page Status</p>
                  <p className="mt-2">{showPageStatus(match.match_summary_page_status)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">İçerik Özeti</h3>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Details Sections</p>
                  <p className="mt-2">{match.details_sections_count}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Player Stats Sections</p>
                  <p className="mt-2">{match.player_stats_sections_count}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">Opta Points Keys Count</p>
                  <p className="mt-2">{match.opta_points_stats_keys.length}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Opta Points Keys</p>
                <p className="mt-2 break-all">
                  {match.opta_points_stats_keys.length > 0
                    ? match.opta_points_stats_keys.join(", ")
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}