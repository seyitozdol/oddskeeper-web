"use client";

import { useState } from "react";

// Oyuncu fotografi + kirik-gorsel guvencesi. src yoksa VEYA yukleme hata verirse
// (hotlink/engelleyici) isim bas harfli daireye duser — kirik ikon asla gorunmez.
// referrerPolicy=no-referrer: bazi CDN'ler (SofaScore) referer'a gore engelleyebilir.
export default function PlayerAvatar({
  src, name, size = 28, rounded = "rounded-full", className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size } as const;
  const letter = (name ?? "?").trim().slice(0, 1).toUpperCase() || "?";

  if (!src || failed) {
    return (
      <span
        style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.4)) }}
        className={`inline-flex shrink-0 items-center justify-center ${rounded} bg-veil font-semibold text-ink-3 ${className}`}
      >
        {letter}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={box}
      className={`shrink-0 ${rounded} bg-veil object-cover object-top ${className}`}
    />
  );
}
