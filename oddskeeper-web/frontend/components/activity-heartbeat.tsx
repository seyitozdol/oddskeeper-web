"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Kullanici aktivite heartbeat'i: /api/activity/ping'e kisitli araliklarla vurur
// (sayfa gezinme + sekme odaklanma). "Last Used" ve admin aktiflik grafigi bunu
// okur. Login olup logout olmayan kullanicinin sitede dolasmasi da boyle gorunur.
const MIN_INTERVAL_MS = 3 * 60 * 1000; // en fazla 3 dk'da bir
let lastPing = 0;

function ping() {
  const now = Date.now();
  if (now - lastPing < MIN_INTERVAL_MS) return;
  lastPing = now;
  fetch("/api/activity/ping", { method: "POST", keepalive: true }).catch(() => {});
}

export default function ActivityHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    ping();
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
