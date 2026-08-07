# -*- coding: utf-8 -*-
"""Uretim SofaScore fetcher: cok-macli, grace-period'li.

Proxy (PROXY_URL, .env) uzerinden curl_cffi ile SofaScore'dan guncel sezonun
son bitmis maclarini kesfeder, GRACE-PERIOD gecmis olanlari cekip mevcut
load_sofascore_1lig_player_stats.py mantigiyla (match_row/player_rows/upsert)
football.matches + football.match_player_stats_details'e (source='sofascore')
yazar. Sonunda tff1 mat'larini tazeler.

GRACE-PERIOD mantigi (mac bitinceye + duzeltmeler otursun diye):
  Bir mac ancak baslangicindan (kickoff) MIN_AGE_H .. MAX_AGE_H saat once ise islenir.
  - MIN_AGE_H  : mac biter bitmez cekme; istatistik/duzeltme otursun (varsayilan 4s).
  - MAX_AGE_H  : bu pencere boyunca her kosuda tekrar cekilir (Opta'dan yayilan
                 duzeltmeleri yakalamak icin); upsert idempotent oldugu icin guvenli
                 (varsayilan 60s ~ 2.5 gun).

Ortam degiskeni ile ezilir (test/ayar):
  SOFA_MIN_AGE_H, SOFA_MAX_AGE_H, SOFA_MAX_MATCHES (0=sinirsiz),
  SOFA_SEASON_ID (belirli sezon zorla; yoksa guncel sezon), SOFA_SLEEP (istekler arasi sn).

Calistirma:
  python src/football/fetch_sofascore_matches.py
"""
import importlib
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY}
HDR = {"Accept": "application/json"}
API = "https://api.sofascore.com/api/v1"

# test edilmis yukleyici mantigini yeniden kullan (dosyaya dokunmadan)
sys.path.insert(0, str(Path(__file__).resolve().parent))
loader = importlib.import_module("load_sofascore_1lig_player_stats")

MIN_AGE_H = float(os.environ.get("SOFA_MIN_AGE_H", "4"))
MAX_AGE_H = float(os.environ.get("SOFA_MAX_AGE_H", "60"))
MAX_MATCHES = int(os.environ.get("SOFA_MAX_MATCHES", "0"))  # 0 = sinirsiz
FORCE_SEASON = (os.environ.get("SOFA_SEASON_ID") or "").strip()  # test: belirli sezon
SLEEP = float(os.environ.get("SOFA_SLEEP", "0.6"))

# Islenecek ligler. SofaScore unique-tournament id + DB competition etiketi.
# ut=52 Super Lig, ut=98 Trendyol 1. Lig (26/27 season 98149). competition
# etiketi tff1 view'larinin filtresiyle birebir olmali ('Trendyol 1. Lig').
LEAGUES = [
    {"ut": 52, "competition": "Süper Lig"},
    {"ut": 98, "competition": "Trendyol 1. Lig"},
]


def get(url, tries=3):
    last = None
    for _ in range(tries):
        try:
            r = cr.get(url, headers=HDR, proxies=PROXIES, impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:120]}"
        except Exception as e:  # noqa
            last = repr(e)[:120]
        time.sleep(1.5)
    raise RuntimeError(f"{url} -> {last}")


def season_label_from_name(name: str) -> str:
    """'Super Lig 24/25' -> '2024/2025'; '2024/2025' -> aynen."""
    m = re.search(r"(\d{4})/(\d{4})", name or "")
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    m = re.search(r"(\d{2})/(\d{2})", name or "")
    if m:
        return f"20{m.group(1)}/20{m.group(2)}"
    return name or ""


def now_ts() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


def process_league(cfg: dict):
    ut = cfg["ut"]
    comp = cfg["competition"]
    seasons = get(f"{API}/unique-tournament/{ut}/seasons")["seasons"]
    if FORCE_SEASON:
        season = next((s for s in seasons if str(s["id"]) == FORCE_SEASON), seasons[0])
    else:
        season = seasons[0]  # guncel sezon
    season_label = season_label_from_name(season["name"])
    print(f"[{comp}] sezon={season['name']} -> {season_label} (id {season['id']})", flush=True)

    # son bitmis maclari topla (page 0 en yeni; gerekirse 1)
    events = []
    for page in (0, 1):
        try:
            evs = get(f"{API}/unique-tournament/{ut}/season/{season['id']}/events/last/{page}")["events"]
        except Exception:
            break
        events.extend(evs)
        if len(evs) < 30:
            break

    now = now_ts()
    eligible = []
    for ev in events:
        if (ev.get("status") or {}).get("type") != "finished":
            continue
        ts = ev.get("startTimestamp")
        if not ts:
            continue
        age_h = (now - ts) / 3600.0
        if MIN_AGE_H <= age_h <= MAX_AGE_H:
            eligible.append(ev)
    eligible.sort(key=lambda e: e.get("startTimestamp") or 0)
    if MAX_MATCHES:
        eligible = eligible[-MAX_MATCHES:]
    print(f"[{comp}] aday mac (grace {MIN_AGE_H}-{MAX_AGE_H}s): {len(eligible)}", flush=True)

    # yukleyici global'lerini bu lig icin ayarla
    loader.SEASON_LABEL = season_label
    loader.COMPETITION = comp

    m_rows, p_rows = [], []
    for ev in eligible:
        eid = ev["id"]
        try:
            lineup = get(f"{API}/event/{eid}/lineups")
        except Exception as e:  # noqa
            print(f"  ATLANDI event {eid}: {e}", flush=True)
            continue
        m_rows.append(loader.match_row(ev, playoff=False))
        p_rows.extend(loader.player_rows(ev, lineup))
        hs = (ev.get("homeScore") or {}).get("current")
        as_ = (ev.get("awayScore") or {}).get("current")
        print(f"  + {ev['homeTeam']['name']} {hs}-{as_} {ev['awayTeam']['name']} (event {eid})", flush=True)
        time.sleep(SLEEP)

    if m_rows:
        loader.upsert("matches", m_rows, "source,source_match_id")
    # ayni oyuncu-mac anahtarini tekillestir (son kazanir)
    dedup = {}
    for r in p_rows:
        dedup[(r["source_match_id"], r["source_player_id"])] = r
    p_rows = list(dedup.values())
    if p_rows:
        loader.upsert("match_player_stats_details", p_rows, "source,source_match_id,source_player_id")
    print(f"[{comp}] upsert: {len(m_rows)} mac, {len(p_rows)} oyuncu", flush=True)
    return len(m_rows), len(p_rows)


def main():
    if not PROXY:
        raise SystemExit("Eksik PROXY_URL (.env)")
    if not (loader.SUPABASE_URL and loader.SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY")
    total_m = total_p = 0
    for cfg in LEAGUES:
        try:
            m, p = process_league(cfg)
            total_m += m
            total_p += p
        except Exception as e:  # noqa
            print(f"[{cfg['competition']}] HATA: {e}", flush=True)
    if total_m:
        loader.refresh_mats()
    print(f"TOPLAM: {total_m} mac, {total_p} oyuncu", flush=True)


if __name__ == "__main__":
    main()
