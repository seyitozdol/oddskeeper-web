"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n/LanguageProvider";
import { TSL_BASE_PATH, TSL_DEFAULT_SEASON, type TslDesign } from "../constants";

type DesignCard = {
  key: TslDesign;
  accent: string; // token bg for the accent strip / dot
  ring: string;
  Preview: () => React.ReactElement;
};

type CardKey = TslDesign | "resmi";

const CARDS: (Omit<DesignCard, "key"> & { key: CardKey })[] = [
  { key: "resmi", accent: "bg-accent", ring: "group-hover:border-accent/50", Preview: ResmiPreview },
  { key: "sahne", accent: "bg-accent", ring: "group-hover:border-accent/50", Preview: SahnePreview },
  { key: "radar", accent: "bg-pos", ring: "group-hover:border-pos/50", Preview: RadarPreview },
  { key: "panel", accent: "bg-ink-2", ring: "group-hover:border-line-strong", Preview: PanelPreview },
];

function hrefFor(d: CardKey) {
  return `${TSL_BASE_PATH}/${d}?season=${encodeURIComponent(TSL_DEFAULT_SEASON)}&section=league`;
}

export default function TslHub() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-sm font-black tracking-tight text-accent-ink">
            TSL
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {t("tsl.hubKicker")}
            </p>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pos" />
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
                {t("tsl.live")}
              </span>
            </div>
          </div>
        </div>
        <h1 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight text-ink lg:text-[28px]">
          {t("tsl.hubTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          {t("tsl.hubSubtitle")}
        </p>
      </motion.div>

      {/* Tasarim kartlari */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card, i) => {
          const Preview = card.Preview;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 * (i + 1) }}
            >
              <Link href={hrefFor(card.key)} className="group block h-full">
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card transition ${card.ring}`}
                >
                  {/* Preview alani */}
                  <div className="relative h-40 overflow-hidden border-b border-line bg-canvas p-4">
                    <div className={`absolute left-0 top-0 h-1 w-full ${card.accent}`} />
                    <Preview />
                  </div>

                  {/* Metin */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${card.accent}`} />
                      <h2 className="text-[17px] font-semibold text-ink">
                        {t(`tsl.${card.key}Name`)}
                      </h2>
                      <span className="rounded-md bg-veil px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                        {t(`tsl.${card.key}Tag`)}
                      </span>
                    </div>
                    <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-ink-2">
                      {t(`tsl.${card.key}Desc`)}
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink">
                      {t("tsl.open")}
                      <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-6 text-[12px] text-ink-3">{t("tsl.hubHint")}</p>
    </div>
  );
}

/* ---- Mini onizlemeler (semantik degil, tasarim karakteri) ---- */

function ResmiPreview() {
  const rows = [
    { n: "GS", w: 96 },
    { n: "FB", w: 90 },
    { n: "TS", w: 74 },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/leagues/super-lig.png" alt="" className="tsl-league-mark h-6 w-6 object-contain" />
        <span className="text-[11px] font-bold text-ink">Trendyol Süper Lig</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/flags/tr.png" alt="" className="ml-auto h-4 w-4 rounded-full object-cover" />
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 text-[9px] font-bold tabular-nums text-ink-3">{i + 1}</span>
            <span className="h-4 w-4 rounded-full bg-veil text-[7px] leading-4 text-ink-3 text-center">{r.n}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-veil">
              <div className="h-full rounded-full bg-accent" style={{ width: `${r.w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SahnePreview() {
  const rows = [
    { w: 96, pts: 77 },
    { w: 78, pts: 71 },
    { w: 70, pts: 65 },
    { w: 54, pts: 52 },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 text-[9px] font-bold tabular-nums text-ink-3">{i + 1}</span>
          <span className="h-4 w-4 rounded-full bg-veil" />
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-veil">
            <div className="h-full rounded-full bg-accent" style={{ width: `${r.w}%` }} />
          </div>
          <span className="w-5 text-right text-[9px] font-bold tabular-nums text-ink-2">{r.pts}</span>
        </div>
      ))}
    </div>
  );
}

function RadarPreview() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--veil)" strokeWidth="4" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke="var(--pos)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray="94.2" strokeDashoffset="18"
          />
        </svg>
        <span className="absolute text-[13px] font-bold text-ink">7.4</span>
      </div>
      <div className="flex-1 space-y-1.5">
        {[85, 62, 74].map((p, i) => (
          <div key={i} className="space-y-0.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-veil">
              <div className="h-full rounded-full bg-pos" style={{ width: `${p}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelPreview() {
  const bars = [40, 65, 52, 88, 70, 48, 60];
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="grid grid-cols-3 gap-1.5">
        {["18", "306", "2.7"].map((v, i) => (
          <div key={i} className="rounded-lg bg-card-2 px-2 py-1.5">
            <div className="text-[13px] font-bold tabular-nums text-ink">{v}</div>
            <div className="h-1 w-6 rounded-full bg-veil" />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-sm bg-ink-2/70" style={{ height: `${b * 0.4}px` }} />
        ))}
      </div>
    </div>
  );
}
