"""Kupa (Mackolik) takim/oyuncu kimliklerini mevcut Opta kimlik uzayina baglar.
ref.mackolik_team_map + ref.mackolik_player_map tablolarini doldurur.

- Takim: football.mackolik_matches team uuid'leri -> ref.team_mapping.source_team_id
  (Mackolik uuid = Opta uuid) -> team_slug.
- Oyuncu: raw lineup'lardaki oyuncular (mackolik id + uuid + isim + team_id);
  uuid Opta veri evreninde (match_player_stats_details source=opta) VEYA
  ref.player_mapping'te ise is_opta_matched=true; team_slug takim map'ten,
  opta_player_slug/apifootball ref.player_mapping'ten.

Idempotent (upsert). Kullanim: python src/football/map_mackolik_ids.py
"""
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

PIPELINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV = dotenv_values(os.path.join(PIPELINE_DIR, ".env"))


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()

    # ---- TAKIMLAR ----
    cur.execute(
        """
        with t as (
            select team_a_id id, team_a_uuid uuid, team_a_name nm from football.mackolik_matches where team_a_id is not null
            union
            select team_b_id, team_b_uuid, team_b_name from football.mackolik_matches where team_b_id is not null
        )
        select distinct id, uuid, nm from t
        """
    )
    teams = cur.fetchall()
    team_rows = []
    for tid, uuid, nm in teams:
        cur.execute(
            "select team_slug, canonical_team_name from ref.team_mapping where source_team_id=%s limit 1",
            (uuid,),
        )
        r = cur.fetchone()
        slug, canon = (r[0], r[1]) if r else (None, None)
        team_rows.append((tid, uuid, nm, slug, canon))
    psycopg2.extras.execute_values(
        cur,
        """
        insert into ref.mackolik_team_map
            (mackolik_team_id, mackolik_team_uuid, team_name, team_slug, canonical_team_name, updated_at)
        values %s
        on conflict (mackolik_team_id) do update set
            mackolik_team_uuid=excluded.mackolik_team_uuid, team_name=excluded.team_name,
            team_slug=excluded.team_slug, canonical_team_name=excluded.canonical_team_name, updated_at=now()
        """,
        team_rows, template="(%s,%s,%s,%s,%s, now())",
    )
    matched_teams = sum(1 for r in team_rows if r[3])
    print(f"TAKIM: {len(team_rows)} yazildi, {matched_teams} team_slug eslesti")

    # ---- OYUNCULAR ----
    # Oyuncunun takimi: lineup'ta oyuncu team_id tasimaz; taraf (team_A/team_B)
    # -> macin team_a_id/team_b_id ile belirlenir.
    cur.execute("select team_a_id, team_b_id, raw from football.mackolik_matches where raw is not null")
    players = {}  # mackolik_id -> (uuid, name, team_id)
    for team_a_id, team_b_id, d in cur.fetchall():
        lu = d.get("lineup") or {}
        for side, side_team in (("team_A", team_a_id), ("team_B", team_b_id)):
            for p in ((lu.get(side) or {}).get("players") or []):
                pl = p.get("player") or p
                pid = pl.get("id")
                if pid is None:
                    continue
                tid = pl.get("team_id") or p.get("team_id") or side_team
                players[pid] = (pl.get("uuid"), pl.get("name"), tid)

    # takim map'i bellek icine al (mackolik_team_id -> team_slug)
    cur.execute("select mackolik_team_id, team_slug from ref.mackolik_team_map")
    team_slug_by_id = dict(cur.fetchall())

    # opta evreni (uuid seti) + player_mapping (uuid -> slug/apifootball)
    cur.execute("select distinct source_player_id from football.match_player_stats_details where source='opta'")
    opta_uuids = {r[0] for r in cur.fetchall()}
    cur.execute("select opta_player_id, opta_player_slug, apifootball_player_id from ref.player_mapping where opta_player_id is not null")
    pm = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    player_rows = []
    for pid, (uuid, name, team_id) in players.items():
        matched = bool(uuid and (uuid in opta_uuids or uuid in pm))
        opta_slug, apif = pm.get(uuid, (None, None))
        player_rows.append((
            pid, uuid, name, team_id, team_slug_by_id.get(team_id),
            matched, opta_slug, apif,
        ))
    psycopg2.extras.execute_values(
        cur,
        """
        insert into ref.mackolik_player_map
            (mackolik_player_id, player_uuid, player_name, mackolik_team_id, team_slug,
             is_opta_matched, opta_player_slug, apifootball_player_id, updated_at)
        values %s
        on conflict (mackolik_player_id) do update set
            player_uuid=excluded.player_uuid, player_name=excluded.player_name,
            mackolik_team_id=excluded.mackolik_team_id, team_slug=excluded.team_slug,
            is_opta_matched=excluded.is_opta_matched, opta_player_slug=excluded.opta_player_slug,
            apifootball_player_id=excluded.apifootball_player_id, updated_at=now()
        """,
        player_rows, template="(%s,%s,%s,%s,%s,%s,%s,%s, now())",
    )
    matched_players = sum(1 for r in player_rows if r[5])
    print(f"OYUNCU: {len(player_rows)} yazildi, {matched_players} Opta kimligiyle eslesti "
          f"({sum(1 for r in player_rows if r[4])} team_slug'a bagli)")

    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
