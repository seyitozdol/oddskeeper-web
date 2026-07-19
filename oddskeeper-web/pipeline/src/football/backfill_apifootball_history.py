# -*- coding: utf-8 -*-
"""API-Football'dan Süper Lig geçmiş sezon backfill'i (2015..2024).

Doldurulan tablolar (source='apifootball'):
  - football.matches                     <- kestirim/data/raw/fixtures/203_<season>.json (lokal)
  - football.match_team_stats           <- kestirim/data/raw/statistics/<fixture>.json (lokal, eksikse API)
  - football.match_incidents            <- API /fixtures/events (disk cache'li)
  - football.match_player_stats_details <- API /fixtures/players (disk cache'li)

Kota koruması: /status'a göre günlük kullanım QUOTA_STOP'u aşınca API fazları durur;
cache sayesinde ertesi gün aynı komut kaldığı yerden devam eder.

Çalıştırma:
  .venv\\Scripts\\python.exe src\\football\\backfill_apifootball_history.py
"""
import json
import sys
import time
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]          # oddskeeper/
KESTIRIM = Path(r"C:\Users\zygom\PycharmProjects\kestirim")  # ham fixtures/statistics cache bu projede duruyor

ENV_ODDSKEEPER = dotenv_values(ROOT / ".env")
ENV_KESTIRIM = dotenv_values(KESTIRIM / ".env")

SUPABASE_URL = (ENV_ODDSKEEPER.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV_ODDSKEEPER.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')
API_KEY = (ENV_KESTIRIM.get("API_FOOTBALL_KEY") or "").strip().strip('"')

API_BASE = "https://v3.football.api-sports.io"
SOURCE = "apifootball"
LEAGUE_ID = 203
SEASONS = list(range(2015, 2025))                    # 2015..2024 (geçmiş sezonlar)
FINISHED = {"FT", "AET", "PEN", "AWD", "WO"}
QUOTA_STOP = 6800                                    # günlük 7500'ün altında yedek bırak

FIXTURES_DIR = KESTIRIM / "data" / "raw" / "fixtures"
STATS_DIR = KESTIRIM / "data" / "raw" / "statistics"
CACHE_DIR = ROOT / "data" / "apifootball"
EVENTS_DIR = CACHE_DIR / "events"
PLAYERS_DIR = CACHE_DIR / "players"
STATS_EXTRA_DIR = CACHE_DIR / "statistics"
for p in (EVENTS_DIR, PLAYERS_DIR, STATS_EXTRA_DIR):
    p.mkdir(parents=True, exist_ok=True)

_MIN_INTERVAL = 0.15
_last_call = [0.0]
_api_calls = [0]


class QuotaReached(Exception):
    pass


def api_fetch(path: str, max_retries: int = 4) -> dict:
    headers = {"x-apisports-key": API_KEY}
    attempt = 0
    while True:
        dt = time.monotonic() - _last_call[0]
        if dt < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - dt)
        _last_call[0] = time.monotonic()
        try:
            r = requests.get(f"{API_BASE}{path}", headers=headers, timeout=30)
        except requests.RequestException as e:
            attempt += 1
            if attempt > max_retries:
                raise RuntimeError(f"Ağ hatası: {e}")
            time.sleep(2 ** attempt)
            continue
        if r.status_code == 429:
            time.sleep(61)
            continue
        if r.status_code >= 500:
            attempt += 1
            if attempt > max_retries:
                raise RuntimeError(f"{r.status_code}: {path}")
            time.sleep(2 ** attempt)
            continue
        if r.status_code != 200:
            raise RuntimeError(f"{r.status_code}: {path}")
        data = r.json()
        errors = data.get("errors")
        if (isinstance(errors, dict) and errors) or (isinstance(errors, list) and errors):
            raise RuntimeError(f"API errors {path}: {json.dumps(errors)}")
        _api_calls[0] += 1
        return data


def quota_used() -> int:
    d = api_fetch("/status")
    return int(d["response"]["requests"]["current"])


def cached_fetch(path: str, cache_file: Path) -> dict:
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    data = api_fetch(path)
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def upsert(table: str, rows: list, conflict_cols: str) -> None:
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={conflict_cols}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Profile": "football",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        r = requests.post(url, headers=headers, data=json.dumps(chunk), timeout=60)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"upsert {table} hata {r.status_code}: {r.text[:300]}")


def load_fixtures() -> dict:
    """{fixture_id(str): fixture_kaydı} — sadece bitmiş maçlar."""
    fixtures = {}
    for season in SEASONS:
        f = FIXTURES_DIR / f"{LEAGUE_ID}_{season}.json"
        if not f.exists():
            print(f"UYARI: {f.name} yok, sezon atlandı")
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        for item in data.get("response", []):
            status = ((item.get("fixture") or {}).get("status") or {}).get("short")
            if status in FINISHED:
                item["_season"] = season
                fixtures[str(item["fixture"]["id"])] = item
    return fixtures


