/* Oran yakalayici v3 (Bets10 / bet365 ve benzeri siteler icin)
 *
 * NEDEN v3: v2 WebSocket frame'lerini yakaladi (Bets10'da 2108 frame) ama
 * iki sorun cikti:
 *   1) Bets10 oranlari Diffusion protokolu ile SIKISTIRILMIS BINARY olarak
 *      gonderiyor. v2 bunlari TextDecoder ile metne cevirdigi icin baytlar
 *      bozuldu ve geri donusu olmayan sekilde kayboldu. v3 binary frame'leri
 *      base64 olarak saklar.
 *   2) Frame topic yollarinda mac kimligi ve market kodu OKUNABILIR
 *      (obg/sportsbook/transient/markets/f-<eventId>/m-f-<eventId>-MW3W) ama
 *      TAKIM ADI hicbir yerde yok, o da sikistirilmis govdede. Takim adi
 *      olmadan bizim SofaScore maclarimizla eslestirme yapilamiyor.
 *
 * COZUM: protokolu cozmeye ugrasmak yerine EKRANDAKI TABLOYU da kaydediyoruz.
 * Oranlar ekranda goruntulendigi icin DOM anlik goruntusu takim adi + market
 * adi + oran degerini dogrudan veriyor. Frame'ler yedek/dogrulama olarak
 * yine toplanir.
 *
 * MARKET KODLARI (Bets10, cozuldu): MW3W=1X2 (futbol 3 yollu),
 * MW2W=1-2 (basketbol/voleybol 2 yollu), TPOU-<n>=toplam sayi alt/ust,
 * MTG2W-<n>=toplam gol alt/ust, ESFMWINNER3W=e-spor 3 yollu.
 *
 * ============================ KULLANIM ============================
 * 0. Chrome konsolu ilk kez yapistirmaya izin vermez. Konsola once
 *       allow pasting
 *    yazip Enter'a bas (bet365'te alinan "okDump is not defined" hatasinin
 *    en olasi sebebi buydu: snippet hic calismamis).
 * 1. Siteyi ac. Snippet'i sayfa gelir gelmez yapistir (WebSocket sayfa
 *    yuklenirken kuruluyor, sonradan yakalanamaz).
 * 2. F12 -> Console -> bu dosyanin tamamini yapistir -> Enter.
 *    "capture aktif v3" gormen gerekiyor.
 * 3. Sayfayi YENILEME. Sitenin menusunden gez.
 * 4. HER SAYFADA, oran listesi ekranda gorunurken:
 *       okSnap('futbol-turkiye-1lig')
 *    yaz. Etiket serbest, ne gezdigini anlamama yardim ediyor. Mac detay
 *    sayfalarinda da cagir, diger marketler oralarda aciliyor.
 * 5. okStats() ile kontrol et, sonra okDump() ile indir.
 *
 * Komutlar:
 *   okSnap(etiket) -> ekrandaki tablonun anlik goruntusunu al  <-- EN ONEMLISI
 *   okStats()      -> durum ozeti
 *   okPeek(n)      -> son n frame'in basi
 *   okClear()      -> sifirla
 *   okDump()       -> indir
 */
