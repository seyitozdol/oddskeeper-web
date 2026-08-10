# -*- coding: utf-8 -*-
"""Sentetik kadro oyunculari icin foto URL'i doldurur.

API-Football'dan gelen kadrolarda photo_url hazir; sentetiklerde (source=
'synthetic-tm') bos. SofaScore goruntu endpoint'i oyuncu id'siyle dogrudan
kurulabilir: https://img.sofascore.com/api/v1/player/{id}/image
SofaScore id'leri fetch_foreign_player_history'nin cozdugu eslesmelerden
(player_foreign_season_stats) gelir; orada olmayanlar OVERRIDES'tan.
Her URL yazilmadan once dogrulanir (200 + image/*).

Kullanim: python backfill_synthetic_photos.py
"""
from __future__ import annotations

import os
import time

import psycopg2
from curl_cffi import requests as cr
from dotenv import load_dotenv

IMG = "https://img.sofascore.com/api/v1/player/{sid}/image"
API_IMG = "https://api.sofascore.com/api/v1/player/{sid}/image"

# Elle cozulen SofaScore id'leri (loader cozemedigi/veri yazamadigi sentetikler).
OVERRIDES = {
    # tm_player_id -> sofascore player id
    "878844": None,  # Markus Karlsbakk (loader log'undan; asagida ada gore de bulunur)
}
# Ad bazli elle id (tm id yerine guvenli anahtar):
NAME_OVERRIDES = {
    "Markus Karlsbakk": 878844,
    "Élan Ricardo": 1388631,
    "Nariman Akhundzada": 1156696,  # SofaScore yazimi 'Akhundzade'
}


def probe(url: str) -> bool:
    try:
        r = cr.get(url, impersonate="chrome", timeout=20)
        return r.status_code == 200 and (r.headers.get("content-type") or "").startswith("image/")
    except Exception:
        return False


def main() -> None:
    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute("""
        select s.source_player_id, s.player_name,
               (select f.sofascore_player_id from football.player_foreign_season_stats f
                 where f.apifootball_player_id = s.source_player_id limit 1)
        from football.team_squad_current s
        where s.source = 'synthetic-tm'
          and (s.photo_url is null or s.photo_url = '')
    """)
    rows = cur.fetchall()
    print(f"fotosu eksik sentetik: {len(rows)}", flush=True)

    ok = miss = 0
    for pid, name, sofa in rows:
        sid = sofa or NAME_OVERRIDES.get(name)
        if not sid:
            print(f"  ATLANDI (sofa id yok): {name}", flush=True)
            miss += 1
            continue
        url = IMG.format(sid=sid)
        if not probe(url):
            url = API_IMG.format(sid=sid)
            if not probe(url):
                print(f"  GORSEL YOK: {name} (sofa {sid})", flush=True)
                miss += 1
                continue
        cur.execute(
            "update football.team_squad_current set photo_url=%s "
            "where source='synthetic-tm' and source_player_id=%s",
            (url, pid),
        )
        ok += 1
        print(f"  + {name} -> {url}", flush=True)
        time.sleep(0.4)

    conn.commit()
    conn.close()
    print(f"BITTI: {ok} foto yazildi, {miss} bulunamadi", flush=True)


if __name__ == "__main__":
    main()
