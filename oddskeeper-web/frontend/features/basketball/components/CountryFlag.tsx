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

function toIso2(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (FIBA_TO_ISO2[c]) return FIBA_TO_ISO2[c];   // FIBA 3-harf veya "UK"
  if (/^[A-Z]{2}$/.test(c)) return c.toLowerCase(); // zaten ISO alpha2 (BSL)
  return null;
}

// Ulke bayragi. Kod yoksa/cozulmezse/yuklenmezse hicbir sey gostermez.
export default function CountryFlag({ code, size = 16, className = "" }: {
  code?: string | null;
  size?: number;       // yukseklik (px); genislik ~4:3
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const iso = code ? toIso2(code) : null;
  if (!iso || failed) return null;
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
