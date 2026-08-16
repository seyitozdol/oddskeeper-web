# -*- coding: utf-8 -*-
"""SofaScore takim-mac stat yukleyicisi (statistics + incidents -> football.match_team_stats,
source='sofascore'). Fetcher (fetch_sofascore_matches.py) her bitmis mac icin
build_team_rows() cagirir; sonra upsert(rows). Hem GSheet sekmesini hem MSM guncel-sezon
feed'ini (item C) besler.

Kolon eslesmesi (MSM 10 market + skor + kart + woodwork mevcut kolonlara; possession/
added-time/VAR/penalty/own-goal jsonb sofascore_extras'a):
  Shot=summary_shots, SOT=summary_shots_on_target, Corner=summary_corners_won,
  Foul=summary_fouls_conceded, Offside=summary_offsides, Saves=summary_saves,
  Tackle=summary_tackles, Goal Kick=details_goal_kicks, Throw-in=details_total_throws,
  Card=(summary_yellow_cards, summary_red_cards; toplam=sari+2*kirmizi okuma tarafinda),
  Wood Work=details_hit_woodwork, xG=details_expected_goals.

Standalone test: python load_sofascore_team_stats.py --event <id> --competition "Süper Lig" [--write]
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
SUPABASE_URL = (ENV.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')
SOURCE = "sofascore"


def _num(v):
    if v is None:
        return None
    s = str(v).replace("%", "").strip()
    if "(" in s:  # "78% (294/378)" -> 78
        s = s.split()[0]
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def _stat_map(statistics):
    out = {}
    for period in (statistics or {}).get("statistics", []):
        if period.get("period") != "ALL":
            continue
        for grp in period.get("groups", []):
            for it in grp.get("statisticsItems", []):
                out[it.get("name")] = (it.get("home"), it.get("away"))
    return out


def build_team_rows(event, statistics, incidents, competition):
    """Bir SofaScore event + statistics + incidents -> [home_row, away_row]."""
    home, away = event["homeTeam"], event["awayTeam"]
    hs = (event.get("homeScore") or {}).get("current")
    as_ = (event.get("awayScore") or {}).get("current")
    ts = event.get("startTimestamp")
    dt = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None
    stat = _stat_map(statistics)

    def sv(name, side, zero_default=False):  # side 0=home 1=away
        pair = stat.get(name)
        if pair:
            return _num(pair[side])
        # SofaScore, iki takim da 0 ise o metrigin basligini HIC gostermez.
        # Istatistigi yuklu macta (stat map dolu) izlenen sayisal metrik yoksa
        # bu 0-0 demektir -> 0 yaz. Hic istatistik yoksa (map bos) null birak
        # (mac istatistigi gelmemis; 0 uydurma).
        return 0 if (zero_default and stat) else None

    yellow = {0: 0, 1: 0}; red = {0: 0, 1: 0}
    pen = {0: 0, 1: 0}; var = {0: 0, 1: 0}; og = {0: 0, 1: 0}
    add = {45: None, 90: None}
    for i in (incidents or {}).get("incidents", []):
        side = 0 if i.get("isHome") else 1
        it, ic = i.get("incidentType"), i.get("incidentClass")
        if it == "injuryTime":
            add[i.get("time")] = i.get("length")
        elif it == "card":
            if ic == "yellow":
                yellow[side] += 1
            elif ic in ("red", "yellowRed"):
                red[side] += 1
        elif it == "goal":
            if ic == "penalty":
                pen[side] += 1
            if ic == "ownGoal":
                og[side] += 1
        if it == "varDecision" or ic == "varDecision":
            var[side] += 1

    def result_code(sf, sa):
        if sf is None or sa is None:
            return None
        return "W" if sf > sa else "L" if sf < sa else "D"

    def row(side):
        me, opp = (home, away) if side == 0 else (away, home)
        sf, sa = (hs, as_) if side == 0 else (as_, hs)
        return {
            "source": SOURCE,
            "source_match_id": str(event["id"]),
            "source_team_id": str(me["id"]),
            "team_name": me["name"],
            "team_side": "home" if side == 0 else "away",
            "opponent_team_source_id": str(opp["id"]),
            "opponent_team_name": opp["name"],
            "competition": competition,
            "match_datetime": dt,
            "score_for": sf,
            "score_against": sa,
            "result_code": result_code(sf, sa),
            # zero_default=True: SofaScore 0-0 metrigi basligi hic gostermez;
            # istatistigi yuklu macta eksik = 0 (tabloda '-' yerine 0).
            "summary_shots": sv("Total shots", side, True),
            "summary_shots_on_target": sv("Shots on target", side, True),
            "summary_corners_won": sv("Corner kicks", side, True),
            "summary_fouls_conceded": sv("Fouls", side, True),
            "summary_fouls_won": sv("Fouls", 1 - side, True),
            "summary_offsides": sv("Offsides", side, True),
            "summary_saves": sv("Total saves", side, True),
            "summary_tackles": sv("Total tackles", side, True),
            "summary_yellow_cards": yellow[side],
            "summary_red_cards": red[side],
            "details_goal_kicks": sv("Goal kicks", side, True),
            "details_total_throws": sv("Throw-ins", side, True),
            "details_hit_woodwork": sv("Hit woodwork", side),
            "details_expected_goals": sv("Expected goals", side),
            "sofascore_extras": {
                "possession_pct": sv("Ball possession", side),
                "added_time_1h": add.get(45),
                "added_time_2h": add.get(90),
                "var_count": var[side],
                "penalties": pen[side],
                "own_goals": og[side],
                "card_total": yellow[side] + 2 * red[side],
            },
        }

    return [row(0), row(1)]


def upsert(rows):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/match_team_stats?on_conflict=source,source_match_id,source_team_id"
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
    from curl_cffi import requests as cr
    ap = argparse.ArgumentParser()
    ap.add_argument("--event", required=True)
    ap.add_argument("--competition", default="Süper Lig")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    prox = (ENV.get("PROXY_URL") or "").strip()
    P = {"http": prox, "https": prox}
    API = "https://api.sofascore.com/api/v1"

    def g(u):
        for _ in range(4):
            try:
                r = cr.get(u, headers={"Accept": "application/json"}, proxies=P, impersonate="chrome", timeout=40)
                if r.status_code == 200:
                    return r.json()
            except Exception:
                pass
        raise RuntimeError(f"fail {u}")

    ev = g(f"{API}/event/{a.event}")["event"]
    st = g(f"{API}/event/{a.event}/statistics")
    inc = g(f"{API}/event/{a.event}/incidents")
    rows = build_team_rows(ev, st, inc, a.competition)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    if a.write:
        upsert(rows)
        print("UPSERT edildi")


if __name__ == "__main__":
    _test()
