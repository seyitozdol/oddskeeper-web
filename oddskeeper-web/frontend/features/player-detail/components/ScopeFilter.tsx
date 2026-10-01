"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import {
  competitionLabel,
  isNationalCompetition,
  orderCompetitions,
  shortSeason,
} from "../competitions";

// Oyuncu profilinde ortak kapsam filtresi (Detailed Stats + Match Log):
// rekabet ve sezon, ikisi de COKLU secim. Bos secim = hepsi.
export type ScopeSelection = {
  competitions: string[]; // bos = tum rekabetler
  seasons: string[]; // bos = tum sezonlar
};

export type ScopeItem = { competition: string | null; season: string | null };

export const EMPTY_SCOPE: ScopeSelection = { competitions: [], seasons: [] };

export function matchesScope(item: ScopeItem, scope: ScopeSelection): boolean {
  if (scope.competitions.length && !scope.competitions.includes(item.competition ?? "")) return false;
  if (scope.seasons.length && !scope.seasons.includes(item.season ?? "")) return false;
  return true;
}

// Chip tiklamasi: bos secimde yalniz tiklanan secilir; doluyken ac/kapat.
// Hepsi secilince ya da hicbiri kalmayinca "hepsi"ne (bos) doner.
function toggle(current: string[], value: string, all: string[]): string[] {
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return next.length === 0 || next.length === all.length ? [] : all.filter((v) => next.includes(v));
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

// empty: diger boyutun seciminde bu chip'in hic maci yok (soluk gosterilir).
const chipClass = (active: boolean, empty = false) =>
  `rounded-lg border px-3 py-1.5 text-[12px] font-medium transition ${
    active
      ? "border-line-strong bg-card-2 text-ink"
      : "border-line bg-veil text-ink-2 hover:text-ink"
  } ${empty && !active ? "opacity-45" : ""}`;

export function ScopeFilter({
  items,
  value,
  onChange,
}: {
  items: ScopeItem[];
  value: ScopeSelection;
  onChange: (next: ScopeSelection) => void;
}) {
  const { t } = useI18n();

  const competitions = useMemo(
    () => orderCompetitions(items.map((i) => i.competition).filter((c): c is string => Boolean(c))),
    [items]
  );
  const seasons = useMemo(
    () =>
      [...new Set(items.map((i) => i.season).filter((s): s is string => Boolean(s)))].sort((a, b) =>
        b.localeCompare(a)
      ),
    [items]
  );

  // Sayaclar diger boyutun secimine gore (secili sezonlarda kac mac var vb.).
  const compCount = (c: string) =>
    items.filter((i) => i.competition === c && matchesScope(i, { competitions: [], seasons: value.seasons })).length;
  const seasonCount = (s: string) =>
    items.filter((i) => i.season === s && matchesScope(i, { competitions: value.competitions, seasons: [] })).length;

  const national = competitions.filter(isNationalCompetition);
  const club = competitions.filter((c) => !isNationalCompetition(c));
  const showTypeChips = national.length > 0 && club.length > 0;

  if (competitions.length <= 1 && seasons.length <= 1) return null;

  return (
    <div className="space-y-2">
      {competitions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
            {t("playerDetail.scopeCompetition")}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, competitions: [] })}
            className={chipClass(value.competitions.length === 0)}
          >
            {t("common.all")}
          </button>
          {showTypeChips ? (
            <>
              <button
                type="button"
                onClick={() => onChange({ ...value, competitions: club })}
                className={chipClass(sameSet(value.competitions, club))}
                title={t("playerDetail.scopeClubHint")}
              >
                {t("playerDetail.scopeClub")}
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, competitions: national })}
                className={chipClass(sameSet(value.competitions, national))}
                title={t("playerDetail.scopeNationalHint")}
              >
                {t("playerDetail.scopeNational")}
              </button>
              <span aria-hidden className="h-5 w-px bg-line" />
            </>
          ) : null}
          {competitions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, competitions: toggle(value.competitions, c, competitions) })}
              className={chipClass(value.competitions.includes(c), compCount(c) === 0)}
              title={c}
            >
              {competitionLabel(t, c)} ({compCount(c)})
            </button>
          ))}
        </div>
      ) : null}

      {seasons.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[86px] shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
            {t("common.season")}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, seasons: [] })}
            className={chipClass(value.seasons.length === 0)}
          >
            {t("common.all")}
          </button>
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...value, seasons: toggle(value.seasons, s, seasons) })}
              className={chipClass(value.seasons.includes(s), seasonCount(s) === 0)}
              title={s}
            >
              {shortSeason(s)} ({seasonCount(s)})
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
