"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getCountryFlagUrl } from "@/lib/country-flags";
import {
  fetchAllCurrentPlayers,
  MARKET_OPTIONS,
  type DirectoryPlayer,
} from "./queries";

const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
};

// Turkce karakterlere duyarsiz arama icin normalize eder.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ─── Player List tab ──────────────────────────────────────────────────────────
// Guncel kadrolardaki tum oyuncular. ID kolonu simdilik bos, elle doldurulabilir;
// ozel bir id listesine baglanacak.

export function PlayerListTab({
  teamLogos,
}: {
  teamLogos: Record<string, string>;
}) {
  const { t } = useI18n();
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [ids, setIds] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllCurrentPlayers().then((p) => {
      setPlayers(p);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return players;
    return players.filter(
      (p) =>
        norm(p.full_name).includes(q) || norm(p.team_name ?? "").includes(q)
    );
  }, [players, query]);

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      {/* Search */}
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("playerMarket.searchPlaceholder")}
          className="w-72 rounded-lg border border-line bg-field px-3 py-2 text-[13px] text-ink placeholder-ink-3 focus:border-teal-500/50 focus:outline-none"
        />
        <span className="text-[12px] text-ink-3">
          {filtered.length} / {players.length}
        </span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-ink-3">{t("common.loading")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="bg-card-2">
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-2 py-2">{t("common.player")}</th>
                <th className="px-2 py-2">{t("common.team")}</th>
                <th className="px-2 py-2">{t("playerMarket.countryLabel")}</th>
                <th className="px-2 py-2">{t("common.position")}</th>
                <th className="px-2 py-2 w-28">ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const logo = p.team_slug ? teamLogos[p.team_slug] : undefined;
                const flag = getCountryFlagUrl(p.nationality);
                return (
                  <tr key={p.player_slug} className="border-t border-line transition hover:bg-veil">
                    <td className="px-2 py-1.5 font-medium text-ink whitespace-nowrap">
                      {p.full_name}
                    </td>
                    <td className="px-2 py-1.5 text-ink-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="h-4 w-4 object-contain" />
                        )}
                        {p.team_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-ink-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {flag && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={flag} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
                        )}
                        {p.nationality ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-ink-3">
                      {POSITION_SHORT[p.position ?? ""] ?? p.position ?? "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={ids[p.player_slug] ?? ""}
                        onChange={(e) =>
                          setIds((prev) => ({ ...prev, [p.player_slug]: e.target.value }))
                        }
                        className="w-24 rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Market List tab ──────────────────────────────────────────────────────────
// Tum marketler + simdilik bos, elle doldurulabilir Market Template ID kolonu.

export function MarketListTab() {
  const { t } = useI18n();
  const [templateIds, setTemplateIds] = useState<Record<string, string>>({});

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <div className="overflow-x-auto rounded-lg border border-line max-w-md">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="bg-card-2">
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2">{t("playerMarket.marketLabel")}</th>
              <th className="px-2 py-2 w-40">{t("playerMarket.marketTemplateIdLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {MARKET_OPTIONS.map((m) => (
              <tr key={m.key} className="border-t border-line transition hover:bg-veil">
                <td className="px-2 py-1.5 font-medium text-ink whitespace-nowrap">{m.label}</td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={templateIds[m.key] ?? ""}
                    onChange={(e) =>
                      setTemplateIds((prev) => ({ ...prev, [m.key]: e.target.value }))
                    }
                    className="w-36 rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
