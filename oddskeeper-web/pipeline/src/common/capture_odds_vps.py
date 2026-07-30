# -*- coding: utf-8 -*-
"""VPS oran yakalama harness'i: headful Chromium + TR-geo sticky proxy + ag yakalama.

NEDEN AG YAKALAMA (DOM DEGIL): Bets10 oranlari WebSocket ile guncelleniyor,
arayuz shadow DOM icinde; DOM kazimak kirilgan. Bu harness oranin geldigi ham
kaynagi (WS frame'leri + /sb/ XHR/fetch JSON'lari) CDP ile kaydeder.

NEDEN HEADFUL + XVFB: bet365/Bets10 anti-bot headless Chromium'u yakalar. VPS'te
wrapper `xvfb-run -a` ile sanal ekranda gercek (headful) tarayici acar; bu script
yalnizca headless=False ile baslar.

PROXY (opsiyonel): varsayilan DIREKT (VPS IP'si). Site VPS'in datacenter IP'sini
engellerse `--proxy` ile PROXY_URL (.env, residential) uzerinden gecilir. Proxy GB
basina ucretli oldugu icin once proxysiz denenir; gerekliligi ampirik belirlenir.
Geo, proxy neyse odur; ozel bir ulke ZORUNLU tutulmaz. `.env`'de proxy string'inde
{session} yer tutucusu varsa sticky icin her kosuda sabit id ile degistirilir.

GB TASARRUFU: proxy kullanilirsa tarayicida TUM alt kaynak proxy'den gecer;
image/font/media/stylesheet ve casino/analitik host'lari abort edilir, yalnizca
sportsbook HTML/JS + /sb/ API + WS gecer.

BU ASAMA (SPIKE): parser YOK. Amac ham agi kaydedip oranin XHR JSON'da mi yoksa
WS binary'de mi geldigini + VPS IP'sinin (ya da proxy'nin) engellenip
engellenmedigini gormek. Cikti data/odds/ altina; sonra parse_bets10_network.py.

Kullanim (VPS):
  xvfb-run -a python src/common/capture_odds_vps.py bets10 --chromium-path /usr/bin/chromium
  # +opsiyon: --proxy (PROXY_URL uzerinden)  --pages <etiket>  --per-league N
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

# Proxy'den GECMEYECEK (abort) kaynak tipleri: GB tasarrufu. stylesheet ve
# host bloklamasi KASITLI DAR: fazla agresif abort sportsbook app'ini bozuyordu
# (spike'ta 329 -> 2 response dususu). Yalnizca agir medya + saf analitik.
BLOCK_TYPES = {"image", "media", "font"}
BLOCK_HOSTS = (
    "google-analytics", "googletagmanager", "doubleclick", "hotjar",
    "sentry", "coralogix", "facebook.com", "adform",
)

# Yakaladigimiz XHR/fetch adres desenleri. events-table/v2 = oran tablosu (1X2+
# Alt/Ust, competition basina); event-market = tek market; route-data = yapi.
KEEP_URL_HINTS = ("events-table", "event-market", "route-data", "widgets/event", "/sb/")

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


def proxy_config(session_id: str, country: str | None) -> dict | None:
    """Proxy URL'ini Playwright proxy config'ine cevirir (auth ayri).

    PROXY_ODDS_TR (varsa ozel), yoksa PROXY_URL (genel residential). `country`
    verilirse DataImpulse ulke hedeflemesi username'e eklenir (`__cr.<cc>`).
    AMPIRIK: Bets10 datacenter + coğu geo'yu 403 country-blocked ile engelliyor;
    TR exit IP ile aciliyor (2026-07-30 VPS'te dogrulandi). Bu yuzden Bets10 icin
    --cc tr gerekli. Kod ulkeyi ZORUNLU tutmaz, parametre olarak alir.
    """
    raw = (ENV.get("PROXY_ODDS_TR") or ENV.get("PROXY_URL") or "").strip()
    if not raw:
        return None
    raw = raw.replace("{session}", session_id)
    parts = urlsplit(raw if "://" in raw else "http://" + raw)
    user = unquote(parts.username) if parts.username else ""
    if country and user:
        user = f"{user}__cr.{country}"
    cfg: dict = {"server": f"{parts.scheme}://{parts.hostname}:{parts.port}"}
    if user:
        cfg["username"] = user
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
            detail_wait_ms: int, list_wait_ms: int,
            use_proxy: bool, chromium_path: str | None, country: str | None) -> Path:
    cfg = SITES[site]
    session_id = secrets.token_hex(6)  # sticky: kosu boyunca sabit
    # Varsayilan DIREKT (VPS IP). --proxy verilirse PROXY_URL uzerinden.
    proxy = proxy_config(session_id, country) if use_proxy else None
    print(f"[proxy] {'AKTIF cc=' + (country or 'yok') if proxy else 'yok (direkt VPS IP)'}", flush=True)

    store = {
        "version": 1, "kind": "network-capture", "site": site,
        "sessionId": session_id, "sockets": [], "responses": [], "pages": [],
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    on_ws, on_response = make_recorder(store)

    pages = cfg["pages"]
    if only:
        pages = [p for p in pages if p[0] in only]

    launch_kw: dict = {"headless": not headed}
    if proxy:
        launch_kw["proxy"] = proxy
    if chromium_path:
        launch_kw["executable_path"] = chromium_path  # sistem chromium'u kullan

    with sync_playwright() as pw:
        browser = pw.chromium.launch(**launch_kw)
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
    # events-table/v2 competition sayfasinda tum maclarin 1X2+Alt/Ust'unu verdigi
    # icin detay taramasi VARSAYILAN KAPALI (per-league 0). Daha cok market icin >0.
    ap.add_argument("--per-league", type=int, default=0)
    ap.add_argument("--detail-wait-ms", type=int, default=14000)
    ap.add_argument("--list-wait-ms", type=int, default=22000)  # oran tablosu ~20s'de doluyor
    ap.add_argument("--proxy", action="store_true", help="PROXY_URL uzerinden geç (varsayilan direkt)")
    ap.add_argument("--cc", default=None, help="proxy ulke hedefleme (Bets10 icin: tr)")
    ap.add_argument("--chromium-path", default=None, help="sistem chromium yolu, ör. /usr/bin/chromium")
    args = ap.parse_args()
    capture(args.site, args.headed, Path(args.out), args.pages,
            args.per_league, args.detail_wait_ms, args.list_wait_ms,
            args.proxy, args.chromium_path, args.cc)


if __name__ == "__main__":
    main()
