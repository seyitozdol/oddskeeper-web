import Link from "next/link";
import {
  getVolleyballPlayer,
  getVolleyballPlayerCompetitions,
  getVolleyballPlayerMatches,
} from "@/features/volleyball/server/getVolleyballStats";
import { getT } from "@/lib/i18n/server";
import { vbwPhotoUrl } from "@/features/volleyball/lib";
import type { VbPlayerMatch } from "@/features/volleyball/types";

function ageOf(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
}

function Tile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-line bg-card-2 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-ink">
        {value == null || value === "" ? "—" : value}
      </div>
    </div>
  );
}

export default async function VolleyballPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ fivbId: string }>;
  searchParams: Promise<{ comp?: string }>;
}) {
  const [{ fivbId }, { comp }, t] = await Promise.all([
    params,
    searchParams,
    getT(),
  ]);
  const id = Number(fivbId);

  const [bio, comps] = await Promise.all([
    getVolleyballPlayer(id),
    getVolleyballPlayerCompetitions(id),
  ]);

  const compId = Number(comp);
  const selected = comps.find((c) => c.competition_id === compId) ?? comps[0];
  const selectedId = selected?.competition_id ?? 0;

  const matches = selectedId
    ? await getVolleyballPlayerMatches(id, selectedId)
    : [];
  const scoring = matches.filter((m) => m.category === "scoring");

  const name = bio?.full_name ?? selected?.full_name ?? bio?.short_name ?? String(id);
  const age = ageOf(bio?.birth_date ?? null);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const g = (m: VbPlayerMatch, k: string) => m.data?.[k] ?? null;

  return (
    <section className="w-full">
      <div className="mb-4">
        <Link
          href="/dashboard/volleyball"
          className="text-[13px] text-ink-3 transition hover:text-ink"
        >
          ← {t("volleyball.title")}
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-card p-8">
        {/* Baslik + bio */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {(() => {
              const photo = vbwPhotoUrl(bio?.vbw_photo) ?? (bio?.sofascore_player_id ? `https://img.sofascore.com/api/v1/player/${bio.sofascore_player_id}/image` : null);
              return photo;
            })() ? (
              // Oyuncu fotografi (volleyballworld; yoksa SofaScore).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vbwPhotoUrl(bio?.vbw_photo) ?? `https://img.sofascore.com/api/v1/player/${bio?.sofascore_player_id}/image`}
                alt={name}
                width={72}
                height={72}
                className="h-18 w-18 shrink-0 rounded-full border border-line bg-card-2 object-cover"
                style={{ height: 72, width: 72 }}
              />
            ) : bio?.nationality ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/images/flags/tr.png"
                alt={bio.nationality}
                width={44}
                height={30}
                className="h-[30px] w-11 rounded-[3px] object-cover"
                style={{ opacity: selected?.team_code === "TUR" ? 1 : 0.25 }}
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-semibold text-ink">{name}</h1>
              <p className="mt-0.5 text-sm text-ink-3">
                {[
                  bio?.position,
                  selected?.team_code,
                  bio?.height_cm ? `${bio.height_cm} cm` : null,
                  age != null ? `${age} ${t("volleyball.thAge").toLowerCase()}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>

        {/* Turnuva secici */}
        {comps.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {comps.map((c) => (
              <Link
                key={c.competition_id}
                href={`/dashboard/volleyball/player/${id}?comp=${c.competition_id}`}
                className={`rounded-full px-3.5 py-1 text-[12px] font-semibold transition ${
                  c.competition_id === selectedId
                    ? "bg-accent text-white"
                    : "bg-card-2 text-ink-2 hover:bg-veil hover:text-ink"
                }`}
              >
                {c.short_label}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Turnuva toplamlari */}
        {selected ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Tile label={t("volleyball.thPts")} value={selected.points} />
            <Tile label={t("volleyball.thAtk")} value={selected.attack_points} />
            <Tile label={t("volleyball.thBlk")} value={selected.block_points} />
            <Tile label={t("volleyball.thSrv")} value={selected.serve_points} />
            <Tile label={t("volleyball.thDig")} value={selected.dig_digs} />
            <Tile label={t("volleyball.thRec")} value={selected.rec_success} />
          </div>
        ) : null}

        {/* Mac-mac scoring */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {selected?.short_label ?? ""}
          </h2>
          {scoring.length === 0 ? (
            <p className="text-sm text-ink-3">{t("volleyball.noPlayers")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-ink-3">
                    <th className="px-2 py-2 text-left">{t("volleyball.thTeam")}</th>
                    <th className="px-2 py-2 text-left"> </th>
                    <th className="px-2 py-2 text-right">{t("volleyball.thPts")}</th>
                    <th className="px-2 py-2 text-right">{t("volleyball.thAtk")}</th>
                    <th className="px-2 py-2 text-right">{t("volleyball.thBlk")}</th>
                    <th className="px-2 py-2 text-right">{t("volleyball.thSrv")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scoring.map((m, i) => (
                    <tr key={i} className="border-b border-line/60 hover:bg-veil">
                      <td className="px-2 py-1.5 text-ink-3">{fmtDate(m.match_date)}</td>
                      <td className="px-2 py-1.5 text-ink-2">
                        {m.home_team} <span className="text-ink-3">v</span> {m.away_team}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-ink">
                        {g(m, "points") ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-ink-2">
                        {g(m, "attack_points") ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-ink-2">
                        {g(m, "block_points") ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-ink-2">
                        {g(m, "serve_points") ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
