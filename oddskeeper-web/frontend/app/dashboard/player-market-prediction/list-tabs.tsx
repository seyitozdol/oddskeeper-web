"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import { getCountryFlagUrl } from "@/lib/country-flags";
import {
  fetchAllCurrentPlayers,
  fetchFixtureInputs,
  saveFixtureInputs,
  fetchPlayerIds,
  savePlayerIds,
  upsertStoredMarket,
  deleteStoredMarket,
  MARKET_OPTIONS,
  type DirectoryPlayer,
  type StoredMarket,
  type UpcomingFixture,
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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([fetchAllCurrentPlayers(), fetchPlayerIds()]).then(
      ([p, storedIds]) => {
        setPlayers(p);
        setIds(storedIds);
        setLoading(false);
      }
    );
  }, []);

  async function handleSave() {
    setSaving(true);
    const ok = await savePlayerIds(ids);
    setSaving(false);
    if (ok) setSavedAt(Date.now());
  }

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
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="ml-auto rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          {saving ? t("playerMarket.sendingLabel") : t("playerMarket.saveLabel")}
        </button>
        {savedAt !== null && !saving && (
          <span className="text-[12px] text-teal-400">{t("playerMarket.savedLabel")}</span>
        )}
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
// Yerlesik marketler + Yeni butonuyla eklenen ozel marketler. Market Template ID
// ve ozel marketler analytics.pm_markets'a kaydedilir (blur/Enter'da upsert).

function slugifyMarketKey(label: string): string {
  return (
    "custom_" +
    label
      .toLowerCase()
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

export function MarketListTab({
  storedMarkets,
  onChanged,
}: {
  storedMarkets: StoredMarket[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const storedByKey = useMemo(
    () => new Map(storedMarkets.map((m) => [m.market_key, m])),
    [storedMarkets]
  );
  const customMarkets = useMemo(
    () => storedMarkets.filter((m) => m.is_custom),
    [storedMarkets]
  );

  // Template ID taslaklari; kayitli degerle baslar, Kaydet ile toplu upsert edilir.
  const [templateIds, setTemplateIds] = useState<Record<string, string>>({});
  const [draftName, setDraftName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (draftName !== null) draftInputRef.current?.focus();
  }, [draftName]);

  function templateValue(key: string): string {
    return templateIds[key] ?? storedByKey.get(key)?.template_id ?? "";
  }

  async function handleSaveAll() {
    setSaving(true);
    let ok = true;
    for (const row of rows) {
      const draft = templateIds[row.key];
      if (draft === undefined) continue; // dokunulmadi
      const value = draft.trim();
      if ((storedByKey.get(row.key)?.template_id ?? "") === value) continue;
      const res = await upsertStoredMarket({
        market_key: row.key,
        label: row.label,
        template_id: value || null,
        is_custom: row.isCustom,
        sort_order: storedByKey.get(row.key)?.sort_order,
      });
      ok = ok && res;
    }
    setSaving(false);
    if (ok) {
      setSavedAt(Date.now());
      onChanged();
    }
  }

  async function handleDelete(key: string) {
    const ok = await deleteStoredMarket(key);
    if (ok) {
      setTemplateIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      onChanged();
    }
  }

  async function saveDraftMarket() {
    const name = (draftName ?? "").trim();
    if (!name) {
      setDraftName(null);
      return;
    }
    let key = slugifyMarketKey(name);
    if (!key.replace(/^custom_/, "")) key = `custom_market`;
    // Ayni anahtar varsa sonuna sayi ekle
    let unique = key;
    let i = 2;
    while (storedByKey.has(unique) || MARKET_OPTIONS.some((m) => m.key === unique)) {
      unique = `${key}_${i++}`;
    }
    const maxSort = Math.max(0, ...customMarkets.map((m) => m.sort_order));
    const ok = await upsertStoredMarket({
      market_key: unique,
      label: name,
      template_id: null,
      is_custom: true,
      sort_order: maxSort + 1,
    });
    if (ok) {
      setDraftName(null);
      onChanged();
    }
  }

  const rows: Array<{ key: string; label: string; isCustom: boolean }> = [
    ...MARKET_OPTIONS.map((m) => ({ key: m.key, label: m.label, isCustom: false })),
    ...customMarkets.map((m) => ({ key: m.market_key, label: m.label, isCustom: true })),
  ];

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <div className="overflow-x-auto rounded-lg border border-line max-w-md">
        <table className="min-w-full border-collapse text-[12px]">
          <thead className="bg-card-2">
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
              <th className="px-2 py-2">{t("playerMarket.marketLabel")}</th>
              <th className="px-2 py-2 w-40">{t("playerMarket.marketTemplateIdLabel")}</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key} className="border-t border-line transition hover:bg-veil">
                <td className="px-2 py-1.5 font-medium text-ink whitespace-nowrap">{m.label}</td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={templateValue(m.key)}
                    onChange={(e) =>
                      setTemplateIds((prev) => ({ ...prev, [m.key]: e.target.value }))
                    }
                    className="w-36 rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  {m.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.key)}
                      title={t("playerMarket.deleteLabel")}
                      className="rounded px-1.5 py-0.5 text-[13px] font-semibold text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Yeni market taslak satiri */}
            {draftName !== null && (
              <tr className="border-t border-line">
                <td className="px-2 py-1.5">
                  <input
                    ref={draftInputRef}
                    type="text"
                    value={draftName}
                    placeholder={t("playerMarket.newMarketPlaceholder")}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={saveDraftMarket}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setDraftName(null);
                    }}
                    className="w-40 rounded border border-teal-500/40 bg-field px-1.5 py-0.5 text-[12px] text-ink placeholder-ink-3 focus:border-teal-500/70 focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 text-ink-3 text-[11px]"></td>
                <td className="px-2 py-1.5"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Yeni: en alta ekler, kaydeder; Model'deki market listesine de girer */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDraftName("")}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
        >
          {t("playerMarket.newLabel")}
        </button>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          {saving ? t("playerMarket.sendingLabel") : t("playerMarket.saveLabel")}
        </button>
        {savedAt !== null && !saving && (
          <span className="text-[12px] text-teal-400">{t("playerMarket.savedLabel")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Fixture ID tab ───────────────────────────────────────────────────────────
// Model'deki maclar + mac basina input. Kaydet, analytics.pm_fixture_inputs'a
// yazar; Model'deki Ekle akisi ileride bu kayitlari kullanacak.

export function FixtureIdTab({ fixtures }: { fixtures: UpcomingFixture[] }) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetchFixtureInputs().then((v) => {
      setValues(v);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    const ok = await saveFixtureInputs(values);
    setSaving(false);
    if (ok) setSavedAt(Date.now());
  }

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
        >
          {saving ? t("playerMarket.sendingLabel") : t("playerMarket.saveLabel")}
        </button>
        {savedAt !== null && !saving && (
          <span className="text-[12px] text-teal-400">{t("playerMarket.savedLabel")}</span>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-ink-3">{t("common.loading")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line max-w-2xl">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="bg-card-2">
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <th className="px-2 py-2">{t("playerMarket.fixtureLabel")}</th>
                <th className="px-2 py-2 w-40">{t("playerMarket.tabFixtureIds")}</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.fixture_id} className="border-t border-line transition hover:bg-veil">
                  <td className="px-2 py-1.5 text-ink whitespace-nowrap">{f.label}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={values[f.fixture_id] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [f.fixture_id]: e.target.value }))
                      }
                      className="w-36 rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
