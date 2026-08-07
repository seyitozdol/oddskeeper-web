# -*- coding: utf-8 -*-
"""FlashScore oyuncu-mac istatistik yukleyicisi (kaynak: pq_graphql epmsse+epmsd).

Girdi klasorunde:
  <prefix>_index.json          : [{mid,h,a,dt,sc,hdr}, ...]
  <prefix>_m_<mid>.json        : {ix, se: {findEventPMSById: teams/players}, d: {findEventPMSById: stats.entries/ratings}}

Doldurulan tablolar (source='flashscore'):
  - football.matches                    (on_conflict: source,source_match_id)
  - football.match_player_stats_details (on_conflict: source,source_match_id,source_player_id)
    raw_stats = {typeId: rawValue} + _rating/_position/_inBaseLineup

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\load_flashscore_player_stats.py <klasor> <season_label> <lig adi>
  or. ... data\\flashscore\\1lig_2024-25 "2024/2025" "Trendyol 1. Lig"
"""
import json
import sys
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
SUPABASE_URL = (ENV.get("SUPABASE_URL") or "").strip().strip('"')
SUPABASE_KEY = (ENV.get("SUPABASE_SECRET_KEY") or "").strip().strip('"')

SOURCE = "flashscore"
PLAYOFF_HDRS = {"Final", "Semi-finals", "Quarter-finals", "Qualification Round 1", "Qualification Round 2"}


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


