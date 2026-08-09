# -*- coding: utf-8 -*-
"""API-Football'dan Super Lig guncel kadrolarini ceker ve football.team_squad_current'i
tazeler (source='apifootball').

Neden: team_squad_current sezon basi bir kez dolduruluyordu (2026-07-16 snapshot);
yaz transferleri sonrasi bayatliyor. Bu script kadroyu guncelleyerek yeni gelen
oyunculari (apifootball id'li) kadro listesine sokar. Ardindan ref.player_mapping
yeniden koşulmali (opta baglama) ve TM deger scraper'i calistirilmali.

Zincir: /players/squads -> team_squad_current -> (player_mapping) ->
        player_current_info_v1 / team_current_squad_v1

API anahtari kestirim projesinin .env'inden (API_FOOTBALL_KEY), DB pipeline .env'inden.
Tek transaction: eski TSL apifootball satirlari silinir, guncel kadro basilir.

Elle: .venv\\Scripts\\python.exe src\\football\\fetch_apifootball_squads.py
"""
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
from dotenv import dotenv_values, load_dotenv

ROOT = Path(__file__).resolve().parents[2]
API_BASE = "https://v3.football.api-sports.io"


def _api_key():
    """API_FOOTBALL_KEY: once pipeline/.env (VPS deseni), yoksa yerel kestirim/.env."""
    load_dotenv(ROOT / ".env")
    key = (os.environ.get("API_FOOTBALL_KEY") or "").strip().strip('"')
    if not key:
        kestirim = Path(r"C:\Users\zygom\PycharmProjects\kestirim") / ".env"
        if kestirim.exists():
            key = (dotenv_values(kestirim).get("API_FOOTBALL_KEY") or "").strip().strip('"')
    return key


API_KEY = _api_key()
LEAGUE_ID = 203
SEASON = int(os.environ.get("SEASON", "2026"))
SOURCE = "apifootball"


def api(path):
    for attempt in range(5):
        r = requests.get(f"{API_BASE}{path}", headers={"x-apisports-key": API_KEY}, timeout=30)
        if r.status_code == 429:
            time.sleep(61)
            continue
        r.raise_for_status()
        d = r.json()
        errs = d.get("errors")
        if (isinstance(errs, dict) and errs) or (isinstance(errs, list) and errs):
            raise RuntimeError(f"API errors {path}: {errs}")
        time.sleep(0.2)
        return d
    raise RuntimeError(f"429 tekrar: {path}")


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def main():
    if not API_KEY:
        raise SystemExit("API_FOOTBALL_KEY yok (kestirim/.env)")
    load_dotenv(ROOT / ".env")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    teams = api(f"/teams?league={LEAGUE_ID}&season={SEASON}")["response"]
    if not teams:
        raise SystemExit(f"season={SEASON} icin takim yok")
    print(f"TSL {SEASON} takim: {len(teams)}", flush=True)

    rows = []
    for t in teams:
        tid = t["team"]["id"]
        tname = t["team"]["name"]
        resp = api(f"/players/squads?team={tid}")["response"]
        plist = (resp[0]["players"] if resp else []) or []
        for p in plist:
            rows.append((
                SOURCE, str(tid), tname, str(p["id"]), p.get("name"),
                _int(p.get("age")), _int(p.get("number")), p.get("position"),
                p.get("photo"),
            ))
        print(f"  {tname} ({tid}): {len(plist)}", flush=True)

    # ref.team_mapping'de aktif eslenmeyen takimlar (kadrolari view'da gorunmez) uyarisi
    cur.execute("select source_team_id from ref.team_mapping where is_active")
    mapped = {r[0] for r in cur.fetchall()}
    unmapped = sorted({r[1] for r in rows} - mapped)
    if unmapped:
        print(f"UYARI: ref.team_mapping'de aktif olmayan apifootball takim id: {unmapped}", flush=True)

    # Tek transaction: eski TSL apifootball satirlari sil, guncel kadro bas
    cur.execute("select count(*) from football.team_squad_current where source=%s", (SOURCE,))
    old = cur.fetchone()[0]
    cur.execute("delete from football.team_squad_current where source=%s", (SOURCE,))
    psycopg2.extras.execute_values(
        cur,
        """insert into football.team_squad_current
             (source, source_team_id, team_name, source_player_id, player_name,
              age, shirt_number, position, photo_url, fetched_at)
           values %s""",
        [(*r, ) for r in rows],
        template="(%s,%s,%s,%s,%s,%s,%s,%s,%s, now())",
    )
    conn.commit()
    print(f"team_squad_current: {old} eski satir silindi, {len(rows)} yeni satir yazildi", flush=True)


if __name__ == "__main__":
    sys.exit(main())
