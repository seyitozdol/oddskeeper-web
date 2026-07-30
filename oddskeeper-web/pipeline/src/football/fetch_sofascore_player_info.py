# -*- coding: utf-8 -*-
"""SofaScore oyuncu bio backfill.

Bir ligin (competition) bio'su EKSİK sofascore oyuncularini bulur, her biri icin
proxy uzerinden /api/v1/player/{id} cekip football.sofascore_player_info'ya upsert
eder (isim/slug/dogum/boy/ulke/pozisyon). photo_url'e dokunmaz (ayri is).

CLI:  python src/football/fetch_sofascore_player_info.py ["Süper Lig"]
Env:  SS_SLEEP (istekler arasi sn, vars. 0.4), SS_MAX (0=sinirsiz, test icin kap).
"""
import os
import sys
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

COMP = sys.argv[1] if len(sys.argv) > 1 else "Süper Lig"
SLEEP = float(os.environ.get("SS_SLEEP", "0.4"))
MAX = int(os.environ.get("SS_MAX", "0"))


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


def bdate(ts):
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).date()
    except Exception:  # noqa
        return None


def upsert(cur, rows):
    if not rows:
        return
    cur.executemany(
        """insert into football.sofascore_player_info
             (sofascore_player_id, player_name, player_slug, birth_date, height_cm, country, position, updated_at)
           values (%s,%s,%s,%s,%s,%s,%s, now())
           on conflict (sofascore_player_id) do update set
             player_name = excluded.player_name,
             player_slug = excluded.player_slug,
             birth_date  = excluded.birth_date,
             height_cm   = excluded.height_cm,
             country     = excluded.country,
             position    = excluded.position,
             updated_at  = now()""",
        rows,
    )


def main():
    if not PROXY:
        raise SystemExit("Eksik PROXY_URL (.env)")
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """with slp as (
             select distinct d.source_player_id as pid
             from football.match_player_stats_details d
             join football.matches m on m.source = d.source and m.source_match_id = d.source_match_id
             where d.source = 'sofascore' and m.competition = %s)
           select slp.pid from slp
           left join football.sofascore_player_info i on i.sofascore_player_id = slp.pid
           where i.sofascore_player_id is null
           order by slp.pid""",
        (COMP,),
    )
    ids = [r[0] for r in cur.fetchall()]
    if MAX:
        ids = ids[:MAX]
    print(f"[{COMP}] bio eksik oyuncu: {len(ids)}", flush=True)

    ok = fail = 0
    rows = []
    for i, pid in enumerate(ids, 1):
        j = get(f"{API}/player/{pid}")
        p = (j or {}).get("player") if j else None
        if not p:
            fail += 1
        else:
            rows.append((
                str(pid), p.get("name"), p.get("slug"),
                bdate(p.get("dateOfBirthTimestamp")), p.get("height"),
                (p.get("country") or {}).get("name"), p.get("position"),
            ))
            ok += 1
        if len(rows) >= 50:
            upsert(cur, rows)
            rows = []
        if i % 100 == 0:
            print(f"  {i}/{len(ids)} (ok {ok}, fail {fail})", flush=True)
        time.sleep(SLEEP)
    upsert(cur, rows)
    print(f"BITTI: {ok} upsert, {fail} basarisiz", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
