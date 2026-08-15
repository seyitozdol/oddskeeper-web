# -*- coding: utf-8 -*-
"""SofaScore GUNCEL kadrolarini ceker (Super Lig + 1. Lig).

Neden: mac verisinden turetilen oyuncu havuzu yalniz OYNAMIS oyunculari icerir;
yeni transferler ilk maclarina kadar hicbir yerde yok. /team/{id}/players ise
kulubun guncel kadrosunu verir (id, ad, mevki, forma no, boy, ulke, dogum).
Bu tablo "TM'de var bizde yok" oyuncularini kimliklendirmenin ve kartlarindaki
eksik bilgiyi doldurmanin kaynagi (bkz. apply_synthetic_squad.py koprusu).

Yazdiklari:
  football.sofascore_squad_current  (takim x oyuncu, tam upsert)
  football.sofascore_player_info    (bio alanlari; photo_url YALNIZ bossa yazilir,
                                     mevcut FlashScore fotograflari ezilmez)

Takim id'leri football.fixtures'in sofascore satirlarindan gelir (guncel sezon).

CLI:  python src/football/fetch_sofascore_squads.py [tsl|tff1|all]
Env:  SS_SLEEP (istekler arasi sn, vars. 0.5), PROXY_URL (VPS'te ZORUNLU: SofaScore
      datacenter IP'lerine 403 doner, evden dogrudan calisir).
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
API = "https://api.sofascore.com/api/v1"
IMG = "https://img.sofascore.com/api/v1/player/{sid}/image"
SLEEP = float(os.environ.get("SS_SLEEP", "0.5"))

LEAGUES = {
    "tsl": "S%per Lig%",
    "tff1": "Trendyol 1. Lig%",
}
WHICH = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()


def get(url: str, tries: int = 3):
    for _ in range(tries):
        try:
            r = cr.get(url, headers={"Accept": "application/json"},
                       proxies=PROXIES, impersonate="chrome", timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except Exception:  # noqa: BLE001
            pass
        time.sleep(1.5)
    return None


def teams_for(cur, comp_like: str) -> list[tuple[str, str, str]]:
    """(sofascore_team_id, team_slug, team_name) — guncel sezon fikstur satirlarindan."""
    cur.execute(
        """with f as (
               select home_team_source_id id, home_team_slug slug, home_team_name nm,
                      season_label
               from football.fixtures
               where source='sofascore' and competition like %s
               union all
               select away_team_source_id, away_team_slug, away_team_name, season_label
               from football.fixtures
               where source='sofascore' and competition like %s)
           select distinct on (id) id, slug, nm from f
           where season_label = (select max(season_label) from f)
           order by id""",
        (comp_like, comp_like),
    )
    return cur.fetchall()


def main() -> None:
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor()

    total_rows = 0
    for league, comp_like in LEAGUES.items():
        if WHICH not in ("all", league):
            continue
        teams = teams_for(cur, comp_like)
        print(f"[{league}] {len(teams)} takim")
        for team_id, team_slug, team_name in teams:
            data = get(f"{API}/team/{team_id}/players")
            if not data:
                print(f"  ATLANDI (yanit yok): {team_slug} ({team_id})")
                continue
            rows = []
            for entry in data.get("players") or []:
                p = entry.get("player") or {}
                pid = p.get("id")
                if not pid:
                    continue
                ts = p.get("dateOfBirthTimestamp")
                birth = (datetime.fromtimestamp(ts, tz=timezone.utc).date()
                         if isinstance(ts, (int, float)) else None)
                rows.append((
                    str(team_id), str(pid), league, team_slug, team_name,
                    p.get("name"), p.get("slug"), p.get("position"),
                    p.get("jerseyNumber"), p.get("height"),
                    (p.get("country") or {}).get("name"), birth,
                ))
            if not rows:
                print(f"  ATLANDI (kadro bos): {team_slug}")
                continue
            psycopg2.extras.execute_values(
                cur,
                """insert into football.sofascore_squad_current
                     (sofascore_team_id, sofascore_player_id, league, team_slug, team_name,
                      player_name, player_slug, position, shirt_number, height_cm,
                      country, birth_date)
                   values %s
                   on conflict (sofascore_team_id, sofascore_player_id) do update set
                     league=excluded.league, team_slug=excluded.team_slug,
                     team_name=excluded.team_name, player_name=excluded.player_name,
                     player_slug=excluded.player_slug, position=excluded.position,
                     shirt_number=excluded.shirt_number, height_cm=excluded.height_cm,
                     country=excluded.country, birth_date=excluded.birth_date,
                     fetched_at=now()""",
                rows,
            )
            # Kadrodan cikanlari bu takimin altindan dusur (transfer olan oyuncu iki
            # kulupte birden gorunmesin).
            cur.execute(
                """delete from football.sofascore_squad_current
                   where sofascore_team_id=%s and sofascore_player_id <> all(%s)""",
                (str(team_id), [r[1] for r in rows]),
            )
            # Bio: sofascore_player_info'ya yansit. photo_url YALNIZ bossa yazilir.
            psycopg2.extras.execute_values(
                cur,
                """insert into football.sofascore_player_info
                     (sofascore_player_id, player_name, player_slug, birth_date,
                      height_cm, country, position, photo_url, updated_at)
                   values %s
                   on conflict (sofascore_player_id) do update set
                     player_name=coalesce(excluded.player_name, football.sofascore_player_info.player_name),
                     player_slug=coalesce(excluded.player_slug, football.sofascore_player_info.player_slug),
                     birth_date=coalesce(excluded.birth_date, football.sofascore_player_info.birth_date),
                     height_cm=coalesce(excluded.height_cm, football.sofascore_player_info.height_cm),
                     country=coalesce(excluded.country, football.sofascore_player_info.country),
                     position=coalesce(excluded.position, football.sofascore_player_info.position),
                     photo_url=coalesce(football.sofascore_player_info.photo_url, excluded.photo_url),
                     updated_at=now()""",
                [(r[1], r[5], r[6], r[11], r[9], r[10], r[7], IMG.format(sid=r[1]),
                  datetime.now(timezone.utc)) for r in rows],
            )
            total_rows += len(rows)
            print(f"  {team_slug}: {len(rows)} oyuncu")
            time.sleep(SLEEP)
        conn.commit()

    print(f"TOPLAM: {total_rows} kadro satiri")
    conn.close()


if __name__ == "__main__":
    main()