def match_row(item: dict) -> dict:
    fx = item["fixture"]
    teams = item["teams"]
    goals = item["goals"]
    home, away = teams["home"], teams["away"]
    winner_side = "home" if home.get("winner") else ("away" if away.get("winner") else None)
    winner_id = str(home["id"]) if winner_side == "home" else (str(away["id"]) if winner_side == "away" else None)
    venue = (fx.get("venue") or {}).get("name")
    ts = fx.get("timestamp")
    return {
        "source": SOURCE,
        "source_match_id": str(fx["id"]),
        "competition": (item.get("league") or {}).get("name") or "Süper Lig",
        "match_datetime": fx.get("date"),
        "match_date_text": fx.get("date"),
        "raw_match_date_ms": ts * 1000 if ts else None,
        "home_team_source_id": str(home["id"]),
        "away_team_source_id": str(away["id"]),
        "home_team_name": home["name"],
        "away_team_name": away["name"],
        "home_score": goals.get("home"),
        "away_score": goals.get("away"),
        "winner_team_source_id": winner_id,
        "winner_side": winner_side,
        "venue": venue,
        "referee": fx.get("referee"),
    }


def _num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    s = str(v).strip().rstrip("%")
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


def result_code(sf, sa):
    if sf is None or sa is None:
        return None
    return "W" if sf > sa else ("L" if sf < sa else "D")


STAT_MAP = {
    "Shots on Goal": "summary_shots_on_target",
    "Total Shots": "summary_shots",
    "Blocked Shots": "summary_blocked_shots",
    "Shots insidebox": "details_attempts_ibox",
    "Shots outsidebox": "details_attempts_obox",
    "Fouls": "summary_fouls_conceded",
    "Corner Kicks": "summary_corners_won",
    "Offsides": "summary_offsides",
    "Yellow Cards": "summary_yellow_cards",
    "Red Cards": "summary_red_cards",
    "Goalkeeper Saves": "summary_saves",
    "Total passes": "summary_passes",
    "Passes accurate": "details_accurate_pass",
    "expected_goals": "details_expected_goals",
}


def team_stats_rows(item: dict, stats_data: dict) -> list:
    fx_id = str(item["fixture"]["id"])
    home_id = str(item["teams"]["home"]["id"])
    goals = item["goals"]
    rows = []
    for entry in stats_data.get("response", []):
        team = entry.get("team") or {}
        tid = str(team.get("id"))
        side = "home" if tid == home_id else "away"
        opp = item["teams"]["away"] if side == "home" else item["teams"]["home"]
        sf = goals.get("home") if side == "home" else goals.get("away")
        sa = goals.get("away") if side == "home" else goals.get("home")
        row = {
            "source": SOURCE,
            "source_match_id": fx_id,
            "source_team_id": tid,
            "team_name": team.get("name"),
            "team_side": side,
            "opponent_team_source_id": str(opp["id"]),
            "opponent_team_name": opp["name"],
            "competition": (item.get("league") or {}).get("name") or "Süper Lig",
            "match_datetime": item["fixture"].get("date"),
            "score_for": sf,
            "score_against": sa,
            "result_code": result_code(sf, sa),
            "summary_goals": sf,
            "raw_summary_totals": {s["type"]: s["value"] for s in (entry.get("statistics") or [])},
        }
        for col in STAT_MAP.values():
            row[col] = None
        for s in entry.get("statistics") or []:
            col = STAT_MAP.get(s.get("type"))
            if col:
                val = _num(s.get("value"))
                if col == "details_expected_goals":
                    row[col] = val
                else:
                    row[col] = int(val) if val is not None else None
        rows.append(row)
    return rows


def incident_rows(item: dict, events_data: dict) -> list:
    fx_id = str(item["fixture"]["id"])
    home_id = str(item["teams"]["home"]["id"])
    rows = []
    for i, ev in enumerate(events_data.get("response", [])):
        tid = str((ev.get("team") or {}).get("id"))
        side = "home" if tid == home_id else "away"
        t = ev.get("time") or {}
        elapsed = t.get("elapsed")
        extra = t.get("extra")
        minute_text = f"{elapsed}+{extra}" if extra else (str(elapsed) if elapsed is not None else None)
        minute_sort = (elapsed * 100 + (extra or 0)) if elapsed is not None else None
        etype = (ev.get("type") or "").strip().lower() or None
        player = (ev.get("player") or {}).get("name")
        assist = (ev.get("assist") or {}).get("name")
        players = [p for p in (player, assist) if p]
        rows.append({
            "source": SOURCE,
            "source_match_id": fx_id,
            "incident_key": f"{i:03d}-{side}-{etype or 'na'}-{minute_text or 'na'}",
            "side": side,
            "event_type_code": etype,
            "event_title": ev.get("detail"),
            "minute_text": minute_text,
            "minute_sort": minute_sort,
            "player_texts": players,
            "primary_player_text": player,
            "secondary_player_text": assist,
            "raw_text": ev.get("comments"),
        })
    return rows


