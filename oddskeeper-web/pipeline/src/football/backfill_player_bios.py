# -*- coding: utf-8 -*-
"""Eksik oyuncu bio'larini doldurur (football.player_bio).

Iki kaynak:
  - GERCEK apifootball id'liler: API-Football /players/profiles?player=<id>
    (uyruk, dogum tarihi/yeri/ulkesi, boy, kilo, ad/soyad, foto).
  - SENTETIKLER ('tm...'): SofaScore /player/{sid} (uyruk, boy, forma no);
    dogum tarihi zaten TM seed'inden var. Kilo SofaScore'da yok.

Ayrica team_squad_current: sentetiklerde yas (dogumdan) + forma no doldurulur.

Kullanim: python backfill_player_bios.py [--limit N]
"""
from __future__ import annotations

import os
import re
import sys
import time
from datetime import date, datetime, timezone

import psycopg2
import requests as rq
from curl_cffi import requests as cr
from dotenv import load_dotenv, dotenv_values

SOFA = "https://api.sofascore.com/api/v1"


def num_from(s, unit):
    m = re.match(rf"^(\d+)\s*{unit}$", (s or "").strip())
    return int(m.group(1)) if m else None


def upsert_bio(cur, pid: str, fields: dict) -> None:
    """Var olan satirda yalniz BOS alanlari doldurur; yoksa insert."""
    cur.execute(
        "select id from football.player_bio where source='apifootball' and source_player_id=%s",
        (pid,))
    row = cur.fetchone()
    clean = {k: v for k, v in fields.items() if v not in (None, "")}
    if not clean:
        return
    if row:
        sets = ", ".join(f"{k} = coalesce(player_bio.{k}, %s)" for k in clean)
        cur.execute(
            f"update football.player_bio set {sets}, fetched_at=now() "
            f"where source='apifootball' and source_player_id=%s",
            (*clean.values(), pid))
    else:
        cols = ", ".join(clean.keys())
        ph = ", ".join(["%s"] * len(clean))
        cur.execute(
            f"insert into football.player_bio (source, source_player_id, {cols}, fetched_at) "
            f"values ('apifootball', %s, {ph}, now())",
            (pid, *clean.values()))


def main() -> None:
    load_dotenv()
    limit = 0
    for i, a in enumerate(sys.argv):
        if a == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    env = dotenv_values(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"))
    api_key = (env.get("API_FOOTBALL_KEY") or "").strip() \
        or (dotenv_values(r"C:/Users/zygom/PycharmProjects/kestirim/.env").get("API_FOOTBALL_KEY") or "").strip()
    H = {"x-apisports-key": api_key}

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # ── 1) Gercek id'liler: bio yok ya da uyruk/boy bos ──
    cur.execute("""
        select s.source_player_id, s.player_name
        from football.team_squad_current s
        left join football.player_bio b on b.source='apifootball' and b.source_player_id=s.source_player_id
        where s.source='apifootball'
          and (b.source_player_id is null or b.nationality is null or b.height_cm is null or b.birth_date is null)
        order by s.player_name
    """)
    real = cur.fetchall()
    if limit:
        real = real[:limit]
    print(f"apifootball bio eksigi: {len(real)}", flush=True)
    ok = err = 0
    for pid, pname in real:
        try:
            r = rq.get("https://v3.football.api-sports.io/players/profiles",
                       headers=H, params={"player": pid}, timeout=30)
            resp = (r.json() or {}).get("response") or []
            p = (resp[0] or {}).get("player") if resp else None
        except Exception as e:  # noqa
            print(f"  HATA {pname}: {repr(e)[:70]}", flush=True)
            err += 1
            continue
        if not p:
            err += 1
            continue
        birth = (p.get("birth") or {})
        bd = None
        if birth.get("date"):
            try:
                bd = datetime.strptime(birth["date"], "%Y-%m-%d").date()
            except ValueError:
                pass
        upsert_bio(cur, pid, {
            "full_name": f"{p.get('firstname') or ''} {p.get('lastname') or ''}".strip() or p.get("name"),
            "first_name": p.get("firstname"), "last_name": p.get("lastname"),
            "birth_date": bd, "birth_place": birth.get("place"), "birth_country": birth.get("country"),
            "nationality": p.get("nationality"),
            "height_cm": num_from(p.get("height"), "cm"),
            "weight_kg": num_from(p.get("weight"), "kg"),
            "photo_url": p.get("photo"),
        })
        ok += 1
        if ok % 25 == 0:
            conn.commit()
            print(f"  ... {ok}/{len(real)}", flush=True)
        time.sleep(0.25)
    conn.commit()
    print(f"apifootball: {ok} bio yazildi, {err} hata/bos", flush=True)

    # ── 2) Sentetikler: SofaScore /player/{sid} ──
    cur.execute("""
        select s.source_player_id, s.player_name,
               (select f.sofascore_player_id from football.player_foreign_season_stats f
                 where f.apifootball_player_id = s.source_player_id limit 1),
               sp.birth_date
        from football.team_squad_current s
        left join football.squad_synthetic_players sp on 'tm' || sp.tm_player_id = s.source_player_id
        where s.source='synthetic-tm'
    """)
    NAME_OVERRIDES = {"Markus Karlsbakk": 878844, "Élan Ricardo": 1388631, "Nariman Akhundzada": 1156696}
    s_ok = s_err = 0
    for pid, pname, sofa, birth in cur.fetchall():
        sid = sofa or NAME_OVERRIDES.get(pname)
        if not sid:
            print(f"  ATLANDI (sofa id yok): {pname}", flush=True)
            s_err += 1
            continue
        try:
            r = cr.get(f"{SOFA}/player/{sid}", impersonate="chrome", timeout=30)
            p = (r.json() or {}).get("player") if r.status_code == 200 else None
        except Exception as e:  # noqa
            print(f"  HATA {pname}: {repr(e)[:70]}", flush=True)
            s_err += 1
            continue
        if not p:
            s_err += 1
            continue
        bd = birth
        if not bd and p.get("dateOfBirthTimestamp"):
            bd = datetime.fromtimestamp(p["dateOfBirthTimestamp"], tz=timezone.utc).date()
        parts = (p.get("name") or pname).split()
        upsert_bio(cur, pid, {
            "full_name": p.get("name") or pname,
            "first_name": " ".join(parts[:-1]) or None, "last_name": parts[-1] if parts else None,
            "birth_date": bd,
            "nationality": (p.get("country") or {}).get("name"),
            "height_cm": p.get("height"),
        })
        # kadro satiri: yas + forma no
        age = None
        if bd:
            t = date.today()
            age = t.year - bd.year - ((t.month, t.day) < (bd.month, bd.day))
        cur.execute(
            """update football.team_squad_current
               set age = coalesce(age, %s), shirt_number = coalesce(shirt_number, %s)
               where source='synthetic-tm' and source_player_id=%s""",
            (age, p.get("jerseyNumber") or p.get("shirtNumber"), pid))
        s_ok += 1
        time.sleep(0.5)
    conn.commit()
    print(f"sentetik: {s_ok} bio yazildi, {s_err} atlandi", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
