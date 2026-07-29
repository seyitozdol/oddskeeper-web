"""TFF 1. Lig fikstur yukleyici (SofaScore).

Girdi: tarayici panelinden cekilen JSON dizi dosyasi; her satir:
[round, event_id, home_team_id, home_name, away_team_id, away_name, start_ts, status]

football.fixtures'a source='sofascore' ile upsert eder (fixture_id = sofascore event id).
Kullanim: python load_sofascore_tff1_fixtures.py <json_dosyasi> <season_label>
"""
import json
import os
import sys
import unicodedata
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv

COMPETITION = "Trendyol 1. Lig"

STATUS_MAP = {
    "notstarted": "scheduled",
    "postponed": "postponed",
    "canceled": "cancelled",
    "cancelled": "cancelled",
    "finished": "completed",
}


def slugify(name: str) -> str:
    s = name.replace("ı", "i").replace("İ", "i")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def main() -> None:
    path, season_label = sys.argv[1], sys.argv[2]
    rows = json.load(open(path, encoding="utf-8"))

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()

    # mevcut slug'lari team_mapping'den al (source kolonu yok; id uzaylari cakismiyor), yoksa isimden uret
    cur.execute("select source_team_id, team_slug from ref.team_mapping")
    slug_by_id = {str(r[0]): r[1] for r in cur.fetchall()}

    n = 0
    for rnd, event_id, home_id, home_name, away_id, away_name, ts, status in rows:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        cur.execute(
            """
            insert into football.fixtures (
                fixture_id, competition, season_label, round_number,
                fixture_date, fixture_datetime, kickoff_time_known,
                home_team_slug, away_team_slug,
                home_team_source_id, away_team_source_id,
                home_team_name, away_team_name,
                fixture_status, source, source_fixture_id,
                created_at, updated_at
            ) values (%s,%s,%s,%s,%s,%s,true,%s,%s,%s,%s,%s,%s,%s,'sofascore',%s,now(),now())
            on conflict (fixture_id) do update set
                round_number = excluded.round_number,
                fixture_date = excluded.fixture_date,
                fixture_datetime = excluded.fixture_datetime,
                fixture_status = excluded.fixture_status,
                updated_at = now()
            """,
            (
                event_id, COMPETITION, season_label, rnd,
                dt.date(), dt,
                slug_by_id.get(str(home_id), slugify(home_name)),
                slug_by_id.get(str(away_id), slugify(away_name)),
                str(home_id), str(away_id), home_name, away_name,
                STATUS_MAP.get(status, "scheduled"), str(event_id),
            ),
        )
        n += 1
    conn.commit()
    print(f"upserted {n} fixtures for {season_label}")


if __name__ == "__main__":
    main()