def iso_from_dt(dt_text: str, season_label: str) -> str | None:
    # Formatlar: 'DD.MM.YYYY', 'DD.MM. HH:MM' (guncel yil gosterilmez), 'DD.MM.YYYY HH:MM'
    import re
    m = re.match(r"^(\d{2})\.(\d{2})\.\s*(\d{4})?\s*(\d{2}:\d{2})?$", (dt_text or "").strip())
    if not m:
        return None
    day, mon, year, hhmm = m.groups()
    if not year:
        # sezon 'YYYY/YYYY+1': Tem-Ara ilk yil, Oca-Haz ikinci yil
        y1 = int(season_label.split("/")[0])
        year = str(y1 if int(mon) >= 7 else y1 + 1)
    return f"{year}-{mon}-{day}T{hhmm or '00:00'}:00Z"


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def load_folder(folder, season_label, competition, do_refresh=True, dry_run=False):
    """<folder>/*_m_*.json dosyalarini football.matches + match_player_stats_details'e
    yazar (source='flashscore'). do_refresh=tff1 mat'larini tazele; dry_run=DB'ye yazma.
    Hem CLI main() hem canli fetch_flashscore_matches.py bunu cagirir."""
    folder = Path(folder)
    m_rows, p_rows = [], []
    empty = 0
    files = sorted(folder.glob("*_m_*.json"))
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        ix = data.get("ix") or {}
        se = ((data.get("se") or {}).get("findEventPMSById")) or {}
        d = ((data.get("d") or {}).get("findEventPMSById")) or {}
        mid = ix.get("mid") or f.stem.split("_m_")[-1]
        teams = {t.get("side"): t for t in se.get("teams") or []}
        players = se.get("players") or []
        if not players:
            empty += 1
            continue
        home, away = teams.get("HOME") or {}, teams.get("AWAY") or {}
        sc = ix.get("sc") or []
        hs = _num(sc[0]) if len(sc) > 0 else None
        as_ = _num(sc[1]) if len(sc) > 1 else None
        playoff = (ix.get("hdr") or "") in PLAYOFF_HDRS
        winner_side = None
        if hs is not None and as_ is not None and hs != as_:
            winner_side = "home" if hs > as_ else "away"
        m_rows.append({
            "source": SOURCE,
            "source_match_id": mid,
            "competition": competition + (" Play-off" if playoff else ""),
            "season_label": season_label,
            "match_datetime": iso_from_dt(ix.get("dt"), season_label),
            "match_date_text": ix.get("dt"),
            "home_team_source_id": home.get("id"),
            "away_team_source_id": away.get("id"),
            "home_team_name": home.get("name") or ix.get("h"),
            "away_team_name": away.get("name") or ix.get("a"),
            "home_score": hs,
            "away_score": as_,
            "winner_side": winner_side,
            "winner_team_source_id": (home.get("id") if winner_side == "home"
                                      else away.get("id") if winner_side == "away" else None),
        })

        # istatistik degerleri oyuncuya grupla
        stats_by_player = {}
        for e in ((d.get("stats") or {}).get("entries")) or []:
            pid = e.get("playerId")
            if pid:
                stats_by_player.setdefault(pid, {})[e.get("typeId")] = e.get("rawValue")
        ratings = {}
        for e in d.get("ratings") or []:
            pid = e.get("participantId")
            if pid:
                ratings[pid] = e.get("value")

        for p in players:
            part = p.get("participant") or {}
            pid = part.get("id")
            if not pid:
                continue
            st = stats_by_player.get(pid, {})
            raw = dict(st)
            if pid in ratings:
                raw["_rating"] = ratings[pid]
            pos = (p.get("position") or {}).get("name")
            if pos:
                raw["_position"] = pos
            raw["_inBaseLineup"] = bool(p.get("inBaseLineup"))
            minutes = _num(st.get("MATCH_MINUTES_PLAYED")) or 0
            if p.get("inBaseLineup"):
                status = "starter"
            else:
                status = "substitute" if minutes > 0 else "bench"
            side = "home" if p.get("teamId") == home.get("id") else "away"
            team = home if side == "home" else away
            p_rows.append({
                "source": SOURCE,
                "source_match_id": mid,
                "source_team_id": p.get("teamId"),
                "team_name": team.get("name"),
                "source_player_id": pid,
                "player_name": part.get("name"),
                "player_side": side,
                "lineup_status": status,
                "position_code": pos,
                "expected_goals": _num(st.get("EXPECTED_GOALS")),
                "attempts_ibox": _num(st.get("SHOTS_BOX_IN")),
                "attempts_obox": _num(st.get("SHOTS_BOX_OUT")),
                "headed_shots": _num(st.get("SHOTS_HEAD")),
                "hit_woodwork": _num(st.get("HIT_WOODWORK")),
                "accurate_pass": _num(st.get("PASSES_ACCURATE")) if isinstance(_num(st.get("PASSES_ACCURATE")), int) else None,
                "raw_stats": raw,
            })

    dedup = {}
    for r in p_rows:
        dedup[(r["source_match_id"], r["source_player_id"])] = r
    p_rows = list(dedup.values())
    print(f"Dosya: {len(files)}, oyuncusuz mac: {empty}, mac satiri: {len(m_rows)}, oyuncu satiri: {len(p_rows)}", flush=True)
    if dry_run:
        sample = next((r for r in p_rows if r.get("expected_goals") is not None), None)
        print(f"[dry-run] upsert atlandi; ornek xG: "
              f"{sample and sample.get('player_name')} = {sample and sample.get('expected_goals')}", flush=True)
        return len(m_rows), len(p_rows)
    upsert("matches", m_rows, "source,source_match_id")
    print(f"[matches] {len(m_rows)} upsert", flush=True)
    upsert("match_player_stats_details", p_rows, "source,source_match_id,source_player_id")
    print(f"[players] {len(p_rows)} upsert", flush=True)
    if do_refresh:
        refresh_mats()
    return len(m_rows), len(p_rows)


def main():
    if len(sys.argv) < 4:
        raise SystemExit("Kullanim: load_flashscore_player_stats.py <klasor> <season_label> <lig adi>")
    folder = Path(sys.argv[1])
    if not folder.is_dir():
        raise SystemExit(f"Klasor yok: {folder}")
    if not (SUPABASE_URL and SUPABASE_KEY):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY")
    load_folder(folder, sys.argv[2], sys.argv[3])


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
