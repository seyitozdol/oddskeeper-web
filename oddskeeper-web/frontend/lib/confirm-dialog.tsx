"use client";

import { useEffect, useState } from "react";

// In-site (uygulama içi) onay kutusu. Native window.confirm yerine kullanılır:
// tarayıcının "www.site.com diyor ki" popup'ı çirkin. confirmDialog(message)
// bir Promise<boolean> döner; <ConfirmDialogHost/> (bir kez, dashboard layout'ta
// mount edilir) modalı çizer. Modül-seviyesi kontrolör: her yerden (hook
// olmadan) çağrılabilir.

type Pending = { message: string; resolve: (v: boolean) => void };
let pending: Pending | null = null;
let notify: (() => void) | null = null;

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Zaten açık bir kutu varsa onu iptal say (çakışmayı önle).
    if (pending) pending.resolve(false);
    pending = { message, resolve };
    notify?.();
  });
}

export function ConfirmDialogHost() {
  const [, force] = useState(0);
  useEffect(() => {
    notify = () => force((n) => n + 1);
    return () => {
      notify = null;
    };
  }, []);

  if (!pending) return null;
  const p = pending;
  const close = (v: boolean) => {
    p.resolve(v);
    pending = null;
    force((n) => n + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm leading-relaxed text-ink">{p.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-md border border-line bg-field px-3.5 py-1.5 text-sm font-medium text-ink-2 transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
