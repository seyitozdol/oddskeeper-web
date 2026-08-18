# -*- coding: utf-8 -*-
"""Avrupa kupasi takim logolarini SofaScore'dan ref.sofascore_team_logos'a doldurur.

Frontend tff1_team_logos_v1 (generic, id-bazli) bu tablodan okur; TeamCrest plain
<img> ile URL'yi dogrudan yukler (indirme yok, hotlink). Logo URL id-bazli sabit:
  https://img.sofascore.com/api/v1/team/{id}/image  (webp)
Kirik resim olmasin diye her URL 200+image dogrulanip oyle yazilir; dogrulanmayan
takim initials (bas-harf) rozetiyle kalir.

Kullanim:
  python src/football/backfill_sofascore_team_logos.py [competition ...]
  varsayilan: uc Avrupa kupasi. Takim id'leri football.matches'ten (source=sofascore).
"""
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
IMG = "https://img.sofascore.com/api/v1/team/{id}/image"
DEFAULT_COMPS = ["UEFA Şampiyonlar Ligi", "UEFA Avrupa Ligi", "UEFA Konferans Ligi"]


def valid_logo(tid: str) -> bool:
    try:
        r = cr.get(IMG.format(id=tid), impersonate="chrome", timeout=20)
        return r.status_code == 200 and r.headers.get("content-type", "").startswith("image") and len(r.content) > 500
    except Exception:  # noqa
        return False


def main() -> None:
    comps = sys.argv[1:] or DEFAULT_COMPS
    conn = psycopg2.connect((ENV.get("DATABASE_URL") or "").strip().strip('"'))
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """select tid, max(name) from (
             select home_team_source_id tid, home_team_name name from football.matches
               where source='sofascore' and competition = any(%s)
             union all
             select away_team_source_id, away_team_name from football.matches
               where source='sofascore' and competition = any(%s)
           ) x where tid is not null group by tid""",
        (comps, comps),
    )
    teams = cur.fetchall()
    # zaten olanlari atla (idempotent + kota tasarrufu)
    cur.execute("select sofascore_team_id from ref.sofascore_team_logos")
    have = {r[0] for r in cur.fetchall()}
    todo = [(tid, name) for tid, name in teams if tid not in have]
    print(f"Takim: {len(teams)}, zaten logolu: {len(teams)-len(todo)}, denenecek: {len(todo)}", flush=True)

    rows, skipped = [], 0
    for i, (tid, name) in enumerate(todo, 1):
        if valid_logo(tid):
            rows.append((tid, name, IMG.format(id=tid)))
        else:
            skipped += 1
        if i % 25 == 0:
            print(f"  {i}/{len(todo)} ... gecerli {len(rows)}, atlanan {skipped}", flush=True)

    if rows:
        psycopg2.extras.execute_values(
            cur,
            """insert into ref.sofascore_team_logos (sofascore_team_id, team_name, logo_url, updated_at)
               values %s
               on conflict (sofascore_team_id) do update set
                 team_name = excluded.team_name, logo_url = excluded.logo_url, updated_at = now()""",
            [(r[0], r[1], r[2]) for r in rows],
            template="(%s, %s, %s, now())",
        )
    print(f"TAMAM: {len(rows)} logo yazildi, {skipped} takimda logo yok (initials kalir).", flush=True)
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
