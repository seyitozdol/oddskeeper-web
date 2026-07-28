# -*- coding: utf-8 -*-
"""FlashScore JSON'larindan TFF 1. Lig takim logosu + oyuncu fotografi URL'leri.

Kaynak: pipeline/data/flashscore/1lig_2025-26/fs_*_m_*.json (epmsse: teams/players
participant.images; URL = https://static.flashscore.com/res/image/data/<path>).
Hedefler:
  - ref.sofascore_team_logos (sofascore_team_id pk, logo_url)  [takim adi eslesmesi]
  - football.sofascore_player_info.photo_url                    [ref.flashscore_player_map uzerinden]

Calistirma: .venv\\Scripts\\python.exe src\\football\\extract_flashscore_images_tff1.py
"""
import json
import unicodedata
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
IMG_BASE = "https://static.flashscore.com/res/image/data/"


def team_key(s: str) -> str:
    t = unicodedata.normalize("NFKD", s or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower().replace("ı", "i")
    words = [w for w in "".join(ch if ch.isalnum() or ch == " " else " " for ch in t).split()
             if w not in {"fk", "sk", "as", "spor", "kulubu", "sportif", "faaliyetler", "futbol"}]
    return " ".join(words) or t


def pick_image(images):
    if not images:
        return None
    by_variant = {i.get("variantType"): i.get("path") for i in images if i.get("path")}
    path = by_variant.get(24) or by_variant.get(15) or next(iter(by_variant.values()), None)
    return IMG_BASE + path if path else None


# FS adi -> sofascore adi (eslesmeyen ozel durumlar)
TEAM_ALIAS = {
    "Amedspor": "Amed Sportif Faaliyetler",
    "Bodrumspor": "Bodrum FK",
    "Serik Spor": "Serikspor A.Ş.",
    "Istanbulspor AS": "İstanbulspor",
    "Corum": "Çorum FK",
    "Erokspor": "Esenler Erokspor",
    "Igdir FK": "Iğdır FK",
}


def main():
    team_imgs = {}    # fs name -> url
    player_imgs = {}  # fs player id -> url
    # TSL klasoru de taranir: Kocaelispor/Genclerbirligi/Karagumruk gibi 24/25 1. Lig
    # takimlarinin logolari orada
    for folder in ("1lig_2025-26", "superlig_2025-26"):
        for f in (ROOT / "data" / "flashscore" / folder).glob("fs_*_m_*.json"):
            d = json.loads(f.read_text(encoding="utf-8"))
            se = (d.get("se") or {}).get("findEventPMSById") or {}
            for t in se.get("teams") or []:
                url = pick_image((t.get("participant") or {}).get("images"))
                if url:
                    name = t.get("name")
                    team_imgs[TEAM_ALIAS.get(name, name)] = url
            if folder != "1lig_2025-26":
                continue  # oyuncu fotograflari yalniz 1. Lig
            for p in se.get("players") or []:
                part = p.get("participant") or {}
                url = pick_image(part.get("images"))
                if url and part.get("id"):
                    player_imgs[part["id"]] = url
    print(f"FS takim logolari: {len(team_imgs)}, oyuncu fotograflari: {len(player_imgs)}")

    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute("""
        create table if not exists ref.sofascore_team_logos (
          sofascore_team_id text primary key,
          team_name text,
          logo_url text,
          updated_at timestamptz default now()
        )""")
    cur.execute("alter table football.sofascore_player_info add column if not exists photo_url text")

    # takim eslesmesi: sofascore 1. Lig takimlari (iki sezon)
    cur.execute("""
        select distinct home_team_source_id, home_team_name from football.matches
        where source='sofascore' and competition like 'Trendyol 1. Lig%'""")
    sofa_teams = cur.fetchall()
    fs_by_key = {team_key(n): u for n, u in team_imgs.items()}
    rows = []
    for sid, name in sofa_teams:
        url = fs_by_key.get(team_key(name))
        if not url:
            # kelime kesisimi fallback
            for k, u in fs_by_key.items():
                if set(k.split()) & set(team_key(name).split()):
                    url = u
                    break
        if url:
            rows.append((sid, name, url))
        else:
            print("  logo eslesmedi:", name)
    psycopg2.extras.execute_values(
        cur,
        """insert into ref.sofascore_team_logos (sofascore_team_id, team_name, logo_url)
           values %s on conflict (sofascore_team_id) do update
           set logo_url=excluded.logo_url, team_name=excluded.team_name, updated_at=now()""",
        rows,
    )
    print(f"[team_logos] {len(rows)} takim")

    # oyuncu fotograflari: fs id -> sofa id
    cur.execute("select flashscore_player_id, sofascore_player_id from ref.flashscore_player_map where sofascore_player_id is not null")
    fs2sofa = dict(cur.fetchall())
    updated = 0
    for fid, url in player_imgs.items():
        sid = fs2sofa.get(fid)
        if sid:
            cur.execute("update football.sofascore_player_info set photo_url=%s, updated_at=now() where sofascore_player_id=%s", (url, sid))
            updated += cur.rowcount
    conn.commit()
    print(f"[player photos] {updated} oyuncu guncellendi")


if __name__ == "__main__":
    main()
