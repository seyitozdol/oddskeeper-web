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
  type MarketType,
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

  // Template ID ve tur taslaklari; kayitli degerle baslar, Kaydet ile toplu upsert edilir.
  const [templateIds, setTemplateIds] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<Record<string, MarketType>>({});
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<MarketType>("static");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (draftName !== null) draftInputRef.current?.focus();
  }, [draftName]);

  function templateValue(key: string): string {
    return templateIds[key] ?? storedByKey.get(key)?.template_id ?? "";
  }

  function typeValue(key: string): MarketType {
    return types[key] ?? storedByKey.get(key)?.market_type ?? "static";
  }

  async function handleSaveAll() {
    setSaving(true);
    let ok = true;
    for (const row of rows) {
      const stored = storedByKey.get(row.key);
      const tplTouched = templateIds[row.key] !== undefined;
      const typeTouched = types[row.key] !== undefined;
      if (!tplTouched && !typeTouched) continue; // dokunulmadi
      const value = (templateIds[row.key] ?? stored?.template_id ?? "").trim();
      const type = typeValue(row.key);
      if ((stored?.template_id ?? "") === value && (stored?.market_type ?? "static") === type)
        continue; // degismedi
      const res = await upsertStoredMarket({
        market_key: row.key,
        label: row.label,
        template_id: value || null,
        is_custom: row.isCustom,
        sort_order: stored?.sort_order,
        market_type: type,
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
      market_type: draftType,
    });
    if (ok) {
      setDraftName(null);
      setDraftType("static");
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
              <th className="px-2 py-2 w-28">{t("playerMarket.marketTypeLabel")}</th>
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
                <td className="px-2 py-1.5">
                  <select
                    value={typeValue(m.key)}
                    onChange={(e) =>
                      setTypes((prev) => ({ ...prev, [m.key]: e.target.value as MarketType }))
                    }
                    className="rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                  >
                    <option value="static">{t("playerMarket.staticLabel")}</option>
                    <option value="dynamic">{t("playerMarket.dynamicLabel")}</option>
                  </select>
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

            {/* Yeni market taslak satiri: isim + tur; Enter veya onay ile kaydeder */}
            {draftName !== null && (
              <tr className="border-t border-line">
                <td className="px-2 py-1.5">
                  <input
                    ref={draftInputRef}
                    type="text"
                    value={draftName}
                    placeholder={t("playerMarket.newMarketPlaceholder")}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveDraftMarket();
                      if (e.key === "Escape") setDraftName(null);
                    }}
                    className="w-40 rounded border border-teal-500/40 bg-field px-1.5 py-0.5 text-[12px] text-ink placeholder-ink-3 focus:border-teal-500/70 focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 text-ink-3 text-[11px]"></td>
                <td className="px-2 py-1.5">
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as MarketType)}
                    className="rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:border-teal-500/50 focus:outline-none"
                  >
                    <option value="static">{t("playerMarket.staticLabel")}</option>
                    <option value="dynamic">{t("playerMarket.dynamicLabel")}</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={saveDraftMarket}
                    title={t("playerMarket.saveLabel")}
                    className="rounded px-1.5 py-0.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/10"
                  >
                    ✓
                  </button>
                </td>
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

// ─── Input tab ────────────────────────────────────────────────────────────────
// Model'de Ekle'ye basilinca uretilen satirlar, secili marketin turune gore
// Static Input veya Dynamic Input segmentine duser. Yazdir tek sheet'li
// ("input") xlsx uretir, dosya adi fixture adidir. Temizle tabloyu bosaltir,
// satir sonundaki x tek satiri siler. Kolon basliklari sabittir.
// Static: secim basina bir satir. Dynamic: Ekle basina TEK satir; secimler
// sagda Selection_1, Selection_2 ... diye uc kolonluk bloklar halinde uzar.

export type StaticInputRow = {
  fixtureKey: number; // ic fixture_id (mukerrer kontrolu icin)
  fixtureLabel: string;
  fixtureId: string; // Fixture ID sekmesinde girilen deger
  marketTemplate: string;
  marketLabel: string;
  participant: string; // Oyuncu Listesi'ndeki ID
  playerSlug: string;
  playerName: string;
  sortOrder: number; // 1 = ev, 2 = deplasman
  line: string; // "0.5" (nokta formati)
  price: string; // "1.55" (nokta formati)
};

export type DynamicSelection = {
  price: string;
  participantId: string; // Selection_x_SubParticipantId
  sortOrder: number; // Selection_x_ParticipantSortOrder
  playerSlug: string;
  playerName: string;
  line: string;
};

export type DynamicInputRow = {
  fixtureKey: number;
  fixtureLabel: string;
  fixtureId: string;
  marketTemplate: string;
  marketLabel: string;
  selections: DynamicSelection[]; // ev once, sonra deplasman; line kucukten buyuge
};

const STATIC_HEADERS = [
  "Fixture ID",
  "Market Template",
  "Market Participant",
  "Market Participant Sort Order",
  "Line",
  "Market Status",
  "Selection_1_Name",
  "Selection_1_Price",
];

function staticRowCells(r: StaticInputRow): (string | number)[] {
  return [r.fixtureId, r.marketTemplate, r.participant, r.sortOrder, r.line, "", "Over", r.price];
}

function dynamicHeaders(maxSelections: number): string[] {
  const headers = ["Fixture ID", "Market Template", "Market Status"];
  for (let i = 1; i <= maxSelections; i++) {
    headers.push(
      `Selection_${i}_Price`,
      `Selection_${i}_SubParticipantId`,
      `Selection_${i}_ParticipantSortOrder`
    );
  }
  return headers;
}

function dynamicRowCells(r: DynamicInputRow, maxSelections: number): (string | number)[] {
  const cells: (string | number)[] = [r.fixtureId, r.marketTemplate, ""];
  for (let i = 0; i < maxSelections; i++) {
    const s = r.selections[i];
    if (s) cells.push(s.price, s.participantId, s.sortOrder);
    else cells.push("", "", "");
  }
  return cells;
}

function sanitizeFileLabel(label: string): string {
  return label.replace(/[\\/:*?"<>|]+/g, "-").trim() || "input";
}

export function InputTab({
  staticRows,
  dynamicRows,
  onClear,
  onDeleteRow,
}: {
  staticRows: StaticInputRow[];
  dynamicRows: DynamicInputRow[];
  onClear: (type: MarketType) => void;
  onDeleteRow: (type: MarketType, index: number) => void;
}) {
  const { t } = useI18n();
  const [segment, setSegment] = useState<MarketType>("dynamic");

  const rowCount = segment === "dynamic" ? dynamicRows.length : staticRows.length;
  const maxSelections = Math.max(1, ...dynamicRows.map((r) => r.selections.length));

  async function handleExport() {
    if (rowCount === 0) return;
    const XLSX = await import("xlsx");
    const aoa =
      segment === "dynamic"
        ? [dynamicHeaders(maxSelections), ...dynamicRows.map((r) => dynamicRowCells(r, maxSelections))]
        : [STATIC_HEADERS, ...staticRows.map(staticRowCells)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "input");
    const lastLabel =
      segment === "dynamic"
        ? dynamicRows[dynamicRows.length - 1].fixtureLabel
        : staticRows[staticRows.length - 1].fixtureLabel;
    XLSX.writeFile(wb, `${sanitizeFileLabel(lastLabel)}.xlsx`);
  }

  const thClass = "px-2 py-2 whitespace-nowrap";
  const tdClass = "px-2 py-1.5 text-ink-2 whitespace-nowrap tabular-nums";
  const deleteBtnClass =
    "rounded px-1.5 py-0.5 text-[13px] font-semibold text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400";

  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      {/* Segment secimi */}
      <div className="mb-3 flex items-center gap-1">
        {(["dynamic", "static"] as MarketType[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSegment(s)}
            className={`rounded-lg px-4 py-1.5 text-[13px] transition
              ${segment === s ? "bg-veil font-semibold text-ink" : "text-ink-3 hover:text-ink-2"}`}
          >
            {s === "dynamic"
              ? t("playerMarket.dynamicInputLabel")
              : t("playerMarket.staticInputLabel")}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={rowCount === 0}
            className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[13px] font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
          >
            {t("playerMarket.printLabel")}
          </button>
          <button
            type="button"
            onClick={() => onClear(segment)}
            disabled={rowCount === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[13px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {t("playerMarket.clearLabel")}
          </button>
        </div>
      </div>

      {rowCount === 0 ? (
        <div className="py-8 text-center text-sm text-ink-3">{t("playerMarket.noRowsLabel")}</div>
      ) : segment === "static" ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="bg-card-2">
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                {STATIC_HEADERS.map((h) => (
                  <th key={h} className={thClass}>{h}</th>
                ))}
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {staticRows.map((r, i) => (
                <tr key={i} className="border-t border-line transition hover:bg-veil">
                  <td className={tdClass} title={r.fixtureLabel}>{r.fixtureId}</td>
                  <td className={tdClass} title={r.marketLabel}>{r.marketTemplate}</td>
                  <td className={tdClass} title={r.playerName}>{r.participant}</td>
                  <td className={tdClass}>{r.sortOrder}</td>
                  <td className={tdClass}>{r.line}</td>
                  <td className={tdClass}></td>
                  <td className={tdClass}>Over</td>
                  <td className={tdClass}>{r.price}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteRow("static", i)}
                      title={t("playerMarket.deleteLabel")}
                      className={deleteBtnClass}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="bg-card-2">
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-3">
                {dynamicHeaders(maxSelections).map((h) => (
                  <th key={h} className={thClass}>{h}</th>
                ))}
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {dynamicRows.map((r, i) => (
                <tr key={i} className="border-t border-line transition hover:bg-veil">
                  <td className={tdClass} title={r.fixtureLabel}>{r.fixtureId}</td>
                  <td className={tdClass} title={r.marketLabel}>{r.marketTemplate}</td>
                  <td className={tdClass}></td>
                  {Array.from({ length: maxSelections }, (_, si) => {
                    const s = r.selections[si];
                    const tip = s ? `${s.playerName} ${s.line}` : undefined;
                    return s ? (
                      <FragmentCells key={si} tip={tip} cells={[s.price, s.participantId, s.sortOrder]} tdClass={tdClass} />
                    ) : (
                      <FragmentCells key={si} cells={["", "", ""]} tdClass={tdClass} />
                    );
                  })}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteRow("dynamic", i)}
                      title={t("playerMarket.deleteLabel")}
                      className={deleteBtnClass}
                    >
                      ×
                    </button>
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

function FragmentCells({
  cells,
  tdClass,
  tip,
}: {
  cells: (string | number)[];
  tdClass: string;
  tip?: string;
}) {
  return (
    <>
      {cells.map((c, i) => (
        <td key={i} className={tdClass} title={tip}>
          {c}
        </td>
      ))}
    </>
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
