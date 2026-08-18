# -*- coding: utf-8 -*-
"""Avrupa kupasi (CL/EL/ConL) SofaScore GECMIS-VERI backfill'i.

fetch_sofascore_matches.py'nin per-mac yukleme mantigini (match_row/player_rows/
build_team_rows/build_card_rows/build_shot_rows + upsert) yeniden kullanir; farki:
  - grace-period YOK: verilen sezon(lar)in TUM bitmis maclarini isler.
  - events/last/{page} sayfalarini sonuna kadar gezer (grace fetcher yalniz 0-1).
  - competition etiketi parametrik (guard'larla uyumlu; or. 'UEFA Şampiyonlar Ligi').
  - PROXY OPSIYONEL: PROXY_URL varsa kullanir (VPS), yoksa dogrudan (lokal; curl_cffi
    impersonate=chrome ile 403 yok).
Idempotent (hepsi upsert); yarida kesilirse tekrar kosulabilir. Her N macta bir flush
eder (kismi ilerleme kalici + restartable).

Kullanim:
  python src/football/backfill_sofascore_cup.py --ut 7 \
      --seasons 76953,96518 --competition "UEFA Şampiyonlar Ligi"
  Opsiyon: --flush-every 25  --sleep 0.5  --max-matches 0(sinirsiz)  --refresh-shotmap

Sezon id'leri (2026-08-18): CL ut=7 -> 25/26=76953, 26/27=96518;
  EL ut=679 -> 76984, 96522; ConL ut=17015 -> 76960, 96529.
"""
import argparse
import importlib
import os
import sys
import time
from pathlib import Path

from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
API = "https://api.sofascore.com/api/v1"
HDR = {"Accept": "application/json"}

sys.path.insert(0, str(Path(__file__).resolve().parent))
loader = importlib.import_module("load_sofascore_1lig_player_stats")
teamload = importlib.import_module("load_sofascore_team_stats")
shotload = importlib.import_module("load_sofascore_shotmap")


def get(url, tries=4):
    last = None
    for _ in range(tries):
        try:
            r = cr.get(url, headers=HDR, proxies=PROXIES, impersonate="chrome", timeout=40)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None  # bu mac icin ilgili uc-nokta yok (zararsiz)
            last = f"HTTP {r.status_code}: {r.text[:120]}"
        except Exception as e:  # noqa
            last = repr(e)[:120]
        time.sleep(1.5)
    raise RuntimeError(f"{url} -> {last}")


def season_label_from_name(name: str) -> str:
    import re
    m = re.search(r"(\d{2})/(\d{2})", name or "")
    if m:
        return f"20{m.group(1)}/20{m.group(2)}"
    return name or ""


def all_finished_events(ut: int, season_id: str) -> list:
    """Sezonun TUM bitmis maclari (events/last sayfalarini sonuna kadar gez)."""
    events, page, seen = [], 0, set()
    while True:
        try:
            d = get(f"{API}/unique-tournament/{ut}/season/{season_id}/events/last/{page}")
        except Exception as e:  # noqa
            print(f"  sayfa {page} hata: {e}", flush=True)
            break
        if not d:
            break
        evs = d.get("events", [])
        for ev in evs:
            if ev["id"] in seen:
                continue
            seen.add(ev["id"])
            if (ev.get("status") or {}).get("type") == "finished":
                events.append(ev)
        if not d.get("hasNextPage"):
            break
        page += 1
    return events


def flush(m_rows, p_rows, t_rows, c_rows, s_rows, comp):
    if m_rows:
        loader.upsert("matches", m_rows, "source,source_match_id")
    if t_rows:
        teamload.upsert(t_rows)
    if c_rows:
        teamload.upsert_cards(c_rows)
    if s_rows:
        shotload.upsert(s_rows)
    if p_rows:
        dedup = {}
        for r in p_rows:
            dedup[(r["source_match_id"], r["source_player_id"])] = r
        loader.upsert("match_player_stats_details", list(dedup.values()), "source,source_match_id,source_player_id")
    print(f"    [flush] {len(m_rows)} mac, {len(p_rows)} oyuncu, {len(t_rows)} takim-stat, "
          f"{len(c_rows)} kart, {len(s_rows)} sut", flush=True)


