# -*- coding: utf-8 -*-
"""VPS oran yakalama harness'i: headful Chromium + TR-geo sticky proxy + ag yakalama.

NEDEN AG YAKALAMA (DOM DEGIL): Bets10 oranlari WebSocket ile guncelleniyor,
arayuz shadow DOM icinde; DOM kazimak kirilgan. Bu harness oranin geldigi ham
kaynagi (WS frame'leri + /sb/ XHR/fetch JSON'lari) CDP ile kaydeder.

NEDEN HEADFUL + XVFB: bet365/Bets10 anti-bot headless Chromium'u ve datacenter
IP'sini yakalar. VPS'te wrapper `xvfb-run -a` ile sanal ekranda gercek (headful)
tarayici acar; bu script yalnizca headless=False ile baslar.

NEDEN TR-GEO STICKY PROXY: Bets10 dogru oranlari yalnizca TR exit IP'ye verir
(yanlis geo = farkli/engelli oran). Sticky session = oturum boyunca ayni IP,
yoksa anti-bot cerezi + WS baglantisi bozulur. DataImpulse'ta username ekiyle:
  PROXY_ODDS_TR = http://<user>__cr.tr;session-<id>:<pass>@gw.dataimpulse.com:823
.env'de {session} yer tutucusu varsa her kosuda yeni sticky id uretilir.

GB TASARRUFU: proxy GB basina ucretli ve tarayicida TUM alt kaynak proxy'den
gecer. image/font/media/stylesheet ve casino/analitik host'lari abort edilir;
yalnizca sportsbook HTML/JS + /sb/ API + WS gecer.

BU ASAMA (SPIKE): parser YOK. Amac ham agi VPS'te (dogru TR geo ile) kaydedip
oranin XHR JSON'da mi yoksa WS binary'de mi geldigini gormek. Cikti dump'i
data/odds/ altina yazilir; incelendikten sonra parse_bets10_network.py yazilir.

Kullanim (VPS):
  xvfb-run -a /opt/oddskeeper/venv/bin/python src/common/capture_odds_vps.py bets10
  # secenekler: --pages <etiket...>  --per-league N  --detail-wait-ms MS  --headed(yerel gorunur)
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from dotenv import dotenv_values
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
DEFAULT_OUT = ROOT / "data" / "odds"

# Proxy'den GECMEYECEK (abort) kaynak tipleri ve host desenleri: GB tasarrufu.
BLOCK_TYPES = {"image", "media", "font", "stylesheet"}
BLOCK_HOSTS = (
    "google-analytics", "googletagmanager", "doubleclick", "adform",
    "hotjar", "sentry", "coralogix", "facebook", "sportradar", "casino",
    "imageapi", "cdn-static",
)

# Yakaladigimiz ilginc XHR/fetch adres desenleri (oran/olay tasiyabilecekler).
KEEP_URL_HINTS = ("/sb/", "/api/", "route-data", "market", "event", "odds")

TAB = "?tab=liveAndUpcoming"
SITES: dict[str, dict] = {
    "bets10": {
        "domain_template": "https://www.{n}bets10.com",
        "domain_start": 10020,
        "domain_tries": 12,
        "probe_path": "/tr/spor-bahisleri/futbol",
        "pages": [
            ("futbol-turkiye-1lig", "/tr/spor-bahisleri/futbol/turkiye/turkiye-1-lig" + TAB),
            ("futbol-avrupa-ligi", "/tr/spor-bahisleri/futbol/uefa-avrupa-ligi/avrupa-ligi" + TAB),
            ("futbol-konferans-ligi", "/tr/spor-bahisleri/futbol/konferans-ligi/konferans-ligi" + TAB),
        ],
    },
    # bet365: TR geo'dan erisilemeyebilir (pazardan cekildi). Spike'ta netlesir.
    "bet365": {"base": "https://www.bet365.com", "probe_path": "/", "pages": [("anasayfa", "/#/AS/B1/")]},
}

MAX_BODY = 800_000        # tek yanit/frame ust siniri (char/byte)
MAX_TOTAL_MB = 60         # dump ust siniri, kacak onlemi


def proxy_config(session_id: str) -> dict | None:
    """PROXY_ODDS_TR URL'ini Playwright proxy config'ine cevirir (auth ayri)."""
    raw = (ENV.get("PROXY_ODDS_TR") or "").strip()
    if not raw:
        return None
    raw = raw.replace("{session}", session_id)
    parts = urlsplit(raw if "://" in raw else "http://" + raw)
    cfg: dict = {"server": f"{parts.scheme}://{parts.hostname}:{parts.port}"}
    if parts.username:
        cfg["username"] = unquote(parts.username)
    if parts.password:
        cfg["password"] = unquote(parts.password)
    return cfg


def resolve_domain(page, cfg: dict) -> str:
    """Bets10 eski adresi guncel adrese yonlendirir; yerlesen url okunur."""
    if "base" in cfg:
        return cfg["base"]
    tpl = cfg["domain_template"]
    for i in range(cfg["domain_tries"]):
        cand = tpl.format(n=cfg["domain_start"] + i)
        try:
            page.goto(cand + cfg["probe_path"], timeout=30000, wait_until="commit")
        except Exception as ex:
            if "ERR_NAME_NOT_RESOLVED" in str(ex) or "SSL" in str(ex):
                continue
        page.wait_for_timeout(6000)
        landed = page.url
        if "bets10" in landed and page.title():
            base = "https://" + landed.split("//", 1)[-1].split("/", 1)[0]
            print(f"[domain] {cand} -> aktif: {base}", flush=True)
            return base
    raise SystemExit("calisan adres bulunamadi")


def make_recorder(store: dict):
    total = {"bytes": 0}

    def cap(text_or_bytes):
        if total["bytes"] >= MAX_TOTAL_MB * 1_000_000:
            return None
        if isinstance(text_or_bytes, bytes):
            clip = text_or_bytes[:MAX_BODY]
            total["bytes"] += len(clip)
            return {"b64": base64.b64encode(clip).decode("ascii"), "byteLength": len(text_or_bytes)}
        s = str(text_or_bytes)[:MAX_BODY]
        total["bytes"] += len(s)
        t = s.lstrip()
        if t.startswith("{") or t.startswith("["):
            try:
                return {"json": json.loads(s)}
            except Exception:
                pass
        return {"raw": s}

    def on_ws(ws):
        url = ws.url
        def rec(payload, direction):
            entry = cap(payload)
            if entry:
                entry.update({"url": url, "dir": direction, "kind": "ws"})
                store["sockets"].append(entry)
        ws.on("framereceived", lambda p: rec(p, "in"))
        ws.on("framesent", lambda p: rec(p, "out"))

    def on_response(resp):
        url = resp.url
        if not any(h in url for h in KEEP_URL_HINTS):
            return
        try:
            body = resp.text()
        except Exception:
            return
        entry = cap(body)
        if entry:
            entry.update({"url": url, "status": resp.status, "kind": "xhr"})
            store["responses"].append(entry)

    return on_ws, on_response


def route_handler(route):
    req = route.request
    url = req.url
    if req.resource_type in BLOCK_TYPES or any(h in url for h in BLOCK_HOSTS):
        try:
            route.abort()
        except Exception:
            pass
        return
    try:
        route.continue_()
    except Exception:
        pass


def match_hrefs(page) -> list[str]:
    """Liste sayfasindan mac detay adreslerini toplar (shadow DOM dahil)."""
    js = r"""() => {
      const out = new Set(); const seen = new Set();
      const walk = (r) => { for (const el of r.querySelectorAll("*")) {
        if (el.tagName === "A") { const h=(el.getAttribute("href")||"").split("?")[0];
          const p=h.split("/").filter(Boolean); const i=p.indexOf("spor-bahisleri");
          if (i>-1 && p.length-i>=5) out.add(h); }
        if (el.shadowRoot && !seen.has(el.shadowRoot)) { seen.add(el.shadowRoot); walk(el.shadowRoot); }
      }};
      walk(document); return Array.from(out);
    }"""
    try:
        return page.evaluate(js)
    except Exception:
        return []


def capture(site: str, headed: bool, out_dir: Path, only, per_league: int,
            detail_wait_ms: int, list_wait_ms: int) -> Path:
    cfg = SITES[site]
    session_id = secrets.token_hex(6)  # sticky: kosu boyunca sabit
    proxy = proxy_config(session_id)
    if not proxy and site == "bets10":
        raise SystemExit("Eksik PROXY_ODDS_TR (.env) - Bets10 TR-geo proxy sart")

    store = {
        "version": 1, "kind": "network-capture", "site": site,
        "sessionId": session_id, "sockets": [], "responses": [], "pages": [],
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    on_ws, on_response = make_recorder(store)

    pages = cfg["pages"]
    if only:
        pages = [p for p in pages if p[0] in only]

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed, proxy=proxy)
        ctx = browser.new_context(
            locale="tr-TR", timezone_id="Europe/Istanbul",
            viewport={"width": 1600, "height": 1000},
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"),
        )
        ctx.route("**/*", route_handler)
        page = ctx.new_page()
        page.on("websocket", on_ws)
        page.on("response", on_response)

        base = resolve_domain(page, cfg)

        for label, path in pages:
            visited: set[str] = set()
            try:
                page.goto(base + path, timeout=45000, wait_until="commit")
            except Exception as ex:
                print(f"[atlandi] {label}: {type(ex).__name__}", flush=True)
                continue
            page.wait_for_timeout(list_wait_ms)
            store["pages"].append({"label": label, "url": page.url})
            print(f"[{label}] ws={len(store['sockets'])} xhr={len(store['responses'])}", flush=True)

            hrefs = [h for h in match_hrefs(page) if h not in visited][:per_league]
            for h in hrefs:
                visited.add(h)
                try:
                    page.goto(base + h, timeout=40000, wait_until="commit")
                    page.wait_for_timeout(detail_wait_ms)
                    store["pages"].append({"label": f"{label}::detay", "url": page.url})
                except Exception:
                    continue
            if hrefs:
                print(f"  {len(hrefs)} detay gezildi -> ws={len(store['sockets'])} xhr={len(store['responses'])}", flush=True)

        browser.close()

    store["dumpedAt"] = datetime.now(timezone.utc).isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    path = out_dir / f"netcap_{site}_{stamp}.json"
    path.write_text(json.dumps(store, ensure_ascii=False), encoding="utf-8")

    ws_json = sum(1 for s in store["sockets"] if "json" in s)
    ws_bin = sum(1 for s in store["sockets"] if "b64" in s)
    xhr_json = sum(1 for r in store["responses"] if "json" in r)
    print(f"\nyazildi: {path}", flush=True)
    print(f"ws frame: {len(store['sockets'])} (json {ws_json}, binary {ws_bin}) | "
          f"xhr: {len(store['responses'])} (json {xhr_json})", flush=True)
    print("SPIKE: bu dump'i incele - oran XHR json'da mi, WS binary'de mi?", flush=True)
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", choices=sorted(SITES))
    ap.add_argument("--headed", action="store_true", help="yerelde gorunur tarayici")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--pages", nargs="*")
    ap.add_argument("--per-league", type=int, default=8)
    ap.add_argument("--detail-wait-ms", type=int, default=9000)
    ap.add_argument("--list-wait-ms", type=int, default=7000)
    args = ap.parse_args()
    capture(args.site, args.headed, Path(args.out), args.pages,
            args.per_league, args.detail_wait_ms, args.list_wait_ms)


if __name__ == "__main__":
    main()
