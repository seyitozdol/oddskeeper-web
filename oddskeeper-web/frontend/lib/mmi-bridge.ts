// MMI koprusu: tarayiciya kurulu kullanici betigiyle (userscript) window.postMessage
// uzerinden konusur. Site hedef sisteme KENDISI istek atmaz; hedef adres ve oturum
// betikte kalir (hedef ic agda, sunucumuz ulasamaz; CORS da sayfaya kapali). Betik
// kurulu degilse ping cevapsiz kalir ve null doner.

export type MmiBridgeResult = { ok: boolean; status: number; body: string; cancelled: boolean };

type BridgeMessage = { source?: string; type?: string; requestId?: string } & Partial<MmiBridgeResult>;

const PING_TIMEOUT_MS = 1000;

function post(msg: Record<string, unknown>) {
  window.postMessage({ source: "pixellious", ...msg }, window.location.origin);
}

function waitFor(match: (d: BridgeMessage) => boolean, timeoutMs?: number): Promise<BridgeMessage | null> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (d: BridgeMessage | null) => {
      window.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
      resolve(d);
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data as BridgeMessage | null;
      if (e.origin !== window.location.origin || !d || d.source !== "tt-bridge" || !match(d)) return;
      done(d);
    };
    window.addEventListener("message", onMessage);
    if (timeoutMs) timer = setTimeout(() => done(null), timeoutMs);
  });
}

/** Dosyayi kopru betigine verir; betik onay sorar, yukler, sonucu dondurur. Betik yoksa null. */
export async function uploadViaMmiBridge(filename: string, data: ArrayBuffer): Promise<MmiBridgeResult | null> {
  const ready = waitFor((d) => d.type === "tt-bridge-ready", PING_TIMEOUT_MS);
  post({ type: "tt-bridge-ping" });
  if (!(await ready)) return null;

  // Sonuc icin sure siniri yok: betigin onay kutusu acik kalabilir, betik kendi zaman
  // asimini uygular ve her durumda bir sonuc dondurur.
  const requestId = crypto.randomUUID();
  const result = waitFor((d) => d.type === "tt-bridge-result" && d.requestId === requestId);
  post({ type: "tt-bridge-upload", requestId, filename, data });
  const r = await result;
  return { ok: !!r?.ok, status: r?.status ?? 0, body: r?.body ?? "", cancelled: !!r?.cancelled };
}
