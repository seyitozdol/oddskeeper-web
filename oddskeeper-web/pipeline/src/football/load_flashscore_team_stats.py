# -*- coding: utf-8 -*-
"""FlashScore takim-mac stat yukleyicisi (kaynak: 2.flashscore.ninja df_st feed).

Avrupa kupalari icin: SofaScore bazi kupa maclarinda (ozellikle on eleme) takim
istatistigi vermez; FlashScore verir. Feed:
  https://2.flashscore.ninja/2/x/feed/df_st_1_<mid>   (x-fsign header ZORUNLU)
Format: ~ ile bloklara ayrilir; SE=period ('Match'/'1st Half'/'2nd Half'),
SF=grup basligi, SD=stat id, SG=stat adi, SH=ev deger, SI=deplasman deger.
YALNIZ period='Match' okunur (tam mac). Stat SD id'leri SABIT (dil-bagimsiz).

Doldurulan tablo: football.match_team_stats (source='flashscore',
on_conflict source,source_match_id,source_team_id). Kolon eslesmesi SofaScore
loader'iyla (load_sofascore_team_stats) ayni hedef kolonlar -> kupa view'lari
iki kaynagi ayni sekilde okur.

Standalone test:
  python load_flashscore_team_stats.py <mid> --competition "UEFA Avrupa Ligi"
"""
import json
import re
from pathlib import Path

import requests
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
SUPABASE_URL = (ENV.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')

SOURCE = "flashscore"
FS_SIGN = "SW9D1eZo"  # FlashScore ninja feed statik imzasi
DIV = "÷"  # ÷
NOT = "¬"  # ¬


def fetch_df_st(mid: str):
    """df_st_1 feed metnini dondur (x-fsign zorunlu); yoksa None."""
    url = f"https://2.flashscore.ninja/2/x/feed/df_st_1_{mid}"
    for _ in range(3):
        try:
            r = cr.get(url, headers={"Accept": "*/*", "x-fsign": FS_SIGN},
                       impersonate="chrome", timeout=40)
            if r.status_code == 200 and r.text:
                return r.text
            if r.status_code == 404:
                return None
        except Exception:  # noqa
            pass
    return None


def parse_match_period(text: str) -> dict:
    """df_st metninden period='Match' stat'lari -> {sd_id: (home_raw, away_raw)}."""
    out = {}
    period = None
    for blk in (text or "").split("~"):
        fields = {}
        for part in blk.split(NOT):
            if DIV in part:
                k, v = part.split(DIV, 1)
                fields[k] = v
        if "SE" in fields:
            period = fields["SE"]
        if period != "Match":
            continue
        sd = fields.get("SD")
        if sd is not None and ("SH" in fields or "SI" in fields):
            out[sd] = (fields.get("SH"), fields.get("SI"))
    return out


def _num(v):
    """'51%' -> 51 ; '1.28' -> 1.28 ; '16' -> 16 ; '77% (320/414)' -> 77 (yuzde)."""
    if v is None:
        return None
    s = str(v).strip()
    if "(" in s:  # '77% (320/414)' -> ilk token
        s = s.split()[0]
    s = s.replace("%", "").strip()
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def _total(v):
    """'(a/b)' -> b (toplam); '%' veya sade -> sayinin kendisi (yuzde/sayi)."""
    if v is None:
        return None
    m = re.search(r"\((\d+)\s*/\s*(\d+)\)", str(v))
    if m:
        return int(m.group(2))
    return _num(v)


def _made(v):
    """'(a/b)' -> a (basarili); yoksa None."""
    if v is None:
        return None
    m = re.search(r"\((\d+)\s*/\s*(\d+)\)", str(v))
    return int(m.group(1)) if m else None


def build_team_rows(mid, parsed, home, away, competition, season_label, match_dt,
                    match_date_text, hs, as_):
    """Bir FS mac (parsed df_st) -> [home_row, away_row] (match_team_stats)."""
    def g(sd):  # (home_raw, away_raw)
        return parsed.get(sd, (None, None))

    def result_code(sf, sa):
        if sf is None or sa is None:
            return None
        return "W" if sf > sa else "L" if sf < sa else "D"

    yellow = g("23"); red = g("22")
    fouls = g("21")

    def row(side):  # 0=home 1=away
        me, opp = (home, away) if side == 0 else (away, home)
        sf, sa = (hs, as_) if side == 0 else (as_, hs)

        def sv(sd):
            return _num(g(sd)[side])

        def tot(sd):
            return _total(g(sd)[side])

        return {
            "source": SOURCE,
            "source_match_id": mid,
            "source_team_id": me["id"],
            "team_name": me["name"],
            "team_side": "home" if side == 0 else "away",
            "opponent_team_source_id": opp["id"],
            "opponent_team_name": opp["name"],
            "competition": competition,
            "match_datetime": match_dt,
            "match_date_text": match_date_text,
            "score_for": sf,
            "score_against": sa,
            "result_code": result_code(sf, sa),
            "summary_shots": sv("34"),                 # Total shots
            "summary_shots_on_target": sv("13"),       # Shots on target
            "summary_blocked_shots": sv("158"),        # Blocked shots
            "summary_corners_won": sv("16"),           # Corner kicks
            "summary_offsides": sv("17"),              # Offsides
            "summary_fouls_conceded": sv("21"),        # Fouls (kendi yaptigi)
            "summary_fouls_won": _num(fouls[1 - side]),  # rakibin faulu
            "summary_saves": sv("19"),                 # Goalkeeper saves
            "summary_tackles": tot("475"),             # Tackles '61% (11/18)' -> 18
            "summary_yellow_cards": sv("23"),
            "summary_red_cards": sv("22"),
            "summary_passes": tot("342"),              # Passes '77% (320/414)' -> 414
            "details_accurate_pass": _made(g("342")[side]),  # -> 320
            "details_attempts_ibox": sv("461"),        # Shots inside box
            "details_attempts_obox": sv("463"),        # Shots outside box
            "details_hit_woodwork": sv("457"),         # Hit the woodwork
            "details_expected_goals": sv("432"),       # xG
            "details_goal_kicks": sv("20"),            # Goal kicks
            "details_total_throws": sv("18"),          # Throw ins
            "sofascore_extras": {
                "possession_pct": sv("12"),            # Ball possession
                "expected_goals_on_target": sv("499"), # xGOT
                "expected_assists": sv("503"),         # xA
                "card_total": (sv("23") or 0) + 2 * (sv("22") or 0),
            },
        }

    return [row(0), row(1)]


def upsert(rows):
    if not rows:
        return
    url = (f"{SUPABASE_URL}/rest/v1/match_team_stats"
           "?on_conflict=source,source_match_id,source_team_id")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Profile": "football",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    r = requests.post(url, headers=headers, data=json.dumps(rows), timeout=120)
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"upsert match_team_stats hata {r.status_code}: {r.text[:300]}")


def _test():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("mid")
    ap.add_argument("--competition", default="UEFA Avrupa Ligi")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    text = fetch_df_st(a.mid)
    if not text:
        raise SystemExit("df_st feed yok (404)")
    parsed = parse_match_period(text)
    home = {"id": f"{a.mid}_H", "name": "HOME"}
    away = {"id": f"{a.mid}_A", "name": "AWAY"}
    rows = build_team_rows(a.mid, parsed, home, away, a.competition, "2026/2027",
                           None, None, None, None)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    if a.write:
        upsert(rows)
        print("UPSERT edildi")


if __name__ == "__main__":
    _test()
