"""[KULLANIMDAN KALKIYOR] Bahis sitesi oran yakalayici (headless, DOM kazima).

VPS uretim yolu artik `capture_odds_vps.py`: headful Chromium + Xvfb, TR-geo
sticky residential proxy, oranin AGDAN (CDP ile WS/XHR) yakalanmasi. Bu dosya
(headless + proxysiz + DOM kazima) yerel/referans amacli tutuluyor; VPS harness'i
uctan uca dogrulaninca kaldirilacak.

--- eski aciklama ---
Tarayici konsoluna elle yapistirilan `pipeline/browser/capture_odds_snippet.js`
ile AYNI cikarim mantigini kullanir: snippet sayfaya enjekte edilir, `okAuto()`
kaydirarak toplar, sonra `window.__okCapture` okunur. Tek dogruluk kaynagi
korunur; snippet degisince bu script de otomatik olarak guncel kalir.

Cikti tarayicidan indirilen dump ile BIREBIR ayni yapida oldugu icin mevcut
zincir degismeden calisir:
    capture_odds_headless.py  ->  dump.json  ->  load_site_odds.py  ->  DB

Kullanim:
    python capture_odds_headless.py bets10
    python capture_odds_headless.py bets10 --headed --pages futbol-turkiye-1lig

Domain rotasyonu: Bets10 adresi periyodik degisiyor (10020bets10.com,
10021bets10.com, ...). Script tabandan baslayip calisan ilk adresi bulur.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SNIPPET_PATH = os.path.normpath(
    os.path.join(HERE, "..", "..", "browser", "capture_odds_snippet.js")
)
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, "..", "..", "data", "odds"))

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)

# Yollar sitenin kendi gezinme adreslerinden alindi (tarayici dump'indaki
# route-data cagrilari ve mac linkleri). tab=liveAndUpcoming yaklasan maclari
# gosteren sekme.
TAB = "?tab=liveAndUpcoming"

SITES: dict[str, dict] = {
    "bets10": {
        "domain_template": "https://www.{n}bets10.com",
        "domain_start": 10020,
        "domain_tries": 12,
        "probe_path": "/tr/spor-bahisleri/futbol",
        "pages": [
            ("futbol-turkiye-1lig", "/tr/spor-bahisleri/futbol/turkiye/turkiye-1-lig" + TAB),
            ("futbol-turkiye", "/tr/spor-bahisleri/futbol/turkiye" + TAB),
            ("futbol-avrupa-ligi", "/tr/spor-bahisleri/futbol/uefa-avrupa-ligi/avrupa-ligi" + TAB),
            ("futbol-konferans-ligi", "/tr/spor-bahisleri/futbol/konferans-ligi/konferans-ligi" + TAB),
            ("futbol-sampiyonlar-ligi", "/tr/spor-bahisleri/futbol/uefa-sampiyonlar-ligi" + TAB),
            ("futbol-dostluk", "/tr/spor-bahisleri/futbol/dostluk-maclari/kulup-maclari" + TAB),
            ("futbol-genel", "/tr/spor-bahisleri/futbol" + TAB),
            ("basketbol", "/tr/spor-bahisleri/basketbol" + TAB),
            ("voleybol", "/tr/spor-bahisleri/voleybol" + TAB),
        ],
    },
    # NOT: bet365 bu calisma ortaminda tarama politikasiyla engelli, buradan
    # denenmedi. Sunucuda calistirmak kullanicinin karari.
    "bet365": {
        "base": "https://www.bet365.com",
        "probe_path": "/",
        "pages": [("futbol-genel", "/#/AS/B1/")],
    },
}


# Liste sayfasindaki mac linkleri: /tr/spor-bahisleri/<spor>/<bolge>/<lig>/<slug>
# (breadcrumb ve menu linkleri daha az segmentli oldugu icin elenir)
MATCH_URL_JS = r"""() => {
  const out = new Set();
  const seen = new Set();
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.tagName === "A") {
        const h = el.getAttribute("href") || "";
        const path = h.split("?")[0];
        const parts = path.split("/").filter(Boolean);
        const i = parts.indexOf("spor-bahisleri");
        if (i > -1 && parts.length - i >= 5) out.add(path);
      }
      if (el.shadowRoot && !seen.has(el.shadowRoot)) {
        seen.add(el.shadowRoot);
        walk(el.shadowRoot);
      }
    }
  };
  walk(document);
  return Array.from(out);
}"""


def load_snippet() -> str:
    with open(SNIPPET_PATH, encoding="utf-8") as f:
        return f.read()


def resolve_domain(page, cfg: dict) -> str:
    """Aktif domaini bulur.

    Bets10 eski adreslere girildiginde guncel adrese YONLENDIRIYOR. Bu
    yonlendirme goto()'yu "Navigation is interrupted by another navigation"
    hatasiyla dusuruyor; hatayi yutup yerlesen adresi okumak dogru sonucu
    veriyor (10021 girildiginde 10022'ye yerlesiyor). Emekli domainler
    ERR_SSL_VERSION_OR_CIPHER_MISMATCH, hic olmayanlar ERR_NAME_NOT_RESOLVED
    veriyor; ikisi de atlanir.
    """
    if "base" in cfg:
        return cfg["base"]
    tpl = cfg["domain_template"]
    for i in range(cfg["domain_tries"]):
        candidate = tpl.format(n=cfg["domain_start"] + i)
        try:
            page.goto(candidate + cfg["probe_path"], timeout=25000, wait_until="commit")
        except Exception as ex:
            msg = str(ex)
            if "ERR_NAME_NOT_RESOLVED" in msg or "SSL" in msg:
                continue
            # yonlendirme kaynakli kesinti: asagida yerlesen adres okunur
        page.wait_for_timeout(6000)
        landed = page.url
        if "bets10" in landed and page.title():
            base = "https://" + landed.split("//", 1)[-1].split("/", 1)[0]
            print(f"[domain] {candidate} -> aktif adres: {base}")
            return base
    raise SystemExit("calisan adres bulunamadi (domain rotasyonu?)")


def capture(
    site: str,
    headed: bool,
    out_dir: str,
    steps: int,
    wait_ms: int,
    only: list[str] | None,
    per_league: int,
    detail_wait_ms: int,
) -> str:
    cfg = SITES[site]
    snippet = load_snippet()
    started_at = datetime.now(timezone.utc).isoformat()
    collected: dict = {"snapshots": [], "captures": [], "sockets": []}
    visited: set[str] = set()

    pages = cfg["pages"]
    if only:
        pages = [p for p in pages if p[0] in only]
        if not pages:
            raise SystemExit(f"--pages ile eslesen sayfa yok: {only}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed)
        ctx = browser.new_context(
            user_agent=UA,
            locale="tr-TR",
            timezone_id="Europe/Istanbul",
            viewport={"width": 1600, "height": 1000},
        )
        page = ctx.new_page()
        base = resolve_domain(page, cfg)

        for label, path in pages:
            url = base + path
            try:
                page.goto(url, timeout=45000, wait_until="domcontentloaded")
            except Exception as ex:
                print(f"[atlandi] {label}: goto: {type(ex).__name__}")
                continue

            # Sportsbook bileseni istemci tarafinda kuruluyor: snippet'i hemen
            # kur (WebSocket'i de yakalasin), sonra icerigin gelmesini bekle.
            try:
                page.evaluate(snippet)
            except Exception as ex:
                print(f"[atlandi] {label}: snippet: {type(ex).__name__}")
                continue
            page.wait_for_timeout(5000)

            try:
                res = page.evaluate(
                    "([l, s, w]) => window.okAuto(l, { steps: s, waitMs: w })",
                    [label, steps, wait_ms],
                )
                print(
                    f"[{label}] link={res.get('anchors')} oranli={res.get('withOdds')}"
                )
            except Exception as ex:
                print(f"[hata] {label}: okAuto: {ex}")
                continue

            try:
                store = page.evaluate("() => window.__okCapture")
            except Exception as ex:
                print(f"[hata] {label}: store okunamadi: {type(ex).__name__}")
                continue
            for key in ("snapshots", "captures", "sockets"):
                collected[key].extend(store.get(key) or [])

            # Liste sayfasi ILERI TARIHLI maclar icin oran gostermiyor (7-10
            # Agustos 1. Lig maclarinda dogrulandi: listede yalnizca takim ve
            # saat var). Oranlar mac detay sayfasinda. Bu yuzden listeden mac
            # adreslerini toplayip her birini ayrica geziyoruz.
            match_urls = page.evaluate(MATCH_URL_JS)
            match_urls = [u for u in match_urls if u not in visited][:per_league]
            for murl in match_urls:
                visited.add(murl)
                full = murl if murl.startswith("http") else base + murl
                try:
                    page.goto(full, timeout=40000, wait_until="commit")
                except Exception:
                    pass
                try:
                    page.evaluate(snippet)
                except Exception:
                    continue
                page.wait_for_timeout(detail_wait_ms)
                try:
                    slug = murl.split("?")[0].rstrip("/").split("/")[-1]
                    page.evaluate("(l) => window.okSnap(l)", f"{label}::{slug}")
                    dstore = page.evaluate("() => window.__okCapture")
                    collected["snapshots"].extend(dstore.get("snapshots") or [])
                except Exception as ex:
                    print(f"  [detay hata] {murl[-40:]}: {type(ex).__name__}")
            if match_urls:
                print(f"  {len(match_urls)} mac detay sayfasi gezildi")

        browser.close()

    collected["version"] = 3
    collected["site"] = base.split("//", 1)[-1].rstrip("/")
    collected["startedAt"] = started_at
    collected["dumpedAt"] = datetime.now(timezone.utc).isoformat()
    collected["capturedBy"] = "capture_odds_headless.py"

    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    path = os.path.join(out_dir, f"odds_{site}_{stamp}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(collected, f, ensure_ascii=False)

    n_odds = sum(
        1
        for s in collected["snapshots"]
        for a in s.get("anchors", [])
        if "Maç Sonucu" in (a.get("text") or "")
    )
    print(
        f"\nyazildi: {path}\n"
        f"{len(collected['snapshots'])} snapshot, oranli satir: {n_odds}"
    )
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", choices=sorted(SITES))
    ap.add_argument("--headed", action="store_true", help="tarayiciyi gorunur ac")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--steps", type=int, default=14)
    ap.add_argument("--wait-ms", type=int, default=800)
    ap.add_argument("--pages", nargs="*", help="yalnizca bu etiketleri gez")
    ap.add_argument(
        "--per-league", type=int, default=15, help="lig basina gezilecek mac sayisi"
    )
    ap.add_argument("--detail-wait-ms", type=int, default=9000)
    ap.add_argument(
        "--load", action="store_true", help="yakalamadan sonra veritabanina yukle"
    )
    args = ap.parse_args()
    path = capture(
        args.site,
        args.headed,
        args.out,
        args.steps,
        args.wait_ms,
        args.pages,
        args.per_league,
        args.detail_wait_ms,
    )
    if args.load:
        import subprocess
        import sys as _sys

        loader = os.path.join(HERE, "load_site_odds.py")
        print("\n--- yukleniyor ---")
        subprocess.run([_sys.executable, loader, path], check=False)


if __name__ == "__main__":
    main()
