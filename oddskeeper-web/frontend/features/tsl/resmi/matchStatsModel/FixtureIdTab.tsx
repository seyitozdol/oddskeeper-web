"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../../lib/i18n/LanguageProvider";
import {
  fetchFixtures,
  fetchFixtureInputs,
  fetchBets10Links,
  fetchTeamLogos,
  fetchTeams,
  fetchManualFixtures,
  addManualFixture,
  deleteManualFixture,
  manualSlug,
  saveFixtureInputs,
  completedRoundSet,
  fixtureStarted,
  type FixtureRow,
  type FixtureInput,
  type Bets10Link,
  type TeamOption,
} from "./queries";
import TeamCrest from "@/features/tsl/shared/TeamCrest";
import { TenText } from "@/components/TenBadge";
import { getTeamLogoPath } from "@/features/player-detail/utils/getTeamLogoPath";
import RefreshNowButton from "@/features/upcoming-events/components/RefreshNowButton";

const NO_SPINNER =
  "appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const ROUNDS = Array.from({ length: 34 }, (_, i) => i + 1);

// Kaydedilen oran, güncel Bets10 önerisinden farklı mı? (2 ondalık toleransı).
const round2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);
function oddsStale(v: FixtureInput | undefined, lk: Bets10Link | undefined): boolean {
  if (!v || !lk) return false;
  if (v.homeOdds == null && v.drawOdds == null && v.awayOdds == null) return false; // kaydedilmiş oran yok
  return (
    round2(v.homeOdds) !== round2(lk.homeOdds) ||
    round2(v.drawOdds) !== round2(lk.drawOdds) ||
    round2(v.awayOdds) !== round2(lk.awayOdds)
  );
}

