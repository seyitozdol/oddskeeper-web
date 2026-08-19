# -*- coding: utf-8 -*-
"""VPS oran yakalama harness'i: headful Chromium + TR-geo sticky proxy + ag yakalama.

NEDEN AG YAKALAMA (DOM DEGIL): Bets10 oranlari WebSocket ile guncelleniyor,
arayuz shadow DOM icinde; DOM kazimak kirilgan. Bu harness oranin geldigi ham
kaynagi (/sb/ XHR/fetch JSON'lari) kaydeder.

WS KAYDI KAPALI (sahip karari 2026-08-19): spike sorusu cevaplandi, oranlarin
TAMAMI events-table XHR + genis-pencere tekrar cagrilarindan geliyor;
parse_bets10_network yalnizca responses[] okur, sockets[] hicbir tuketicide
kullanilmiyor (WS'siz ayni dump ayni satirlari uretti, dogrulandi). WS frame
PAYLOAD'i artik kaydedilmez (dump ~%90 kuculur); frame SAYACI tutulmaya devam
eder cunku ws=0 "SPA yuklenmedi" arizasinin kanarya sinyali (2026-08-19 10:04
kosusu boyle yakalandi). Ham frame gerekirse --record-ws ile gecici acilir.

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
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

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
# Kapsam (kullanici tanimi): Turk futbol takimlarinin Avrupa maclari + TSL + 1.Lig,
# basketbol BSL + TBL, kadin/erkek milli takim maclari. Her competition Bets10'da
# ayri bir sayfa. DIKKAT: events-table/v2 sayfa acilinca yalnizca EN YAKIN mac
# gununu ceker (competition'in TUMUNU DEGIL); ileri haftalar icin widen_url ile
# genis-pencere tekrar cagrisi yapilir. Yanlis/bos sayfalar sessizce atlanir.
# Slug deseni: /spor-bahisleri/<spor>/<bolge>/<lig>.
# NOT (2026-07-30): basketbol (BSL ~Ekim) + milli takimlar su an SEZON DISI, sayfalari
# bos doner; sezon baslayinca otomatik dolar. Futbol competition'lari aktif.
BETS10_PAGES = [
    # --- futbol domestic (Turkiye) ---
    ("futbol-turkiye-1lig", "/tr/spor-bahisleri/futbol/turkiye/turkiye-1-lig"),
    ("futbol-turkiye-super-lig", "/tr/spor-bahisleri/futbol/turkiye/turkiye-super-lig"),
    # --- futbol Avrupa (Turk takimlari eleme/gruplar) ---
    # NOT: slug'lar TUTARSIZ - Sampiyonlar/Konferans "uefa-" ONEKSIZ, yalniz Avrupa
    # Ligi "uefa-avrupa-ligi". Yanlis slug futbol kokune yonlenip competition'i
    # yuklemiyor (2026-07-30 dogrulandi: Fenerbahce-Sturm sampiyonlar-ligi'nde).
    ("futbol-sampiyonlar-ligi", "/tr/spor-bahisleri/futbol/sampiyonlar-ligi/sampiyonlar-ligi"),
    ("futbol-avrupa-ligi", "/tr/spor-bahisleri/futbol/uefa-avrupa-ligi/avrupa-ligi"),
    ("futbol-konferans-ligi", "/tr/spor-bahisleri/futbol/konferans-ligi/konferans-ligi"),
    ("futbol-kulup-maclari", "/tr/spor-bahisleri/futbol/dostluk-maclari/kulup-maclari"),
    # --- basketbol (SEZON DISI; slug tahmini, sezonda dogrulanacak) ---
    ("basketbol-super-lig", "/tr/spor-bahisleri/basketbol/turkiye/turkiye-basketbol-super-ligi"),
    ("basketbol-tbl", "/tr/spor-bahisleri/basketbol/turkiye/turkiye-basketbol-ligi"),
    ("basketbol-euroleague", "/tr/spor-bahisleri/basketbol/euroleague/euroleague"),
    # --- milli takimlar (SEZON DISI; uluslararasi turnuvalar mac oldukca eklenir) ---
    ("futbol-milli-eleme", "/tr/spor-bahisleri/futbol/dunya-kupasi-eleme-uefa/dunya-kupasi-eleme-uefa"),
]
SITES: dict[str, dict] = {
    "bets10": {
        "domain_template": "https://www.{n}bets10.com",
        "domain_start": 10020,
        "domain_tries": 12,
        "probe_path": "/tr/spor-bahisleri/futbol",
        "pages": [(lbl, path + TAB) for lbl, path in BETS10_PAGES],
    },
    # bet365 dogrudan otomasyonla oran vermiyor (anti-bot); bet365 oranlari
    # API-Football uzerinden aliniyor (fetch_apifootball_odds.py).
    "bet365": {"base": "https://www.bet365.com", "probe_path": "/", "pages": [("anasayfa", "/#/AS/B1/")]},
}

MAX_BODY = 800_000        # tek yanit/frame ust siniri (char/byte)
MAX_TOTAL_MB = 60         # dump ust siniri, kacak onlemi

# GELECEK HAFTA SORUNU: events-table/v2 widget'i sayfa acilinca yalnizca EN YAKIN
# mac gununu gun-gun ceker (startsOnOrAfter/startsBefore penceresi dar). Boylece
# sadece "bir sonraki hafta" yakalanir; TSL'de 2. ve 3. hafta oranlari sitede
# GIRILI olsa bile hic istenmez (2026-07-31 dogrulandi). Cozum: sayfanin kendi
# events-table istegini (competitionIds + gercek header'lariyla birlikte) yakalayip
# GENIS bir gelecek penceresiyle bir kez daha cagirmak. Ayni yanit 1/2/3. haftayi
# birden dondurur (tek istekte >=60 gun 200 donuyor) ve oranlari (selections) icerir.
HORIZON_DAYS = 45         # simdiden itibaren kac gun ileri istenecek (~6 hafta;
                          # API tek istekte >=60 gun 200 donuyor). SofaScore tracker'da
                          # kaydi olan maclar eslesir; ufku genis tutmak zararsiz.


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
    # DataImpulse STICKY session: ayni sessid ~30dk boyunca ayni exit IP'yi verir
    # (2026-08-18 VPS'te ampirik dogrulandi: sessid.X 4/4 ayni IP). session_id kosu
    # boyunca sabit (secrets.token_hex) -> tek kosunun TUM istekleri (SPA yuklemesi +
    # widen pageNumber dongusu + sayfanin kurdugu sessiontoken) TEK exit IP'de kalir.
    # ONCEDEN sessid YOKTU: gw rotating her istekte baska residential IP donuyordu;
    # sayfanin kurdugu sessiontoken baska exit'te gecersiz -> events-table feed'i
    # kismi/bos donuyor (1.Lig Round-3 maclarinin cogu kaciyordu) veya SPA hic
    # yuklenemiyordu (ws=0 xhr=0). sessid yoksa ekle (env'de {session}/sessid varsa dokunma).
    if user and "sessid." not in user:
        user = f"{user};sessid.{session_id}"
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


def make_recorder(store: dict, record_ws: bool = False):
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
        store["wsConnections"] += 1
        def rec(payload, direction):
            # Sayac her zaman tutulur (ws=0 = SPA yuklenmedi kanaryasi);
            # payload yalnizca --record-ws ile yazilir (varsayilan kapali,
            # hicbir parser sockets[] okumuyor).
            store["wsFrames"] += 1
            if not record_ws:
                return
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


def widen_url(url: str, horizon_days: int) -> str:
    """events-table/v2 istegindeki tarih penceresini simdiden +horizon gune genisletir.

    startsOnOrAfter/startsBefore param'larini gunceller, digerlerini (categoryIds,
    competitionIds, maxMarketCount...) oldugu gibi birakir. Pencereyi kaldiran degil,
    ileri tasiyan yaklasim: boylece competition'in tum yaklasan haftalari tek yanitta.
    """
    now = datetime.now(timezone.utc)
    start = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    end = (now + timedelta(days=horizon_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    sp = urlsplit(url)
    # eventPhase'i de cikarip Prematch'e SABITLE. Nedeni (2026-08-01, Kasimpasa-Hull
    # City yakalanamadi): CANLI mac olan competition'larda (or. yaz hazirlik maclari,
    # ayni anda onlarca mac live) sayfa events-table'i eventPhase=Live ile atesliyor.
    # Boyle bir istegi ileri tarih penceresiyle genisletmek "gelecekteki canli maclar"
    # = 0 dondurur; yaklasan (prematch) maclar HIC istenmez. Tracker her zaman yaklasan
    # oranlari istedigi icin tekrar cagriyi kosulsuz Prematch yapiyoruz.
    q = [(k, v) for k, v in parse_qsl(sp.query, keep_blank_values=True)
         if k not in ("startsOnOrAfter", "startsBefore", "eventPhase")]
    q += [("eventPhase", "Prematch"),
          ("startsOnOrAfter", start), ("startsBefore", end)]
    return urlunsplit((sp.scheme, sp.netloc, sp.path, urlencode(q), sp.fragment))


def widen_key(url: str) -> str:
    """Ayni competition icin mukerrer genis-pencere istegini engellemek uzere,
    tarih param'lari cikarilmis normalize anahtar."""
    sp = urlsplit(url)
    # eventPhase de haric: ayni competition icin sayfa hem Live hem Prematch istegi
    # atesleyebilir; ikisi de artik Prematch'e sabitlenip genisletildigi icin ayni
    # anahtara dusmeli (mukerrer genis-pencere cagrisini onler).
    q = [(k, v) for k, v in sorted(parse_qsl(sp.query, keep_blank_values=True))
         if k not in ("startsOnOrAfter", "startsBefore", "pageNumber", "eventPhase")]
    return sp.path + "?" + urlencode(q)