def process_season(ut, season_id, comp, sleep, max_matches, flush_every):
    seasons = get(f"{API}/unique-tournament/{ut}/seasons")["seasons"]
    smeta = next((s for s in seasons if str(s["id"]) == str(season_id)), None)
    label = season_label_from_name(smeta["name"]) if smeta else season_id
    loader.SEASON_LABEL = label
    loader.COMPETITION = comp
    print(f"\n[{comp}] sezon id={season_id} -> {label}", flush=True)

    events = all_finished_events(ut, season_id)
    events.sort(key=lambda e: e.get("startTimestamp") or 0)
    if max_matches:
        events = events[-max_matches:]
    print(f"[{comp}] bitmis mac: {len(events)}", flush=True)

    m_rows, p_rows, t_rows, c_rows, s_rows = [], [], [], [], []
    done = tot_m = tot_p = 0
    for ev in events:
        eid = ev["id"]
        try:
            lineup = get(f"{API}/event/{eid}/lineups") or {}
        except Exception as e:  # noqa
            print(f"  ATLANDI event {eid} (lineup): {e}", flush=True)
            continue
        try:
            det = get(f"{API}/event/{eid}")
            if det and det.get("event", {}).get("referee"):
                ev["referee"] = det["event"]["referee"]
        except Exception as e:  # noqa
            print(f"  hakem cekilemedi {eid}: {repr(e)[:80]}", flush=True)
        m_rows.append(loader.match_row(ev, playoff=False))
        p_rows.extend(loader.player_rows(ev, lineup))
        try:
            stats = get(f"{API}/event/{eid}/statistics")
            inc = get(f"{API}/event/{eid}/incidents")
            t_rows.extend(teamload.build_team_rows(ev, stats, inc, comp))
            c_rows.extend(teamload.build_card_rows(ev, inc, lineup))
        except Exception as e:  # noqa
            print(f"  takim-stat atlandi {eid}: {repr(e)[:80]}", flush=True)
        try:
            sm = get(f"{API}/event/{eid}/shotmap")
            if sm:
                s_rows.extend(shotload.build_shot_rows(eid, sm.get("shotmap", [])))
        except Exception as e:  # noqa
            print(f"  shotmap atlandi {eid}: {repr(e)[:80]}", flush=True)
        done += 1
        hs = (ev.get("homeScore") or {}).get("current")
        as_ = (ev.get("awayScore") or {}).get("current")
        print(f"  [{done}/{len(events)}] {ev['homeTeam']['name']} {hs}-{as_} "
              f"{ev['awayTeam']['name']} (event {eid})", flush=True)
        time.sleep(sleep)
        if done % flush_every == 0:
            tot_m += len(m_rows); tot_p += len(p_rows)
            flush(m_rows, p_rows, t_rows, c_rows, s_rows, comp)
            m_rows, p_rows, t_rows, c_rows, s_rows = [], [], [], [], []
    tot_m += len(m_rows); tot_p += len(p_rows)
    flush(m_rows, p_rows, t_rows, c_rows, s_rows, comp)
    print(f"[{comp}] {label} TAMAM: {done} mac islendi", flush=True)
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", type=int, required=True)
    ap.add_argument("--seasons", required=True, help="virgullu sezon id listesi")
    ap.add_argument("--competition", required=True)
    ap.add_argument("--sleep", type=float, default=0.5)
    ap.add_argument("--max-matches", type=int, default=0)
    ap.add_argument("--flush-every", type=int, default=25)
    ap.add_argument("--refresh-shotmap", action="store_true",
                    help="sonda player_shot_zones_match_mat'i tazele (Faz 4 kupa sut view'lari icin)")
    args = ap.parse_args()

    if not (loader.SUPABASE_URL and loader.SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY")
    print(f"Proxy: {'VAR' if PROXY else 'YOK (dogrudan)'}", flush=True)

    total = 0
    for sid in [s.strip() for s in args.seasons.split(",") if s.strip()]:
        total += process_season(args.ut, sid, args.competition, args.sleep,
                                args.max_matches, args.flush_every)

    if args.refresh_shotmap:
        try:
            import psycopg2
            conn = psycopg2.connect((ENV.get("DATABASE_URL") or "").strip().strip('"'))
            conn.autocommit = True
            conn.cursor().execute(
                "refresh materialized view concurrently analytics.player_shot_zones_match_mat")
            print("[mat] player_shot_zones_match_mat tazelendi", flush=True)
        except Exception as e:  # noqa
            print(f"UYARI: mat refresh basarisiz: {e}", flush=True)
    print(f"\nTOPLAM: {total} mac islendi.", flush=True)


if __name__ == "__main__":
    main()