// Takım adı girişi: yazınca eşleşen takımlar önerilir (tıklayınca slug set edilir),
// ama kullanıcı serbest metin de yazabilir (o zaman slug boş = isimsiz takım).
function TeamNameField({
  value,
  teams,
  placeholder,
  onChange,
}: {
  value: string;
  teams: TeamOption[];
  placeholder: string;
  onChange: (name: string, slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [value, teams]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value, ""); // serbest metin: slug temizlenir
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-40 rounded border border-line bg-field px-2 py-1 text-[12px] text-ink focus:border-accent focus:outline-none"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-0.5 w-48 overflow-hidden rounded-md border border-line bg-card shadow-lg">
          {matches.map((tm) => (
            <button
              key={tm.slug}
              type="button"
              onClick={() => {
                onChange(tm.name, tm.slug);
                setOpen(false);
              }}
              className="block w-full truncate px-2 py-1 text-left text-[12px] text-ink-2 hover:bg-veil hover:text-ink"
            >
              {tm.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FixtureIdTab({
  league,
  isAdmin = false,
  onSaved,
  onManualChanged,
}: {
  league: string;
  isAdmin?: boolean;
  onSaved?: () => void;
  // Manuel fikstür eklen/silindiğinde model ekranının fikstür listesi tazelensin.
  onManualChanged?: () => void;
}) {
  const { t } = useI18n();
  const [round, setRound] = useState(1);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  // Tum sezon fikstürü: tamamlanan haftalari (son macin baslama saati gecen)
  // hesaplayip round dropdown'inda en alta itmek icin.
  const [allFixtures, setAllFixtures] = useState<FixtureRow[]>([]);
  const [manuals, setManuals] = useState<FixtureRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [inputs, setInputs] = useState<Record<string, FixtureInput>>({});
  const [links, setLinks] = useState<Record<string, Bets10Link>>({});
  const [teamLogos, setTeamLogos] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState<"" | "saving" | "ok" | "err">("");
  // Manuel ekleme formu.
  const [nh, setNh] = useState({ name: "", slug: "" });
  const [na, setNa] = useState({ name: "", slug: "" });
  const [adding, setAdding] = useState(false);
  // Manuel fikstür silme: History dropdown'daki gibi satır içi onay (Sil? Evet/Vazgeç).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const logoFor = (slug: string): string | null =>
    teamLogos ? (teamLogos[slug] ?? null) : getTeamLogoPath(slug);

  function reloadOdds() {
    fetchFixtureInputs(league).then(setInputs);
    fetchBets10Links(league).then(setLinks);
  }
  const reloadManuals = () => fetchManualFixtures(league).then(setManuals);
  useEffect(() => {
    reloadOdds();
    fetchTeamLogos(league).then(setTeamLogos);
    fetchTeams(league).then(setTeams);
    reloadManuals();
    fetchFixtures(league).then(setAllFixtures);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);
  useEffect(() => {
    fetchFixtures(league, round).then(setFixtures);
  }, [league, round]);

  // Round dropdown sirasi: aktif haftalar (kucukten buyuge) ustte, tamamlanan
  // haftalar en altta. Round listesi fikstürden turetilir (TFF1 38 hafta).
  const completedRounds = useMemo(() => completedRoundSet(allFixtures), [allFixtures]);
  const roundOptions = useMemo(() => {
    const rounds = allFixtures.length
      ? [...new Set(allFixtures.map((f) => f.round))].sort((a, b) => a - b)
      : ROUNDS;
    return [...rounds.filter((r) => !completedRounds.has(r)), ...rounds.filter((r) => completedRounds.has(r))];
  }, [allFixtures, completedRounds]);

  // Acilis secimi: ilk aktif (tamamlanmamis) hafta. Yalniz bir kez uygulanir,
  // kullanicinin sonraki secimini ezmez.
  const roundInitRef = useRef(false);
  useEffect(() => {
    if (roundInitRef.current || !allFixtures.length) return;
    roundInitRef.current = true;
    const first = roundOptions.find((r) => !completedRounds.has(r));
    if (first != null) setRound(first);
  }, [allFixtures, roundOptions, completedRounds]);

  async function addManual() {
    if (!nh.name.trim() || !na.name.trim()) return;
    setAdding(true);
    const hSlug = nh.slug || manualSlug(nh.name);
    const aSlug = na.slug || manualSlug(na.name);
    const id = await addManualFixture(league, hSlug, nh.name.trim(), aSlug, na.name.trim());
    setAdding(false);
    if (id) {
      setNh({ name: "", slug: "" });
      setNa({ name: "", slug: "" });
      await reloadManuals();
      onManualChanged?.();
    }
  }
  async function removeManual(id: string) {
    if (await deleteManualFixture(id)) {
      await reloadManuals();
      onManualChanged?.();
    }
    setConfirmDeleteId(null);
  }

  function edit(fid: string, patch: Partial<FixtureInput>) {
    setInputs((prev) => {
      const base: FixtureInput = prev[fid] ?? {
        externalFixtureId: "",
        homeOdds: null,
        drawOdds: null,
        awayOdds: null,
      };
      return { ...prev, [fid]: { ...base, ...patch } };
    });
  }

  function applyLink(fid: string, lk: Bets10Link) {
    edit(fid, {
      externalFixtureId: lk.bets10EventId ?? "",
      homeOdds: lk.homeOdds,
      drawOdds: lk.drawOdds,
      awayOdds: lk.awayOdds,
    });
  }
  // Baslamis maca Bets10 onerisi sunulmaz/uygulanmaz: canli/sonuclanmis oranlar
  // (1.00 gibi) mac-oncesi kaydi kirletmesin (deadline = baslama saati).
  function applyAllVisible() {
    for (const f of fixtures) {
      if (fixtureStarted(f)) continue;
      const lk = links[f.fixtureId];
      if (lk) applyLink(f.fixtureId, lk);
    }
  }
  const visibleWithLink = fixtures.filter((f) => !fixtureStarted(f) && links[f.fixtureId]).length;

  async function save() {
    setStatus("saving");
    const rows = Object.entries(inputs).map(([fixture_id, v]) => ({
      fixture_id,
      external_fixture_id: v.externalFixtureId ?? "",
      home_odds: v.homeOdds, draw_odds: v.drawOdds, away_odds: v.awayOdds,
    }));
    const ok = await saveFixtureInputs(league, rows);
    setStatus(ok ? "ok" : "err");
    if (ok) onSaved?.();
    setTimeout(() => setStatus(""), 2500);
  }

  const inp = `rounded border border-line bg-field px-1.5 py-0.5 text-[11px] text-ink focus:outline-none focus:border-accent ${NO_SPINNER}`;

  // Manuel fikstürler her zaman en üstte + round'dan bağımsız.
  const rows: FixtureRow[] = [...manuals, ...fixtures];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-wide text-ink-3">Round</label>
        <select
          className="rounded-md border border-line bg-field px-2 py-1 text-sm text-ink"
          value={round}
          onChange={(e) => setRound(parseInt(e.target.value))}
        >
          {roundOptions.map((r) => (
            <option key={r} value={r} className="bg-field text-ink">{r}</option>
          ))}
        </select>
        {isAdmin && (
          <div className="ml-auto" title={t("msm.betsRefreshHint")}>
            <RefreshNowButton kind="bets10_odds" onDone={reloadOdds} />
          </div>
        )}
        <button
          onClick={applyAllVisible}
          disabled={visibleWithLink === 0}
          title={t("msm.betsHint")}
          className={`${isAdmin ? "" : "ml-auto "}rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-veil disabled:opacity-40`}
        >
          <TenText text={t("msm.betsFill")} />{visibleWithLink > 0 ? ` (${visibleWithLink})` : ""}
        </button>
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {t("msm.save")}
        </button>
        {status === "ok" && <span className="text-sm text-pos">{t("msm.saved")}</span>}
        {status === "err" && <span className="text-sm text-neg">{t("msm.saveFailed")}</span>}
      </div>

      {/* Manuel fikstür ekleme: takım adı yazınca öneri çıkar, serbest metin de olur */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card-2/40 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{t("msm.manualFixture")}</span>
        <TeamNameField value={nh.name} teams={teams} placeholder={t("msm.home")} onChange={(name, slug) => setNh({ name, slug })} />
        <span className="text-ink-3">-</span>
        <TeamNameField value={na.name} teams={teams} placeholder={t("msm.away")} onChange={(name, slug) => setNa({ name, slug })} />
        <button
          onClick={addManual}
          disabled={adding || !nh.name.trim() || !na.name.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {t("msm.addFixture")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="text-left text-[12px]">
          <thead className="bg-card-2 text-[10px] uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-2 py-2">Maç</th>
              <th className="px-1.5 py-2">{t("msm.oddsHome")}</th>
              <th className="px-1.5 py-2">{t("msm.oddsDraw")}</th>
              <th className="px-1.5 py-2">{t("msm.oddsAway")}</th>
              <th className="px-2 py-2">{t("msm.tab_fixtures")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const v = inputs[f.fixtureId];
              // Mac basladiysa oran duzenleme + Uygula kapali (canli/bayat oran girilmesin).
              const started = fixtureStarted(f);
              const lk = started ? undefined : links[f.fixtureId];
              return (
                <tr key={f.fixtureId} className="border-t border-line/60 hover:bg-veil">
                  <td className="px-2 py-1.5 whitespace-nowrap text-ink">
                    <span className="flex items-center gap-1.5">
                      {f.manual &&
                        (confirmDeleteId === f.fixtureId ? (
                          <span className="mr-0.5 flex shrink-0 items-center gap-1 text-[10px]">
                            <span className="text-ink-3">{t("modelHistory.deleteConfirm")}</span>
                            <button
                              type="button"
                              onClick={() => removeManual(f.fixtureId)}
                              className="rounded bg-neg/15 px-1.5 py-0.5 font-semibold text-neg hover:bg-neg/25"
                            >
                              {t("modelHistory.deleteYes")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-1.5 py-0.5 text-ink-3 hover:text-ink"
                            >
                              {t("modelHistory.deleteNo")}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(f.fixtureId)}
                            title={t("modelHistory.deleteConfirm")}
                            className="mr-0.5 shrink-0 rounded px-1 text-[13px] leading-none text-ink-3 hover:text-neg"
                          >
                            ×
                          </button>
                        ))}
                      <TeamCrest logo={logoFor(f.homeSlug)} name={f.homeName} size="xs" />
                      <span>{f.homeName}</span>
                      <span className="text-ink-3">-</span>
                      <TeamCrest logo={logoFor(f.awaySlug)} name={f.awayName} size="xs" />
                      <span>{f.awayName}</span>
                      {f.manual && (
                        <span className="ml-1 rounded bg-veil px-1 py-0.5 text-[9px] font-semibold uppercase text-ink-3">
                          {t("msm.manualBadge")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input type="number" step="0.01" disabled={started} className={`${inp} w-14 disabled:opacity-40`} value={v?.homeOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { homeOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input type="number" step="0.01" disabled={started} className={`${inp} w-14 disabled:opacity-40`} value={v?.drawOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { drawOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <input type="number" step="0.01" disabled={started} className={`${inp} w-14 disabled:opacity-40`} value={v?.awayOdds ?? ""}
                      onChange={(e) => edit(f.fixtureId, { awayOdds: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <input type="text" className={`${inp} w-32`} value={v?.externalFixtureId ?? ""}
                        placeholder="fixture id"
                        onChange={(e) => edit(f.fixtureId, { externalFixtureId: e.target.value })} />
                      {lk && (
                        <button
                          onClick={() => applyLink(f.fixtureId, lk)}
                          title={`${t("msm.betsHint")}: ${lk.homeOdds ?? "-"}/${lk.drawOdds ?? "-"}/${lk.awayOdds ?? "-"}${lk.bets10EventId ? ` · ${lk.bets10EventId}` : ""}`}
                          className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20"
                        >
                          {t("msm.betsApply")}
                        </button>
                      )}
                    </div>
                    {lk && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-ink-3">
                          {lk.homeOdds ?? "-"}/{lk.drawOdds ?? "-"}/{lk.awayOdds ?? "-"}
                        </span>
                        {oddsStale(v, lk) && (
                          <span
                            title={t("msm.oddsStaleHint")}
                            className="rounded border border-warn/40 bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn"
                          >
                            ⟳ {t("msm.oddsStale")}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