def set_query(url: str, **params) -> str:
    """URL query'sinde verilen parametreleri ayarlar (varsa uzerine yazar)."""
    sp = urlsplit(url)
    q = [(k, v) for k, v in parse_qsl(sp.query, keep_blank_values=True)
         if k not in params]
    q += [(k, str(v)) for k, v in params.items()]
    return urlunsplit((sp.scheme, sp.netloc, sp.path, urlencode(q), sp.fragment))


# events-table/v2 SAYFA BASINA ~20 EVENT dondurur (eventSortBy=StartDate,
# pageNumber ile sayfalanir). Genis pencere tek sayfada yalnizca en yakin 20
# maci verir; ileri turlar (or. 3. hafta Besiktas-Corum) sonraki sayfalarda kalir
# ve SESSIZCE kaybolurdu. Bu yuzden pageNumber'i 1..MAX arttirip bos/kisa sayfaya
# kadar cekiyoruz.
WIDEN_MAX_PAGES = 12


def capture(site: str, headed: bool, out_dir: Path, only, per_league: int,
            detail_wait_ms: int, list_wait_ms: int,
            use_proxy: bool, chromium_path: str | None, country: str | None,
            horizon_days: int = HORIZON_DAYS,
            record_ws: bool = False) -> tuple[Path, int]:
    """Dump yolunu ve yakalanan events-table yaniti sayisini dondurur.

    events-table sayisi 0 = kosu VERISIZ (SPA sportsbook katmani hic yuklenmedi;
    2026-08-19 10:04 arizasi). Cagiran taraf bununla tekrar karari verebilir.
    """
    cfg = SITES[site]
    session_id = secrets.token_hex(6)  # sticky: kosu boyunca sabit
    # Varsayilan DIREKT (VPS IP). --proxy verilirse PROXY_URL uzerinden.
    proxy = proxy_config(session_id, country) if use_proxy else None
    print(f"[proxy] {'AKTIF cc=' + (country or 'yok') if proxy else 'yok (direkt VPS IP)'}", flush=True)

    store = {
        "version": 1, "kind": "network-capture", "site": site,
        "sessionId": session_id, "sockets": [], "responses": [], "pages": [],
        "wsConnections": 0, "wsFrames": 0,
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    on_ws, on_response = make_recorder(store, record_ws)

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

        # events-table isteklerinin gercek header'lari + url'i (genis-pencere
        # tekrar cagrisi icin). Header'lar dinamik x-sb-* / sessiontoken iceriyor;
        # dogrudan uretmek yerine sayfanin kendi istegindekini yeniden kullaniyoruz.
        et_reqs: list[dict] = []

        def on_request(req):
            if "events-table" in req.url:
                et_reqs.append({"url": req.url, "headers": dict(req.headers)})

        page.on("request", on_request)

        base = resolve_domain(page, cfg)

        for label, path in pages:
            visited: set[str] = set()
            et_before = len(et_reqs)
            try:
                page.goto(base + path, timeout=45000, wait_until="commit")
            except Exception as ex:
                print(f"[atlandi] {label}: {type(ex).__name__}", flush=True)
                continue
            page.wait_for_timeout(list_wait_ms)
            store["pages"].append({"label": label, "url": page.url})
            print(f"[{label}] ws={store['wsFrames']} xhr={len(store['responses'])}", flush=True)

            # GENIS PENCERE TEKRARI: bu sayfanin events-table istegini ileri tarih
            # penceresiyle bir kez daha cagir; boylece sadece sonraki hafta degil
            # tum yaklasan haftalar (2./3. hafta oranlari dahil) yakalanir. Yanit
            # store["responses"]'a eklenir; parse_bets10_network ayni sekilde ayristirir.
            widened = 0
            seen_keys: set[str] = set()
            for r in et_reqs[et_before:]:
                key = widen_key(r["url"])
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                base_url = widen_url(r["url"], horizon_days)
                # pageNumber 1..MAX: kisa/bos sayfaya kadar don (tum ileri turlar).
                for page_no in range(1, WIDEN_MAX_PAGES + 1):
                    url = set_query(base_url, pageNumber=page_no)
                    try:
                        resp = page.request.get(url, headers=r["headers"], timeout=40000)
                        if resp.status != 200:
                            print(f"  [genis-pencere {resp.status}] {label} s{page_no}", flush=True)
                            break
                        body = resp.json()
                    except Exception as ex:
                        print(f"  [genis-pencere hata] {label} s{page_no}: {type(ex).__name__}", flush=True)
                        break
                    n = len((body.get("data") or {}).get("events") or [])
                    if n == 0:
                        break
                    store["responses"].append({
                        "json": body, "url": url, "status": 200,
                        "kind": "xhr", "at": datetime.now(timezone.utc).isoformat(),
                    })
                    widened += 1
                    if n < 20:  # kisa sayfa = son sayfa
                        break
            if widened:
                ev = sum(len((rr.get("json") or {}).get("data", {}).get("events") or [])
                         for rr in store["responses"][-widened:])
                print(f"  genis-pencere: {widened} competition, ~{ev} mac (+{horizon_days}g)", flush=True)

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
                print(f"  {len(hrefs)} detay gezildi -> ws={store['wsFrames']} xhr={len(store['responses'])}", flush=True)

        browser.close()

    store["dumpedAt"] = datetime.now(timezone.utc).isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    path = out_dir / f"netcap_{site}_{stamp}.json"
    path.write_text(json.dumps(store, ensure_ascii=False), encoding="utf-8")

    xhr_json = sum(1 for r in store["responses"] if "json" in r)
    et_count = sum(1 for r in store["responses"] if "events-table" in (r.get("url") or ""))
    print(f"\nyazildi: {path}", flush=True)
    print(f"ws: {store['wsConnections']} baglanti / {store['wsFrames']} frame "
          f"(kayitli {len(store['sockets'])}) | xhr: {len(store['responses'])} "
          f"(json {xhr_json}, events-table {et_count})", flush=True)
    return path, et_count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("site", choices=sorted(SITES))
    ap.add_argument("--headed", action="store_true", help="yerelde gorunur tarayici")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--pages", nargs="*")
    # events-table/v2 (genis-pencere tekrariyla) yaklasan tum haftalarin
    # 1X2+Alt/Ust'unu verdigi icin detay taramasi VARSAYILAN KAPALI (per-league 0).
    # Daha cok market (detay sayfasindaki tum bahisler) icin >0.
    ap.add_argument("--per-league", type=int, default=0)
    ap.add_argument("--detail-wait-ms", type=int, default=14000)
    ap.add_argument("--list-wait-ms", type=int, default=22000)  # oran tablosu ~20s'de doluyor
    ap.add_argument("--proxy", action="store_true", help="PROXY_URL uzerinden geç (varsayilan direkt)")
    ap.add_argument("--cc", default=None, help="proxy ulke hedefleme (Bets10 icin: tr)")
    ap.add_argument("--chromium-path", default=None, help="sistem chromium yolu, ör. /usr/bin/chromium")
    ap.add_argument("--horizon-days", type=int, default=HORIZON_DAYS,
                    help="events-table genis-pencere tekrarinda kac gun ileri (2./3. hafta icin)")
    ap.add_argument("--record-ws", action="store_true",
                    help="WS frame payload'larini da dump'a yaz (varsayilan kapali; "
                         "hicbir parser okumuyor, yalniz gecici inceleme icin)")
    args = ap.parse_args()

    def run() -> tuple[Path, int]:
        return capture(args.site, args.headed, Path(args.out), args.pages,
                       args.per_league, args.detail_wait_ms, args.list_wait_ms,
                       args.proxy, args.chromium_path, args.cc, args.horizon_days,
                       args.record_ws)

    _, et = run()
    # VERISIZ KOSU TEKRARI (2026-08-19 10:04 arizasi): sticky oturumun denk
    # geldigi exit IP kotuyse SPA sportsbook katmani hic yuklenmiyor (ws=0,
    # events-table=0) ve 6 saatlik pencere bos geciyor. Yeni session id = yeni
    # exit IP ile BIR kez daha denenir; yine bossa rc=3 (log/wrapper sinyali).
    # Loader her zaman EN YENI dump'i yukledigi icin tekrar dump'i onceliklidir.
    if et == 0:
        print("[TEKRAR] events-table bos; yeni proxy oturumuyla ikinci deneme", flush=True)
        _, et = run()
        if et == 0:
            print("[HATA] ikinci deneme de verisiz; kosu bos bitti", flush=True)
            raise SystemExit(3)


if __name__ == "__main__":
    main()
