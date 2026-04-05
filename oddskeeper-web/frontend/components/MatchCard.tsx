import Link from "next/link";
import type { MatchRow } from "@/lib/api";

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString("tr-TR");
  } catch {
    return dateString;
  }
}

type MatchCardProps = {
  match: MatchRow;
};

export default function MatchCard({ match }: MatchCardProps) {
  return (
    <Link href={`/matches/${match.id}`} className="block">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {match.source}
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {match.score ?? "-"}
          </span>
        </div>

        <h3 className="text-lg font-bold leading-snug">
          {match.home_team ?? "-"} vs {match.away_team ?? "-"}
        </h3>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Hakem:</span> {match.referee ?? "-"}
          </p>
          <p>
            <span className="font-semibold">Stadyum:</span> {match.venue ?? "-"}
          </p>
          <p>
            <span className="font-semibold">Tarih:</span>{" "}
            {formatDate(match.created_at)}
          </p>
          <p className="break-all">
            <span className="font-semibold">Match ID:</span>{" "}
            {match.source_match_id}
          </p>
        </div>
      </div>
    </Link>
  );
}