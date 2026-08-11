"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Bayat sekme koruması. Sekmenin çalıştırdığı JS bundle'ın build kimliği
// (NEXT_PUBLIC_BUILD_ID, build anında gömülür) ile canlı deployment kimliğini
// (/api/version) karşılaştırır. Fark varsa yeni bir deploy yayınlanmış demektir
// ve bu sekme eski kodu çalıştırıyordur -> kullanıcıya "yenile" banner'ı gösterir.
// Otomatik reload YAPMAZ: kullanıcı bir editörde düzenleme ortasında olabilir,
// kaydedilmemiş veriyi kaybettirmeyiz; yenilemeyi kullanıcı tetikler.

const BUILT = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_MS = 5 * 60 * 1000; // 5 dk periyodik + focus/visibility/online tetikleri

export function VersionGuard() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checking = useRef(false);

  const check = useCallback(async () => {
    // Lokal/dev'de kimlik "dev" -> hiç tetikleme (yanlış pozitif olmasın).
    if (BUILT === "dev" || stale || checking.current) return;
    checking.current = true;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (version && version !== "dev" && version !== BUILT) {
        setStale(true);
      }
    } catch {
      // Ağ hatası: sessiz geç, sonraki tetikte tekrar denenir.
    } finally {
      checking.current = false;
    }
  }, [stale]);

  useEffect(() => {
    if (BUILT === "dev") return; // dev'de guard tamamen pasif
    check();
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [check]);

  if (!stale || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-xl">
        <div className="min-w-0 flex-1 text-sm text-ink">
          <span className="font-semibold">Yeni sürüm yayınlandı.</span>{" "}
          <span className="text-ink-2">
            Bu sekme eski sürümü çalıştırıyor; kayıt işlemleri başarısız olabilir.
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Yenile
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Kapat"
          className="shrink-0 rounded-md border border-line bg-field px-2 py-1.5 text-sm text-ink-2 transition hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