def player_stats_rows(item: dict, players_data: dict) -> list:
    fx_id = str(item["fixture"]["id"])
    home_id = str(item["teams"]["home"]["id"])
    rows = []
    seen = set()
    for entry in players_data.get("response", []):
        team = entry.get("team") or {}
        tid = str(team.get("id"))
        side = "home" if tid == home_id else "away"
        for p in entry.get("players") or []:
            info = p.get("player") or {}
            pid = str(info.get("id"))
            if not pid or pid in seen:
                continue
            seen.add(pid)
            stats = (p.get("statistics") or [{}])[0]
            games = stats.get("games") or {}
            passes = stats.get("passes") or {}
            minutes = games.get("minutes")
            rows.append({
                "source": SOURCE,
                "source_match_id": fx_id,
                "source_team_id": tid,
                "team_name": team.get("name"),
                "source_player_id": pid,
                "player_name": info.get("name"),
                "player_side": side,
                "lineup_status": (
                    "substitute" if games.get("substitute")
                    else ("starter" if minutes else "bench")
                ),
                "position_code": games.get("position"),
                "accurate_pass": _num(passes.get("accuracy")) if isinstance(_num(passes.get("accuracy")), int) else None,
                "raw_stats": stats,
            })
    return rows


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else "all"   # all | matches | teamstats | events | players

    if not (SUPABASE_URL and SUPABASE_KEY and API_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY / API_FOOTBALL_KEY")

    fixtures = load_fixtures()
    print(f"Bitmiş maç sayısı ({SEASONS[0]}..{SEASONS[-1]}): {len(fixtures)}", flush=True)

    # Faz 1: matches (lokal)
    if only in ("all", "matches"):
        rows = [match_row(item) for item in fixtures.values()]
        upsert("matches", rows, "source,source_match_id")
        print(f"[matches] {len(rows)} satır upsert edildi", flush=True)

    # Faz 2: team stats (lokal + eksikler API)
    if only in ("all", "teamstats"):
        rows, missing = [], []
        for fx_id, item in fixtures.items():
            f = STATS_DIR / f"{fx_id}.json"
            if not f.exists():
                f = STATS_EXTRA_DIR / f"{fx_id}.json"
            if f.exists():
                rows.extend(team_stats_rows(item, json.loads(f.read_text(encoding="utf-8"))))
            else:
                missing.append(fx_id)
        print(f"[teamstats] lokalden {len(rows)} satır, eksik istatistik: {len(missing)} maç", flush=True)
        if missing:
            used = quota_used()
            for n, fx_id in enumerate(missing):
                if used + _api_calls[0] >= QUOTA_STOP:
                    print(f"[teamstats] kota sınırı, {len(missing)-n} maç sonraya kaldı", flush=True)
                    break
                data = cached_fetch(f"/fixtures/statistics?fixture={fx_id}", STATS_EXTRA_DIR / f"{fx_id}.json")
                rows.extend(team_stats_rows(fixtures[fx_id], data))
        upsert("match_team_stats", rows, "source,source_match_id,source_team_id")
        print(f"[teamstats] toplam {len(rows)} satır upsert edildi", flush=True)

    # Faz 3 & 4: API tabanlı fazlar
    for phase, dir_, endpoint, builder, table, conflict in (
        ("events", EVENTS_DIR, "/fixtures/events?fixture=", incident_rows,
         "match_incidents", "source,source_match_id,incident_key"),
        ("players", PLAYERS_DIR, "/fixtures/players?fixture=", player_stats_rows,
         "match_player_stats_details", "source,source_match_id,source_player_id"),
    ):
        if only not in ("all", phase):
            continue
        used = quota_used()
        print(f"[{phase}] başlıyor, günlük kota: {used}/{QUOTA_STOP}", flush=True)
        buffer, done, skipped = [], 0, 0
        ids = sorted(fixtures.keys(), key=lambda x: int(x))
        try:
            for n, fx_id in enumerate(ids, 1):
                cache = dir_ / f"{fx_id}.json"
                if not cache.exists() and used + _api_calls[0] >= QUOTA_STOP:
                    raise QuotaReached()
                data = cached_fetch(f"{endpoint}{fx_id}", cache)
                if not data.get("response"):
                    skipped += 1
                else:
                    buffer.extend(builder(fixtures[fx_id], data))
                done += 1
                if len(buffer) >= 2000:
                    upsert(table, buffer, conflict)
                    buffer = []
                if n % 200 == 0:
                    print(f"[{phase}] {n}/{len(ids)} maç işlendi (API çağrısı: {_api_calls[0]})", flush=True)
        except QuotaReached:
            print(f"[{phase}] kota sınırına gelindi, {len(ids)-done} maç sonraya kaldı", flush=True)
        upsert(table, buffer, conflict)
        print(f"[{phase}] bitti: {done} maç işlendi, {skipped} maçta veri yok", flush=True)

    print(f"TAMAM. Bu koşuda API çağrısı: {_api_calls[0]}", flush=True)


if __name__ == "__main__":
    main()
