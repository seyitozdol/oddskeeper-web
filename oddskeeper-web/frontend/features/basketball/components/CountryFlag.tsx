"use client";

import { useState } from "react";

// FIBA/IOC 3-harfli kod (EuroLeague API) -> ISO alpha2 (flagcdn). BSL zaten alpha2.
const FIBA_TO_ISO2: Record<string, string> = {
  ANG: "ao", ARG: "ar", AUS: "au", AUT: "at", BAH: "bs", BEL: "be", BIH: "ba",
  BRA: "br", BUL: "bg", CAN: "ca", CHI: "cl", CMR: "cm", COL: "co", CPV: "cv",
  CRO: "hr", CUB: "cu", CZE: "cz", DEN: "dk", DOM: "do", ENG: "gb-eng", ESP: "es",
  EST: "ee", FIN: "fi", FRA: "fr", GAB: "ga", GBR: "gb", GEO: "ge", GER: "de",
  GHA: "gh", GRE: "gr", GUI: "gn", HUN: "hu", IRL: "ie", ISR: "il", ITA: "it",
  IVO: "ci", LAT: "lv", LTU: "lt", MKD: "mk", MLI: "ml", MNE: "me", NED: "nl",
  NGR: "ng", PAN: "pa", POL: "pl", ROU: "ro", SEN: "sn", SLO: "si", SRB: "rs",
  SSD: "ss", SWE: "se", TUR: "tr", UK: "gb", UKR: "ua", USA: "us",
};

export function toIso2(code?: string | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (FIBA_TO_ISO2[c]) return FIBA_TO_ISO2[c];   // FIBA 3-harf veya "UK"
  if (/^[A-Z]{2}$/.test(c)) return c.toLowerCase(); // zaten ISO alpha2 (BSL)
  return null;
}

function FlagImg({ iso, size, className }: { iso: string; size: number; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const w = Math.round(size * 4 / 3);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      alt={iso.toUpperCase()}
      title={iso.toUpperCase()}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: w, height: size }}
      className={`inline-block shrink-0 rounded-[2px] object-cover ${className}`}
    />
  );
}

// Tek bayrak.
export default function CountryFlag({ code, size = 16, className = "" }: {
  code?: string | null; size?: number; className?: string;
}) {
  const iso = toIso2(code);
  if (!iso) return null;
  return <FlagImg iso={iso} size={size} className={className} />;
}

// Coklu bayrak (cift vatandaslik): kodlar ISO2'ye cevrilir, TEKILLESTIRILIR, yan yana.
export function CountryFlags({ codes, size = 16, className = "" }: {
  codes: (string | null | undefined)[]; size?: number; className?: string;
}) {
  const seen = new Set<string>();
  const isos: string[] = [];
  for (const c of codes) {
    const iso = toIso2(c);
    if (iso && !seen.has(iso)) { seen.add(iso); isos.push(iso); }
  }
  if (isos.length === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {isos.map((iso) => <FlagImg key={iso} iso={iso} size={size} className={className} />)}
    </span>
  );
}
