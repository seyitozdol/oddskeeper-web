# -*- coding: utf-8 -*-
"""Avrupa kupasi oyuncu fotolarini SofaScore'dan football.sofascore_player_info.
photo_url'e doldurur (bio ayri is: fetch_sofascore_player_info.py). Foto URL id-bazli
sabit: https://img.sofascore.com/api/v1/player/{id}/image (webp). Bazi minnow-lig
oyuncularinda foto YOK (404) -> her URL 200+image dogrulanir, yoksa yazilmaz (o oyuncu
bas-harf/placeholder kalir; kirik resim olmaz).

Frontend tff1_player_info_v1 -> sofascore_player_info.photo_url okur; isim/pozisyon
zaten mac verisinden (ucl_player_season_stats_v1) gelir, burada yalniz FOTO doldurulur.

Kullanim:  python src/football/backfill_sofascore_player_photos.py [competition ...]
  varsayilan: uc Avrupa kupasi. Env: PH_SLEEP (vars 0.12), PH_MAX (0=sinirsiz).
"""
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
IMG = "https://img.sofascore.com/api/v1/player/{id}/image"
DEFAULT_COMPS = ["UEFA Şampiyonlar Ligi", "UEFA Avrupa Ligi", "UEFA Konferans Ligi"]
SLEEP = float(os.environ.get("PH_SLEEP", "0.12"))
MAX = int(os.environ.get("PH_MAX", "0"))


def valid_photo(pid: str) -> bool:
    try:
        r = cr.get(IMG.format(id=pid), impersonate="chrome", timeout=15)
        return r.status_code == 200 and r.headers.get("content-type", "").startswith("image") and len(r.content) > 500
    except Exception:  # noqa
        return False


def main() -> None:
    import time
    comps = sys.argv[1:] or DEFAULT_COMPS
    conn = psycopg2.connect((ENV.get("DATABASE_URL") or "").strip().strip('"'))
    conn.autocommit = True
    cur = conn.cursor()
    # foto'su OLMAYAN (photo_url null) kupa oyunculari
    cur.execute(
        """select d.source_player_id, max(d.player_name)
           from football.match_player_stats_details d
           join football.matches m on m.source=d.source and m.source_match_id=d.source_match_id
           left join football.sofascore_player_info i on i.sofascore_player_id = d.source_player_id
           where d.source='sofascore' and m.competition = any(%s) and i.photo_url is null
           group by d.source_player_id""",
        (comps,),
    )
    players = cur.fetchall()
    if MAX:
        players = players[:MAX]
    print(f"Foto eksik kupa oyuncusu: {len(players)}", flush=True)

    rows, skipped = [], 0
    for i, (pid, name) in enumerate(players, 1):
        if valid_photo(pid):
            rows.append((str(pid), name, IMG.format(id=pid)))
        else:
            skipped += 1
        if len(rows) >= 100:
            _flush(cur, rows); rows = []
        if i % 200 == 0:
            print(f"  {i}/{len(players)} ... gecerli-foto {i-skipped}, foto-yok {skipped}", flush=True)
        time.sleep(SLEEP)
    _flush(cur, rows)
    print(f"TAMAM: {len(players)-skipped} foto yazildi, {skipped} oyuncuda foto yok.", flush=True)
    cur.close()
    conn.close()


def _flush(cur, rows):
    if not rows:
        return
    # bio satiri yoksa olustur (isim mac verisinden); varsa yalniz photo_url guncelle.
    psycopg2.extras.execute_values(
        cur,
        """insert into football.sofascore_player_info
             (sofascore_player_id, player_name, photo_url, updated_at)
           values %s
           on conflict (sofascore_player_id) do update set
             photo_url = excluded.photo_url,
             player_name = coalesce(football.sofascore_player_info.player_name, excluded.player_name),
             updated_at = now()""",
        rows,
        template="(%s, %s, %s, now())",
    )


if __name__ == "__main__":
    main()
