# -*- coding: utf-8 -*-
"""TSL takimlarinin YAKLASAN tum maclarini SofaScore'dan ceker (proxy).

fetch_sofascore_fixtures.py lig-kapsamlidir (yalniz Super Lig fiksturu);
Avrupa kupasi / Turkiye Kupasi maclari orada gorunmez. Bu script her TSL
takiminin /team/{id}/events/next sayfalarini dolasir ve TUM turnuvalardaki
yaklasan maclarini football.fixtures'a (source='sofascore') upsert eder.
competition = SofaScore uniqueTournament adi ("UEFA Champions League" vb.);
ayni event id lig loader'iyla cakisirsa on conflict yalniz tarih/durum tazeler.

Takim listesi DB'den: guncel sezon Super Lig sofascore fiksturundeki 18 takim.

Cron: run_sofascore.sh icinde (3 saatte bir). Elle:
  python src/football/fetch_sofascore_team_events.py
"""
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY}
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')
API = "https://api.sofascore.com/api/v1"

STATUS_MAP = {
    "notstarted": "scheduled", "postponed": "postponed",
    "canceled": "cancelled", "cancelled": "cancelled",
    "finished": "completed", "inprogress": "live",
}

# fetch_sofascore_fixtures.slugify ile ayni (ortak kullanim icin import etmiyoruz;
# o modul import aninda sys.argv okuyor).
import re
import unicodedata


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


def season_label_for(dt: datetime) -> str:
    # Takvim bazli sezon: Temmuz ve sonrasi yeni sezon.
    y = dt.year if dt.month >= 7 else dt.year - 1
    return f"{y}/{y + 1}"


def main() -> None:
    if not PROXY:
        raise SystemExit("Eksik PROXY_URL (.env)")
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()

    # Guncel TSL takimlarinin sofascore id'leri (lig fiksturunden).
    cur.execute(
        """select distinct t.team_id, t.team_name from (
             select home_team_source_id as team_id, home_team_name as team_name
             from football.fixtures
             where source = 'sofascore' and competition = 'Süper Lig'
               and season_label = '2026/2027'
             union
             select away_team_source_id, away_team_name
             from football.fixtures
             where source = 'sofascore' and competition = 'Süper Lig'
               and season_label = '2026/2027'
           ) t"""
    )
    teams = cur.fetchall()
    print(f"TSL takim: {len(teams)}", flush=True)

    total = 0
    for team_id, team_name in teams:
        events = {}
        for page in (0, 1):
            j = get(f"{API}/team/{team_id}/events/next/{page}")
            evs = (j or {}).get("events") or []
            for ev in evs:
                events[ev["id"]] = ev
            if len(evs) < 30:
                break
            time.sleep(0.3)

        n = 0
        for ev in events.values():
            ts = ev.get("startTimestamp")
            if not ts:
                continue
            status = STATUS_MAP.get((ev.get("status") or {}).get("type"), "scheduled")
            if status in ("completed", "live"):
                continue
            tour = (ev.get("tournament") or {})
            comp = ((tour.get("uniqueTournament") or {}).get("name")
                    or tour.get("name") or "?")
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            rnd = (ev.get("roundInfo") or {}).get("round")
            h, a = ev["homeTeam"], ev["awayTeam"]
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
                (str(ev["id"]), comp, season_label_for(dt), rnd, dt.date(), dt,
                 slugify(h.get("name", "")), slugify(a.get("name", "")),
                 str(h["id"]), str(a["id"]), h.get("name"), a.get("name"),
                 status, str(ev["id"])),
            )
            n += 1
        conn.commit()
        total += n
        print(f"  {team_name}: {n} yaklasan mac", flush=True)
        time.sleep(0.5)

    print(f"toplam upsert: {total}", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
