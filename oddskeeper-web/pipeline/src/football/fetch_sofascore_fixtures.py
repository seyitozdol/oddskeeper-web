# -*- coding: utf-8 -*-
"""SofaScore fikstur cekici (proxy).

Bir ligin sezon fiksturunu SofaScore'dan proxy uzerinden cekip football.fixtures'a
(source='sofascore') upsert eder. fixture_id = sofascore event id.
Yaklasan (next) + oynanan (last) tum event sayfalari dolasilir.

CLI:  python src/football/fetch_sofascore_fixtures.py "Süper Lig" 52 ["2026/2027"]
      (season_label verilmezse guncel sezon; verilirse o sezon)
"""
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
# Proxy OPSIYONEL: VPS'te PROXY_URL, lokalde proxysiz (curl_cffi impersonate direkt calisir).
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')
API = "https://api.sofascore.com/api/v1"

COMP = sys.argv[1]
UT = sys.argv[2]
SEASON_LABEL = sys.argv[3] if len(sys.argv) > 3 else None

STATUS_MAP = {
    "notstarted": "scheduled", "postponed": "postponed",
    "canceled": "cancelled", "cancelled": "cancelled",
    "finished": "completed", "inprogress": "live",
}


def get(url, tries=3):
    for _ in range(tries):
        try:
            r = cr.get(url, headers={"Accept": "application/json"},
                       proxies=PROXIES, impersonate="chrome", timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except Exception:  # noqa
            pass
        time.sleep(1.2)
    return None


def slugify(name: str) -> str:
    s = (name or "").replace("ı", "i").replace("İ", "i")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def sl_from_name(name: str) -> str:
    m = re.search(r"(\d{2})/(\d{2})", name or "")
    if m:
        return f"20{m.group(1)}/20{m.group(2)}"
    return name or ""


def main():
    seasons = get(f"{API}/unique-tournament/{UT}/seasons")["seasons"]
    if SEASON_LABEL:
        season = next((s for s in seasons if sl_from_name(s["name"]) == SEASON_LABEL), None)
        if not season:
            raise SystemExit(f"Sezon bulunamadi: {SEASON_LABEL}")
    else:
        season = seasons[0]
    slabel = SEASON_LABEL or sl_from_name(season["name"])
    print(f"[{COMP}] sezon={season['name']} -> {slabel} (id {season['id']})", flush=True)

    events = {}
    for kind in ("next", "last"):
        page = 0
        while True:
            j = get(f"{API}/unique-tournament/{UT}/season/{season['id']}/events/{kind}/{page}")
            evs = (j or {}).get("events") or []
            for ev in evs:
                events[ev["id"]] = ev
            if len(evs) < 30:
                break
            page += 1
            time.sleep(0.3)
    print(f"toplam event: {len(events)}", flush=True)
    if not events:
        print("UYARI: fikstur yok (sezon henuz yayinlanmamis olabilir)", flush=True)
        return

    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor()
    n = 0
    for ev in events.values():
        ts = ev.get("startTimestamp")
        if not ts:
            continue
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        rnd = (ev.get("roundInfo") or {}).get("round")
        h, a = ev["homeTeam"], ev["awayTeam"]
        status = STATUS_MAP.get((ev.get("status") or {}).get("type"), "scheduled")
        cur.execute(
            """insert into football.fixtures (
                 fixture_id, competition, season_label, round_number,
                 fixture_date, fixture_datetime, kickoff_time_known,
                 home_team_slug, away_team_slug,
                 home_team_source_id, away_team_source_id,
                 home_team_name, away_team_name,
                 fixture_status, source, source_fixture_id, created_at, updated_at
               ) values (%s,%s,%s,%s,%s,%s,true,%s,%s,%s,%s,%s,%s,%s,'sofascore',%s,now(),now())
               on conflict (fixture_id) do update set
                 round_number = excluded.round_number,
                 fixture_date = excluded.fixture_date,
                 fixture_datetime = excluded.fixture_datetime,
                 fixture_status = excluded.fixture_status,
                 updated_at = now()""",
            (str(ev["id"]), COMP, slabel, rnd, dt.date(), dt,
             slugify(h.get("name", "")), slugify(a.get("name", "")),
             str(h["id"]), str(a["id"]), h.get("name"), a.get("name"),
             status, str(ev["id"])),
        )
        n += 1
    conn.commit()
    print(f"upserted {n} fixtures for {COMP} {slabel}", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
