"""Turkiye Kupasi maclarini + takim istatistiklerini Mackolik uygulama API'sinden
cekip football.mackolik_matches + football.mackolik_team_stats tablolarina yazar.

Kullanim:
    python src/football/load_mackolik_cup.py --season 2025/2026
    python src/football/load_mackolik_cup.py --season-id 25033
    python src/football/load_mackolik_cup.py --season 2025/2026 --limit 5   # test
    python src/football/load_mackolik_cup.py --last2                        # son 2 sezon

Idempotent: tekrar kosulunca upsert eder.
"""
import os
import sys
import time
import argparse

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_mackolik_app as mk  # noqa: E402

PIPELINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV = dotenv_values(os.path.join(PIPELINE_DIR, ".env"))


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def upsert_match(cur, comp, season, m, raw):
    ta = m.get("team_A") or {}
    tb = m.get("team_B") or {}
    rnd = m.get("round") or {}
    dt = m.get("date_time_utc")
    dt = (dt + "+00") if dt else None
    md = (raw or {}).get("match") or {}
    cur.execute(
        """
        insert into football.mackolik_matches (
            match_uuid, source, competition_uuid, competition_name, season_id, season_name,
            match_numeric_id, rb_id, round_id, round_name, match_datetime, status,
            team_a_id, team_a_uuid, team_a_name, team_b_id, team_b_uuid, team_b_name,
            score_a, score_b, ht_score_a, ht_score_b, round_winner_id, raw, updated_at
        ) values (
            %(match_uuid)s,'mackolik_app',%(competition_uuid)s,%(competition_name)s,%(season_id)s,%(season_name)s,
            %(match_numeric_id)s,%(rb_id)s,%(round_id)s,%(round_name)s,%(match_datetime)s,%(status)s,
            %(team_a_id)s,%(team_a_uuid)s,%(team_a_name)s,%(team_b_id)s,%(team_b_uuid)s,%(team_b_name)s,
            %(score_a)s,%(score_b)s,%(ht_score_a)s,%(ht_score_b)s,%(round_winner_id)s,%(raw)s, now()
        )
        on conflict (match_uuid) do update set
            competition_name=excluded.competition_name, season_id=excluded.season_id,
            season_name=excluded.season_name, match_numeric_id=excluded.match_numeric_id,
            rb_id=excluded.rb_id, round_id=excluded.round_id, round_name=excluded.round_name,
            match_datetime=excluded.match_datetime, status=excluded.status,
            team_a_id=excluded.team_a_id, team_a_uuid=excluded.team_a_uuid, team_a_name=excluded.team_a_name,
            team_b_id=excluded.team_b_id, team_b_uuid=excluded.team_b_uuid, team_b_name=excluded.team_b_name,
            score_a=excluded.score_a, score_b=excluded.score_b,
            ht_score_a=excluded.ht_score_a, ht_score_b=excluded.ht_score_b,
            round_winner_id=excluded.round_winner_id,
            raw=coalesce(excluded.raw, football.mackolik_matches.raw), updated_at=now()
        """,
        dict(
            match_uuid=m["uuid"], competition_uuid=comp["uuid"],
            competition_name=comp.get("name"), season_id=season["id"], season_name=season.get("name"),
            match_numeric_id=_int(m.get("id")), rb_id=_int(md.get("rb_id")),
            round_id=_int(rnd.get("id")), round_name=rnd.get("name"),
            match_datetime=dt, status=m.get("status"),
            team_a_id=_int(ta.get("id")), team_a_uuid=ta.get("uuid"), team_a_name=ta.get("name"),
            team_b_id=_int(tb.get("id")), team_b_uuid=tb.get("uuid"), team_b_name=tb.get("name"),
            score_a=_int(m.get("fts_A")), score_b=_int(m.get("fts_B")),
            ht_score_a=_int(m.get("hts_A")), ht_score_b=_int(m.get("hts_B")),
            round_winner_id=_int(m.get("round_winner")),
            raw=psycopg2.extras.Json(raw) if raw is not None else None,
        ),
    )


def upsert_team_stats(cur, match_uuid, stats):
    rows = [(match_uuid, k, a, b) for k, (a, b) in stats.items()]
    if not rows:
        return 0
    psycopg2.extras.execute_values(
        cur,
        """
        insert into football.mackolik_team_stats (match_uuid, stat_type, value_a, value_b, updated_at)
        values %s
        on conflict (match_uuid, stat_type) do update set
            value_a=excluded.value_a, value_b=excluded.value_b, updated_at=now()
        """,
        rows, template="(%s,%s,%s,%s, now())",
    )
    return len(rows)


def load_season(season_id, only_played=True, sleep=0.7, limit=None):
    d = mk.get_competition(mk.CUP_COMPETITION_UUID, season_id)
    comp = d["competition"]
    season = next((s for s in comp.get("seasons", []) if str(s["id"]) == str(season_id)), {"id": season_id})
    matches = []
    for gs in d.get("gamesets") or []:
        matches.extend(gs.get("matches") or [])
    if limit:
        matches = matches[:limit]
    print(f"[{season.get('name', season_id)}] {len(matches)} mac bulundu (season_id={season_id})")

    conn = psycopg2.connect(ENV["DATABASE_URL"])
    cur = conn.cursor()
    ok = stat_rows = skipped = errors = 0
    for i, m in enumerate(matches, 1):
        uuid = m.get("uuid")
        played = (m.get("status") == "Played")
        raw = None
        stats = {}
        try:
            if played or not only_played:
                raw = mk.get_match_detail(uuid)
                stats = mk.extract_team_stats(raw)
            upsert_match(cur, comp, season, m, raw)
            n = upsert_team_stats(cur, uuid, stats)
            conn.commit()
            ok += 1
            stat_rows += n
            if not played:
                skipped += 1
            if i % 20 == 0 or i == len(matches):
                print(f"  {i}/{len(matches)} islendi (stat satiri: {stat_rows})")
        except Exception as e:  # noqa: BLE001
            conn.rollback()
            errors += 1
            print(f"  HATA mac {uuid}: {str(e)[:120]}")
        if played or not only_played:
            time.sleep(sleep)
    cur.close()
    conn.close()
    print(f"[{season.get('name', season_id)}] bitti: {ok} mac, {stat_rows} stat satiri, {skipped} oynanmamis, {errors} hata")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", help="ornek: 2025/2026")
    ap.add_argument("--season-id", type=int)
    ap.add_argument("--last2", action="store_true", help="son 2 sezon (2025/2026 + 2024/2025)")
    ap.add_argument("--limit", type=int, default=None, help="test icin ilk N mac")
    ap.add_argument("--sleep", type=float, default=0.7)
    ap.add_argument("--all-status", action="store_true", help="oynanmamis maclarin da detayini cek")
    args = ap.parse_args()

    if args.last2:
        seasons = [mk.CUP_SEASONS["2025/2026"], mk.CUP_SEASONS["2024/2025"]]
    elif args.season_id:
        seasons = [args.season_id]
    elif args.season:
        seasons = [mk.CUP_SEASONS[args.season]]
    else:
        ap.error("--season / --season-id / --last2 birini ver")

    for sid in seasons:
        load_season(sid, only_played=not args.all_status, sleep=args.sleep, limit=args.limit)


if __name__ == "__main__":
    main()
