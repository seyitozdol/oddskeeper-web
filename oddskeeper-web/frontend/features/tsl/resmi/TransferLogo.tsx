"use client";

import { useState } from "react";

// Transfer kulüp logosu Transfermarkt CDN'inden (tmssl.akamaized.net) gelir.
// CDN erişilemezse (503/504) kırık-resim ikonu yerine sessizce gizle; kulüp adı
// zaten yanında yazıyor. CDN toparlayınca logo kendiliğinden geri gelir.
export default function TransferLogo({
  logo,
  name,
}: {
  logo: string | null;
  name: string | null;
}) {
  const [broken, setBroken] = useState(false);
  if (!logo || broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name ?? ""}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-3.5 w-3.5 shrink-0 object-contain"
      loading="lazy"
    />
  );
}
