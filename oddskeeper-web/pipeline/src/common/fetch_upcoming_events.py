"""Upcoming Event Tracker: SofaScore'dan Turk takimlarinin yaklasan maclarini ceker.

Futbol / basketbol / voleybol icin iki tur kategori taranir:
  - Turkiye kategorileri: gunun tum maclari alinir (ligler ve alt ligler dahil).
  - Avrupa / Dunya / Uluslararasi kategorileri: iki takimdan biri TR ise alinir
    (Avrupa kupasi elemeleri, milli takimlar, kadin takimlari dahil).

Dogrudan requests 403 yedigi icin curl_cffi ile Chrome TLS taklidi yapilir
(api.sofascore.com tarayici disi TLS parmak izlerini engelliyor).

tracker.upcoming_events'e upsert eder; ayrica:
  - baslangici 3 gunden eski kayitlari siler,
  - 24 saattir sweep'te gorulmeyen notstarted kayitlari siler (kaynaktan kalkti).

Kullanim: python fetch_upcoming_events.py [gun_sayisi]  (varsayilan 14)
Periyodik: pipeline/run_upcoming_events.bat -> Windows Task Scheduler.
"""
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

import psycopg2
from curl_cffi import requests as creq
from dotenv import load_dotenv

API = "https://api.sofascore.com/api/v1"
REQUEST_GAP_SEC = 0.35
DEFAULT_DAYS_AHEAD = 14

# Kategori id'leri /api/v1/sport/{sport}/categories ciktisindan (2026-07-30).
# "all": kategorinin tum maclari; "tr_only": sadece TR takimli maclar.
CATEGORY_PLAN = {
    "football": {"all": [46], "tr_only": [1465, 1468]},      # Turkey / Europe, World
    "basketball": {"all": [112], "tr_only": [103]},          # Turkey / International
    "volleyball": {"all": [195], "tr_only": [136]},          # Turkey / International
}

UPSERT_SQL = """
insert into tracker.upcoming_events (
    event_id, sport, category_name, tournament_name, season_name, round_info,
    home_team_id, home_team_name, home_team_country, home_team_national,
    away_team_id, away_team_name, away_team_country, away_team_national,
    gender, start_ts, status_type, status_desc, home_score, away_score,
    event_slug, last_seen_at, created_at, updated_at
) values (
    %(event_id)s, %(sport)s, %(category_name)s, %(tournament_name)s,
    %(season_name)s, %(round_info)s,
    %(home_team_id)s, %(home_team_name)s, %(home_team_country)s, %(home_team_national)s,
    %(away_team_id)s, %(away_team_name)s, %(away_team_country)s, %(away_team_national)s,
    %(gender)s, %(start_ts)s, %(status_type)s, %(status_desc)s,
    %(home_score)s, %(away_score)s, %(event_slug)s, now(), now(), now()
)
on conflict (event_id) do update set
    category_name = excluded.category_name,
    tournament_name = excluded.tournament_name,
    season_name = excluded.season_name,
    round_info = excluded.round_info,
    start_ts = excluded.start_ts,
    status_type = excluded.status_type,
    status_desc = excluded.status_desc,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    last_seen_at = now(),
    updated_at = now()
"""


def log(msg: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def get_json(url: str) -> dict | None:
    for attempt in (1, 2):
        try:
            r = creq.get(url, impersonate="chrome", timeout=20)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            log(f"HTTP {r.status_code} ({attempt}. deneme): {url}")
        except Exception as ex:
            log(f"istek hatasi ({attempt}. deneme): {url} -> {ex}")
        time.sleep(2.0)
    return None


def team_row(team: dict, prefix: str) -> dict:
    country = team.get("country") or {}
    return {
        f"{prefix}_team_id": team.get("id"),
        f"{prefix}_team_name": team.get("name") or "?",
        f"{prefix}_team_country": country.get("alpha2"),
        f"{prefix}_team_national": bool(team.get("national")),
    }


def event_row(event: dict, sport: str) -> dict | None:
    ts = event.get("startTimestamp")
    home, away = event.get("homeTeam") or {}, event.get("awayTeam") or {}
    status = event.get("status") or {}
    if not ts or not event.get("id") or not home.get("name") or not away.get("name"):
        return None
    tournament = event.get("tournament") or {}
    round_info = (event.get("roundInfo") or {}).get("name")
    if not round_info:
        rnd = (event.get("roundInfo") or {}).get("round")
        round_info = f"Round {rnd}" if rnd else None
    row = {
        "event_id": event["id"],
        "sport": sport,
        "category_name": (tournament.get("category") or {}).get("name"),
        "tournament_name": tournament.get("name") or "?",
        "season_name": (event.get("season") or {}).get("name"),
        "round_info": round_info,
        "gender": home.get("gender"),
        "start_ts": datetime.fromtimestamp(ts, tz=timezone.utc),
        "status_type": status.get("type") or "notstarted",
        "status_desc": status.get("description"),
        "home_score": (event.get("homeScore") or {}).get("current"),
        "away_score": (event.get("awayScore") or {}).get("current"),
        "event_slug": event.get("slug"),
    }
    row.update(team_row(home, "home"))
    row.update(team_row(away, "away"))
    return row


def is_turkish(event: dict) -> bool:
    for side in ("homeTeam", "awayTeam"):
        country = (event.get(side) or {}).get("country") or {}
        if country.get("alpha2") == "TR":
            return True
    return False


def main() -> None:
    days_ahead = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DAYS_AHEAD

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()

    dates = [date.today() + timedelta(days=i) for i in range(days_ahead + 1)]
    total, per_sport = 0, {}

    for sport, plan in CATEGORY_PLAN.items():
        rows: dict[int, dict] = {}
        for mode, cat_ids in (("all", plan["all"]), ("tr_only", plan["tr_only"])):
            for cat_id in cat_ids:
                for d in dates:
                    data = get_json(f"{API}/category/{cat_id}/scheduled-events/{d.isoformat()}")
                    time.sleep(REQUEST_GAP_SEC)
                    if not data:
                        continue
                    for event in data.get("events", []):
                        if mode == "tr_only" and not is_turkish(event):
                            continue
                        row = event_row(event, sport)
                        if row:
                            rows[row["event_id"]] = row
        for row in rows.values():
            cur.execute(UPSERT_SQL, row)
        conn.commit()
        per_sport[sport] = len(rows)
        total += len(rows)
        log(f"{sport}: {len(rows)} mac upsert edildi")

    # Temizlik: eski maclar + kaynaktan kaldirilmis notstarted kayitlar.
    cur.execute("delete from tracker.upcoming_events where start_ts < now() - interval '3 days'")
    old_n = cur.rowcount
    cur.execute(
        "delete from tracker.upcoming_events "
        "where status_type = 'notstarted' and last_seen_at < now() - interval '24 hours'"
    )
    stale_n = cur.rowcount
    conn.commit()
    conn.close()

    log(f"bitti: toplam {total} mac ({per_sport}), silinen eski {old_n} + bayat {stale_n}")


if __name__ == "__main__":
    main()
