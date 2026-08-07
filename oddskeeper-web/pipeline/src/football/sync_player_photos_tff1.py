# -*- coding: utf-8 -*-
"""TFF 1. Lig oyuncu fotograflarini FlashScore ham verisinden (raw_stats._photo)
ref.flashscore_player_map uzerinden football.sofascore_player_info.photo_url'e yazar.

FS loader raw_stats'a _photo koyuyor; bu script eslesme sonrasi calisir (fmap gerekir).
Yeni 26/27 oyuncularinin sofascore_player_info satiri olmayabilir -> INSERT ON CONFLICT.
Idempotent. run_match_scrape.sh adim 3'te eslesme + mat refresh ile birlikte cagirilir.

Calistirma: python src/football/sync_player_photos_tff1.py
"""
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
        insert into football.sofascore_player_info (sofascore_player_id, photo_url, updated_at)
        select fmap.sofascore_player_id, max(d.raw_stats->>'_photo'), now()
        from football.match_player_stats_details d
        join ref.flashscore_player_map fmap
          on fmap.flashscore_player_id = d.source_player_id
        where d.source = 'flashscore'
          and coalesce(d.raw_stats->>'_photo', '') <> ''
        group by fmap.sofascore_player_id
        on conflict (sofascore_player_id) do update
          set photo_url = excluded.photo_url, updated_at = now()
    """)
    print(f"[player photos] {cur.rowcount} oyuncu foto upsert")


if __name__ == "__main__":
    main()