(() => {
  if (window.__okCapture) {
    console.log("[oddskeeper] capture zaten aktif. okStats() ile bak.");
    return;
  }

  const store = {
    version: 3,
    site: location.hostname,
    startedAt: new Date().toISOString(),
    captures: [], // fetch + xhr
    sockets: [], // websocket + sse
    snapshots: [], // DOM anlik goruntuleri
  };
  window.__okCapture = store;

  const SKIP =
    /(analytics|telemetry|\/collect|gtm|fraud|waf|sentry|coralogix|adform|hotjar|\.js$|\.css$|\.svg$|\.png$|\.jpg$|\.woff)/i;
  const MAX_HTTP = 3000;
  const MAX_WS = 25000;
  const MAX_BODY_CHARS = 1_000_000;
  const MAX_FRAME_CHARS = 200_000;
  const MAX_SNAP_CHARS = 400_000;
  const MAX_WS_BYTES = 40_000_000;
  let wsBytes = 0;

  const bytesToB64 = (bytes) => {
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunk)
      );
    }
    return btoa(bin);
  };

  /* ------------------------------------------------------------------ *
   * Komutlar ONCE tanimlanir. Boylece asagidaki hook kurulumlarindan
   * biri sitede patlasa bile okDump/okSnap tanimli kalir.
   * ------------------------------------------------------------------ */

  const pathOf = (u) => {
    try {
      const x = new URL(u, location.origin);
      return x.host + x.pathname;
    } catch {
      return String(u);
    }
  };

  window.okSnap = (label, opts) => {
    const silent = !!(opts && opts.silent);
    const anchors = [];
    const shadowTexts = [];
    const seen = new Set();
    let count = 0;

    const visit = (root) => {
      let els;
      try {
        els = root.querySelectorAll("*");
      } catch {
        return;
      }
      for (const el of els) {
        count++;
        if (count > 60000) break;
        if (el.tagName === "A") {
          const href = el.getAttribute("href");
          if (href) {
            // Bets10'da mac satirinin TAMAMI (takim, saat, market, oranlar)
            // link metninin icinde. 160 karakter kesiyordu, genis tutuyoruz.
            anchors.push({
              href,
              text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 800),
            });
          }
        }
        if (el.shadowRoot && !seen.has(el.shadowRoot)) {
          seen.add(el.shadowRoot);
          try {
            // textContent <style> iceriklerini de aliyor ve CSS tum butceyi
            // yiyordu (Bets10'da 20000 karakterin hepsi CSS'ti). innerText
            // style/script'i atlar ve satir yapisini korur.
            let t = "";
            for (const child of el.shadowRoot.children) {
              const tag = child.tagName;
              if (tag === "STYLE" || tag === "SCRIPT" || tag === "TEMPLATE") {
                continue;
              }
              // SADECE innerText. textContent'e dusmek yok: ic ice <style>
              // varsa textContent CSS'i geri getiriyor (Bets10'da 20 KB CSS
              // butceyi yiyordu). innerText bossa o blok zaten bize yaramaz.
              t += (child.innerText || "") + "\n";
            }
            t = t.replace(/[ \t]+/g, " ").trim();
            if (t.length > 40) {
              shadowTexts.push({
                host: el.tagName.toLowerCase(),
                text: t.slice(0, 80000),
              });
            }
          } catch {}
          visit(el.shadowRoot);
        }
      }
    };
    visit(document);

    let bodyText = "";
    try {
      bodyText = (document.body.innerText || "").slice(0, MAX_SNAP_CHARS);
    } catch {}

    const snap = {
      label: label || null,
      url: location.href,
      at: new Date().toISOString(),
      title: document.title,
      bodyText,
      anchors: anchors.slice(0, 4000),
      shadowTexts: shadowTexts.slice(0, 400),
    };
    store.snapshots.push(snap);
    // Oranlar bet365'te bodyText'te, Bets10'da shadow bloklarinda ve link
    // metinlerinde; ucunu birden say.
    const allText =
      bodyText +
      "\n" +
      shadowTexts.map((s) => s.text).join("\n") +
      "\n" +
      anchors.map((a) => a.text).join("\n");
    const oddsLike = (allText.match(/\b\d+\.\d{2}\b/g) || []).length;
    if (!silent) {
      console.log(
        `[oddskeeper] snapshot alindi${label ? " (" + label + ")" : ""}: ` +
          `${bodyText.length} char body, ${shadowTexts.length} shadow blok ` +
          `(${shadowTexts.reduce((n, s) => n + s.text.length, 0)} char), ` +
          `${anchors.length} link, oran benzeri sayi: ${oddsLike}`
      );
    }
    if (oddsLike === 0 && !silent) {
      console.warn(
        "[oddskeeper] hic oran benzeri sayi bulunamadi. Oran listesi ekranda " +
          "gorunuyor mu? Liste sanal kaydirmali olabilir; sayfayi asagi kaydirip " +
          "her bolumde tekrar okSnap() cagir."
      );
    }
    return {
      body: bodyText.length,
      shadow: shadowTexts.length,
      anchors: anchors.length,
      oddsLike,
    };
  };

  // Sanal kaydirmali listeler icin: sayfayi kademeli kaydirip her adimda
  // toplar, sonunda TEK birlesik snapshot yazar. Bets10'da liste sayfa basina
  // ~5 satir render ediyor, elle kaydirmadan geri kalani DOM'a hic gelmiyor.
  window.okAuto = async (label, opts) => {
    const steps = (opts && opts.steps) || 14;
    const waitMs = (opts && opts.waitMs) || 800;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Kaydirilabilir kapsayicilari bul (pencere olmayabilir; shadow DOM
    // uygulamalari kendi scroller'ini kullaniyor).
    const scrollers = [];
    const seenRoots = new Set();
    const findScrollers = (root) => {
      let els;
      try {
        els = root.querySelectorAll("*");
      } catch {
        return;
      }
      for (const el of els) {
        try {
          if (el.scrollHeight - el.clientHeight > 400) scrollers.push(el);
        } catch {}
        if (el.shadowRoot && !seenRoots.has(el.shadowRoot)) {
          seenRoots.add(el.shadowRoot);
          findScrollers(el.shadowRoot);
        }
      }
    };
    findScrollers(document);
    scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight);
    // Tek bir kapsayici secip tahmin yurutmuyoruz: yanlis secersek hicbir sey
    // kaydirilmaz ve okAuto sessizce ise yaramaz olur. Aday kapsayicilarin
    // HEPSI ve pencere birlikte kaydirilir.
    const targets = scrollers.slice(0, 6);

    const byHref = new Map();
    const collect = () => {
      const snap = window.okSnap(null, { silent: true });
      const last = store.snapshots.pop(); // gecici snapshot'i geri al
      if (!last) return;
      for (const a of last.anchors) {
        // Ayni href'in en UZUN metnini tut: kisa olan cogu zaman oransiz stub
        const prev = byHref.get(a.href);
        if (!prev || a.text.length > prev.text.length) byHref.set(a.href, a);
      }
      return last;
    };

    let lastSnap = collect();

    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      for (const el of targets) {
        try {
          el.scrollTop = (el.scrollHeight - el.clientHeight) * frac;
        } catch {}
      }
      try {
        window.scrollTo(
          0,
          (document.documentElement.scrollHeight - window.innerHeight) * frac
        );
      } catch {}
      await sleep(waitMs);
      const s = collect();
      if (s) lastSnap = s;
    }
    for (const el of targets) {
      try {
        el.scrollTop = 0;
      } catch {}
    }
    try {
      window.scrollTo(0, 0);
    } catch {}

    const merged = {
      ...lastSnap,
      label: label || null,
      anchors: Array.from(byHref.values()),
      mergedFromScroll: steps + 1,
    };
    store.snapshots.push(merged);
    const withOdds = merged.anchors.filter((a) =>
      /\d+\.\d{2}/.test(a.text)
    ).length;
    console.log(
      `[oddskeeper] okAuto bitti${label ? " (" + label + ")" : ""}: ` +
        `${steps + 1} kaydirma adimi, ${targets.length} kapsayici + pencere, ` +
        `${merged.anchors.length} benzersiz link, ` +
        `bunlarin ${withOdds} tanesinde oran var`
    );
    if (withOdds === 0) {
      console.warn(
        "[oddskeeper] hic oranli satir yok. Sayfada mac listesi acik mi? " +
          "Sekme 'Canli ve Yaklasan' olmali."
      );
    }
    return { anchors: merged.anchors.length, withOdds };
  };

  window.okStats = () => {
    const httpOk = store.captures.filter((c) => c.status === 200).length;
    const framesIn = store.sockets.filter((s) => s.dir === "in").length;
    const bin = store.sockets.filter((s) => s.b64 !== undefined).length;
    console.log(
      `[oddskeeper] snapshot: ${store.snapshots.length} | ` +
        `http: ${store.captures.length} (200: ${httpOk}) | ` +
        `frame: ${store.sockets.length} (gelen ${framesIn}, binary ${bin}) | ` +
        `~${Math.round(wsBytes / 1024)} KB`
    );
    if (store.snapshots.length === 0) {
      console.warn(
        "HIC SNAPSHOT YOK. En onemli veri bu. Oran listesi ekrandayken okSnap('etiket') cagir."
      );
    } else {
      console.table(
        store.snapshots.map((s) => ({
          label: s.label,
          textChars: s.bodyText.length,
          anchors: s.anchors.length,
          url: s.url.slice(0, 70),
        }))
      );
    }
    const byWs = {};
    for (const s of store.sockets) {
      const k = pathOf(s.url);
      byWs[k] = (byWs[k] || 0) + 1;
    }
    if (Object.keys(byWs).length) console.table(
      Object.entries(byWs).sort((a, b) => b[1] - a[1]).map(([url, n]) => ({ url, frames: n }))
    );
    return {
      snapshots: store.snapshots.length,
      http: store.captures.length,
      frames: store.sockets.length,
    };
  };

  window.okPeek = (n = 5) => {
    for (const s of store.sockets.slice(-n)) {
      const t =
        s.raw !== undefined
          ? s.raw
          : s.b64 !== undefined
            ? "<binary b64 " + s.b64.length + " char>"
            : JSON.stringify(s.body);
      console.log(`[${s.dir}] ${pathOf(s.url)}`, String(t).slice(0, 300));
    }
    return store.sockets.length;
  };

  window.okClear = () => {
    store.captures.length = 0;
    store.sockets.length = 0;
    store.snapshots.length = 0;
    wsBytes = 0;
    console.log("[oddskeeper] sifirlandi");
  };

  window.okDump = (name, force) => {
    const total =
      store.captures.length + store.sockets.length + store.snapshots.length;
    if (total === 0) {
      console.warn("[oddskeeper] hic kayit yok.");
      return;
    }
    if (store.snapshots.length === 0 && force !== true) {
      console.warn(
        "[oddskeeper] hic snapshot yok, en kritik veri o. Oran listesi " +
          "ekrandayken okSnap('etiket') cagirip tekrar dene. " +
          "Yine de indirmek icin: okDump('ad.json', true)"
      );
      return;
    }
    store.dumpedAt = new Date().toISOString();
    const stamp = store.dumpedAt.replace(/[:.]/g, "-").slice(0, 19);
    const host = location.hostname.replace(/[^a-z0-9]+/gi, "-");
    const filename = name || `odds_${host}_${stamp}.json`;
    const blob = new Blob([JSON.stringify(store)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    console.log(
      `[oddskeeper] ${store.snapshots.length} snapshot + ${store.captures.length} http + ` +
        `${store.sockets.length} frame -> ${filename}`
    );
    return filename;
  };

  /* ------------------------------------------------------------------ *
   * Hook kurulumlari. Her biri ayri try/catch; biri patlarsa digerleri
   * ve yukaridaki komutlar calismaya devam eder.
   * ------------------------------------------------------------------ */

  const recordHttp = (url, status, text, kind) => {
    if (store.captures.length >= MAX_HTTP) return;
    if (!text || text.length > MAX_BODY_CHARS) return;
    const entry = { url: String(url), status, kind, at: new Date().toISOString() };
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        entry.body = JSON.parse(text);
      } catch {
        entry.raw = text;
      }
    } else {
      entry.raw = text;
    }
    store.captures.push(entry);
  };

  const pushFrame = (url, dir, kind, payload) => {
    if (store.sockets.length >= MAX_WS || wsBytes >= MAX_WS_BYTES) return;
    const entry = { url: String(url), dir, kind, at: new Date().toISOString() };
    Object.assign(entry, payload);
    wsBytes += (payload.raw || payload.b64 || "").length || 200;
    store.sockets.push(entry);
  };

  const recordFrame = (url, data, dir, kind) => {
    if (store.sockets.length >= MAX_WS || wsBytes >= MAX_WS_BYTES) return;
    if (typeof data === "string") {
      const clipped =
        data.length > MAX_FRAME_CHARS ? data.slice(0, MAX_FRAME_CHARS) : data;
      const trimmed = clipped.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          pushFrame(url, dir, kind, { body: JSON.parse(clipped) });
          return;
        } catch {}
      }
      pushFrame(url, dir, kind, { raw: clipped });
      return;
    }
    // Binary: base64 sakla, TextDecoder KULLANMA (bayt kaybi olur)
    const handleBuf = (buf) => {
      try {
        const bytes = new Uint8Array(buf);
        const clipped =
          bytes.length > MAX_FRAME_CHARS ? bytes.subarray(0, MAX_FRAME_CHARS) : bytes;
        pushFrame(url, dir, kind, {
          b64: bytesToB64(clipped),
          byteLength: bytes.length,
        });
      } catch {}
    };
    if (data instanceof ArrayBuffer) handleBuf(data);
    else if (data instanceof Blob) data.arrayBuffer().then(handleBuf).catch(() => {});
    else if (data && data.buffer instanceof ArrayBuffer) handleBuf(data.buffer);
  };

  try {
    const origFetch = window.fetch;
    window.fetch = function (...args) {
      const promise = origFetch.apply(this, args);
      try {
        const input = args[0];
        const url =
          typeof input === "string" ? input : input && input.url ? input.url : "";
        if (url && !SKIP.test(url)) {
          promise
            .then((resp) => {
              resp
                .clone()
                .text()
                .then((t) => recordHttp(url, resp.status, t, "fetch"))
                .catch(() => {});
            })
            .catch(() => {});
        }
      } catch {}
      return promise;
    };
  } catch (e) {
    console.warn("[oddskeeper] fetch hook kurulamadi:", e);
  }

  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__okUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      try {
        this.addEventListener("load", () => {
          try {
            if (this.__okUrl && !SKIP.test(this.__okUrl)) {
              recordHttp(this.__okUrl, this.status, this.responseText, "xhr");
            }
          } catch {}
        });
      } catch {}
      return origSend.apply(this, args);
    };
  } catch (e) {
    console.warn("[oddskeeper] xhr hook kurulamadi:", e);
  }

  try {
    const OrigWS = window.WebSocket;
    if (OrigWS) {
      class OkWebSocket extends OrigWS {
        constructor(...args) {
          super(...args);
          const url = args[0];
          try {
            this.addEventListener("message", (ev) =>
              recordFrame(url, ev.data, "in", "ws")
            );
            const origSendWs = this.send.bind(this);
            this.send = (payload) => {
              try {
                recordFrame(url, payload, "out", "ws");
              } catch {}
              return origSendWs(payload);
            };
          } catch {}
        }
      }
      for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
        try {
          Object.defineProperty(OkWebSocket, k, { value: OrigWS[k] });
        } catch {}
      }
      window.WebSocket = OkWebSocket;
    }
  } catch (e) {
    console.warn("[oddskeeper] websocket hook kurulamadi:", e);
  }

  try {
    const OrigES = window.EventSource;
    if (OrigES) {
      class OkEventSource extends OrigES {
        constructor(...args) {
          super(...args);
          const url = args[0];
          try {
            this.addEventListener("message", (ev) =>
              recordFrame(url, ev.data, "in", "sse")
            );
          } catch {}
        }
      }
      window.EventSource = OkEventSource;
    }
  } catch (e) {
    console.warn("[oddskeeper] eventsource hook kurulamadi:", e);
  }

  console.log(
    "[oddskeeper] capture aktif v3 (snapshot + fetch + xhr + websocket + sse).\n" +
      "EN ONEMLI ADIM: her sayfada oran listesi ekrandayken okSnap('etiket') cagir.\n" +
      "Durum: okStats()   Indir: okDump()"
  );
})();
