# -*- coding: utf-8 -*-
"""SofaScore Trendyol 1. Lig 2025/26 oyuncu mac istatistik yukleyicisi.

Girdi: tarayici same-origin fetch isiyle indirilen JSON dosyalari
  (SOFA_DIR ortam degiskeni ya da varsayilan scratchpad/sofa klasoru):
  - events_*.json  : hafta basina SofaScore event listesi
  - lineup_<id>.json : mac basina /event/<id>/lineups cevabi

Doldurulan tablolar (source='sofascore'):
  - football.matches                    (on_conflict: source,source_match_id)
  - football.match_player_stats_details (on_conflict: source,source_match_id,source_player_id)

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\load_sofascore_1lig_player_stats.py <sofa_klasoru> <season_label> [lig adi]
  (lig adi varsayilan 'Trendyol 1. Lig'; Super Lig icin 'Süper Lig' verilir)
"""
import json
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
COMPETITION = "Trendyol 1. Lig"
SEASON_LABEL = "2025/2026"  # CLI 2. arguman ile ezilir


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
        r = requests.post(url, headers=headers, data=json.dumps(chunk), timeout=120)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"upsert {table} hata {r.status_code}: {r.text[:300]}")


def iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def match_row(ev: dict, playoff: bool = False) -> dict:
    home, away = ev["homeTeam"], ev["awayTeam"]
    hs = (ev.get("homeScore") or {}).get("current")
    as_ = (ev.get("awayScore") or {}).get("current")
    wc = ev.get("winnerCode")  # 1=home 2=away 3=draw
    winner_side = "home" if wc == 1 else ("away" if wc == 2 else None)
    winner_id = str(home["id"]) if wc == 1 else (str(away["id"]) if wc == 2 else None)
    ts = ev.get("startTimestamp")
    slug = ev.get("slug") or ""
    custom = ev.get("customId") or ""
    url = f"https://www.sofascore.com/match/{slug}/{custom}#id:{ev['id']}" if slug and custom else None
    return {
        "source": SOURCE,
        "source_match_id": str(ev["id"]),
        "competition": COMPETITION + (" Play-off" if playoff else ""),
        "season_label": SEASON_LABEL,
        "match_datetime": iso(ts) if ts else None,
        "match_date_text": iso(ts) if ts else None,
        "raw_match_date_ms": ts * 1000 if ts else None,
        "match_url": url,
        "home_team_source_id": str(home["id"]),
        "away_team_source_id": str(away["id"]),
        "home_team_name": home.get("name"),
        "away_team_name": away.get("name"),
        "home_score": hs,
        "away_score": as_,
        "winner_team_source_id": winner_id,
        "winner_side": winner_side,
    }


def _int(v):
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def player_rows(ev: dict, lineup: dict) -> list:
    rows = []
    for side in ("home", "away"):
        team = ev["homeTeam"] if side == "home" else ev["awayTeam"]
        block = lineup.get(side) or {}
        for p in block.get("players") or []:
            info = p.get("player") or {}
            pid = info.get("id")
            if pid is None:
                continue
            stats = p.get("statistics") or {}
            minutes = stats.get("minutesPlayed") or 0
            if p.get("substitute"):
                status = "substitute" if minutes > 0 else "bench"
            else:
                status = "starter"
            raw = dict(stats)
            for k in ("substitute", "captain", "shirtNumber", "jerseyNumber"):
                if p.get(k) is not None:
                    raw[k] = p[k]
            if info.get("position"):
                raw["position"] = info["position"]
            rows.append({
                "source": SOURCE,
                "source_match_id": str(ev["id"]),
                # DIKKAT: p['teamId'] oyuncunun GUNCEL kulubu (transferde yaniltir);
                # macin kendi takim id'si event'ten alinir.
                "source_team_id": str(team["id"]),
                "team_name": team.get("name"),
                "source_player_id": str(pid),
                "player_name": info.get("name"),
                "player_side": side,
                "lineup_status": status,
                "position_code": info.get("position"),
                "accurate_pass": _int(stats.get("accuratePass")),
                "hit_woodwork": _int(stats.get("hitWoodwork")),
                "expected_goals": stats.get("expectedGoals"),
                "raw_stats": raw,
            })
    return rows


def main():
    global SEASON_LABEL, COMPETITION
    sofa_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if len(sys.argv) > 2:
        SEASON_LABEL = sys.argv[2]
    if len(sys.argv) > 3:
        COMPETITION = sys.argv[3]
    if not sofa_dir or not sofa_dir.is_dir():
        raise SystemExit("Kullanim: load_sofascore_1lig_player_stats.py <sofa_json_klasoru> [season_label]")
    if not (SUPABASE_URL and SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY")

    events = {}
    playoff_ids = set()
    for f in sorted(sofa_dir.glob("events_*.json")):
        po = f.name.startswith("events_po")
        for ev in json.loads(f.read_text(encoding="utf-8")):
            if (ev.get("status") or {}).get("type") == "finished":
                events[ev["id"]] = ev
                if po:
                    playoff_ids.add(ev["id"])
    print(f"Bitmis mac: {len(events)} (play-off: {len(playoff_ids)})", flush=True)

    m_rows = [match_row(ev, ev["id"] in playoff_ids) for ev in events.values()]
    upsert("matches", m_rows, "source,source_match_id")
    print(f"[matches] {len(m_rows)} satir upsert edildi", flush=True)

    p_rows = []
    missing = []
    for eid, ev in events.items():
        lf = sofa_dir / f"lineup_{eid}.json"
        if not lf.exists():
            missing.append(eid)
            continue
        p_rows.extend(player_rows(ev, json.loads(lf.read_text(encoding="utf-8"))))
    if missing:
        print(f"UYARI: {len(missing)} mac icin lineup dosyasi yok: {missing[:10]}", flush=True)

    # ayni anahtara iki satir upsert'i patlatir; tekillestir (son kazanir)
    dedup = {}
    for r in p_rows:
        dedup[(r["source_match_id"], r["source_player_id"])] = r
    p_rows = list(dedup.values())
    upsert("match_player_stats_details", p_rows, "source,source_match_id,source_player_id")
    print(f"[players] {len(p_rows)} satir upsert edildi", flush=True)
    refresh_mats()


def refresh_mats():
    """tff1 mat'larini tazele (frontend mat okur)."""
    try:
        import psycopg2
        conn = psycopg2.connect((ENV.get("DATABASE_URL") or "").strip().strip('"'))
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("refresh materialized view analytics.tff1_player_season_stats_mat")
        cur.execute("refresh materialized view analytics.tff1_team_season_stats_mat")
        cur.execute("refresh materialized view analytics.tff1_player_match_log_mat")
        cur.execute("refresh materialized view analytics.tff1_pm_player_season_mat")
        cur.execute("refresh materialized view analytics.tff1_squad_mat")
        print("[mat] tff1 materialized view'lar tazelendi", flush=True)
    except Exception as e:  # noqa
        print(f"UYARI: mat refresh basarisiz: {e}", flush=True)


if __name__ == "__main__":
    main()
