"""EuroLeague / EuroCup box-score ingestion (api-live.euroleague.net v2).

Kimlik EL person.code (oyuncu) + club.code (takim) UZERINDEN kurulur -> isim
varyasyonu sorun degil, fuzzy-match GEREKMEZ. Veri euroleague.* semasina yazilir
(BSL'den TAMAMEN AYRI, bb_* model/analytics'e GIRMEZ). Idempotent upsert
(competition, season_code, game_code, person_code/team_code) -> duplicate OLMAZ.

Kaynak ACIK API: Cloudflare/geo/proxy YOK; lokalden bile calisir.
API:
  GET /v2/competitions/{E|U}/seasons/{E2025|U2025}/games         -> mac listesi (meta)
  GET /v2/competitions/{E|U}/seasons/{code}/games/{gc}/stats     -> {local,road}: players+total

Kullanim:
  python fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026 --dry-run --game 47
  python fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026          # tum sezon
  python fetch_euroleague.py --competition U --season-code U2025 --season-label 2025-2026          # EuroCup
"""
import argparse
import json
import os
import time
import urllib.request
from datetime import datetime

import psycopg2
from dotenv import load_dotenv

API = "https://api-live.euroleague.net/v2/competitions"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def api_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def i(x):
    return int(round(x)) if isinstance(x, (int, float)) else None


def to_date(s):
    return (s or "")[:19] or None


# stats alt-objesi -> db kolonlari
def stat_cols(s: dict) -> dict:
    sec = s.get("timePlayed")
    return {
        "seconds_played": i(sec),
        "minutes": round(sec / 60, 2) if isinstance(sec, (int, float)) else None,
        "points": i(s.get("points")),
        "fg2m": i(s.get("fieldGoalsMade2")), "fg2a": i(s.get("fieldGoalsAttempted2")),
        "fg3m": i(s.get("fieldGoalsMade3")), "fg3a": i(s.get("fieldGoalsAttempted3")),
        "ftm": i(s.get("freeThrowsMade")), "fta": i(s.get("freeThrowsAttempted")),
        "oreb": i(s.get("offensiveRebounds")), "dreb": i(s.get("defensiveRebounds")),
        "treb": i(s.get("totalRebounds")),
        "assists": i(s.get("assistances")), "steals": i(s.get("steals")),
        "turnovers": i(s.get("turnovers")),
        "blocks": i(s.get("blocksFavour")), "blocks_against": i(s.get("blocksAgainst")),
        "fouls_committed": i(s.get("foulsCommited")), "fouls_drawn": i(s.get("foulsReceived")),
        "valuation": i(s.get("valuation")), "plus_minus": i(s.get("plusMinus")),
    }


def team_stat_cols(t: dict) -> dict:
    c = stat_cols(t)
    for k in ("seconds_played", "minutes", "plus_minus"):
        c.pop(k, None)
    return c


def _team_dim(club, comp, scode, slabel):
    return {"competition": comp, "season_code": scode, "season_label": slabel,
            "team_code": club["code"], "team_name": club.get("name"),
            "abbr_name": club.get("abbreviatedName"), "editorial_name": club.get("editorialName"),
            "crest_url": (club.get("images") or {}).get("crest")}


def schedule_rows(meta: dict, comp: str, scode: str, slabel: str):
    """Program (fikstur) satiri: meta'dan game_row + team_dims (stats CAGRISI YOK).

    Oynanmamis maclarda skor NULL; oynanmislarda meta'daki score kullanilir.
    """
    home = meta["local"]["club"]
    away = meta["road"]["club"]
    played = bool(meta.get("played"))

    def score(side):
        return i(meta.get(side, {}).get("score")) if played else None

    game_row = {
        "competition": comp, "season_code": scode, "season_label": slabel,
        "game_code": meta["gameCode"], "identifier": meta.get("identifier"),
        "round": meta.get("round"), "phase_code": (meta.get("phaseType") or {}).get("code"),
        "phase_name": (meta.get("phaseType") or {}).get("name"),
        "game_date": to_date(meta.get("date") or meta.get("utcDate")), "played": played,
        "home_team_code": home["code"], "home_team_name": home.get("name"),
        "away_team_code": away["code"], "away_team_name": away.get("name"),
        "home_score": score("local"), "away_score": score("road"),
    }
    return game_row, [_team_dim(home, comp, scode, slabel), _team_dim(away, comp, scode, slabel)]


def normalize(meta: dict, stats: dict, comp: str, scode: str, slabel: str):
    gc = meta["gameCode"]
    home = meta["local"]["club"]
    away = meta["road"]["club"]
    rnd = meta.get("round")
    phase = (meta.get("phaseType") or {}).get("code")
    gdate = to_date(meta.get("date") or meta.get("utcDate"))
    hs = i((stats["local"]["total"] or {}).get("points"))
    as_ = i((stats["road"]["total"] or {}).get("points"))

    def crest(club):
        return (club.get("images") or {}).get("crest")

    team_dims = [
        {"competition": comp, "season_code": scode, "season_label": slabel,
         "team_code": home["code"], "team_name": home.get("name"), "abbr_name": home.get("abbreviatedName"),
         "editorial_name": home.get("editorialName"), "crest_url": crest(home)},
        {"competition": comp, "season_code": scode, "season_label": slabel,
         "team_code": away["code"], "team_name": away.get("name"), "abbr_name": away.get("abbreviatedName"),
         "editorial_name": away.get("editorialName"), "crest_url": crest(away)},
    ]
    game_row = {
        "competition": comp, "season_code": scode, "season_label": slabel, "game_code": gc,
        "identifier": meta.get("identifier"), "round": rnd,
        "phase_code": phase, "phase_name": (meta.get("phaseType") or {}).get("name"),
        "game_date": gdate, "played": meta.get("played"),
        "home_team_code": home["code"], "home_team_name": home.get("name"),
        "away_team_code": away["code"], "away_team_name": away.get("name"),
        "home_score": hs, "away_score": as_,
    }

    def base(team, opp, ha):
        return {"competition": comp, "season_code": scode, "season_label": slabel, "game_code": gc,
                "round": rnd, "phase_code": phase, "game_date": gdate,
                "team_code": team["code"], "team_name": team.get("name"), "home_away": ha,
                "opponent_code": opp["code"], "opponent_name": opp.get("name")}

    team_rows = []
    for side, team, opp, ha, tot, pts, opp_pts in [
        ("local", home, away, "Home", stats["local"]["total"], hs, as_),
        ("road", away, home, "Away", stats["road"]["total"], as_, hs),
    ]:
        r = base(team, opp, ha)
        r.update({"points": pts, "opp_points": opp_pts})
        r.update(team_stat_cols(tot or {}))
        team_rows.append(r)

    player_rows, player_dims = [], []
    for side, team, opp, ha in [("local", home, away, "Home"), ("road", away, home, "Away")]:
        for pl in stats[side]["players"] or []:
            s = pl.get("stats")
            if not s or not s.get("timePlayed"):
                continue  # oynamadi (DNP) -> atla
            per = pl["player"]["person"]
            pcode = per.get("code")
            if not pcode:
                continue
            pdim = {
                "competition": comp, "season_code": scode, "season_label": slabel, "person_code": pcode,
                "name": per.get("name"), "passport_name": per.get("passportName"),
                "passport_surname": per.get("passportSurname"),
                "country_code": (per.get("country") or {}).get("code"),
                "birth_date": to_date(per.get("birthDate")), "height": per.get("height"),
                "position_name": pl["player"].get("positionName"),
                "team_code": team["code"], "team_name": team.get("name"),
                "dorsal": str(pl["player"].get("dorsal") or "") or None,
                "image_url": (pl["player"].get("images") or {}).get("headshot"),
                "external_id": pl["player"].get("externalId"),
            }
            player_dims.append(pdim)
            row = base(team, opp, ha)
            row.update({
                "person_code": pcode, "player_name": per.get("name"),
                "identifier": meta.get("identifier"),
                "dorsal": pdim["dorsal"], "is_starter": bool(s.get("startFive")),
            })
            row.update(stat_cols(s))
            player_rows.append(row)
    return game_row, team_dims, team_rows, player_dims, player_rows


# ---------------- upsert ----------------
def _upsert(cur, table, cols, rows, conflict, updatable):
    if not rows:
        return
    setexpr = ", ".join(f"{c}=excluded.{c}" for c in updatable)
    ph = ",".join(["%s"] * len(cols))
    sql = (f"insert into {table} ({','.join(cols)}) values ({ph}) "
           f"on conflict ({conflict}) do update set {setexpr}, updated_at=now()")
    for r in rows:
        cur.execute(sql, [r.get(c) for c in cols])


TEAM_DIM_COLS = ["competition", "season_code", "season_label", "team_code", "team_name",
                 "abbr_name", "editorial_name", "crest_url"]
PLAYER_DIM_COLS = ["competition", "season_code", "season_label", "person_code", "name",
                   "passport_name", "passport_surname", "country_code", "birth_date", "height",
                   "position_name", "team_code", "team_name", "dorsal", "image_url", "external_id"]
GAME_COLS = ["competition", "season_code", "season_label", "game_code", "identifier", "round",
             "phase_code", "phase_name", "game_date", "played", "home_team_code", "home_team_name",
             "away_team_code", "away_team_name", "home_score", "away_score"]
TMS_COLS = ["competition", "season_code", "season_label", "game_code", "round", "phase_code",
            "game_date", "team_code", "team_name", "home_away", "opponent_code", "opponent_name",
            "points", "opp_points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
            "treb", "assists", "steals", "turnovers", "blocks", "blocks_against",
            "fouls_committed", "fouls_drawn", "valuation"]
PMS_COLS = ["competition", "season_code", "season_label", "game_code", "identifier", "round",
            "phase_code", "game_date", "person_code", "player_name", "team_code", "team_name",
            "home_away", "opponent_code", "opponent_name", "dorsal", "is_starter",
            "seconds_played", "minutes", "points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta",
            "oreb", "dreb", "treb", "assists", "steals", "turnovers", "blocks", "blocks_against",
            "fouls_committed", "fouls_drawn", "valuation", "plus_minus"]


def write_game(cur, gr, tdims, trows, pdims, prows):
    _upsert(cur, "euroleague.teams", TEAM_DIM_COLS, tdims, "competition,season_code,team_code",
            [c for c in TEAM_DIM_COLS if c not in ("competition", "season_code", "team_code")])
    _upsert(cur, "euroleague.players", PLAYER_DIM_COLS, pdims, "competition,season_code,person_code",
            [c for c in PLAYER_DIM_COLS if c not in ("competition", "season_code", "person_code")])
    _upsert(cur, "euroleague.games", GAME_COLS, [gr], "competition,season_code,game_code",
            [c for c in GAME_COLS if c not in ("competition", "season_code", "game_code")])
    _upsert(cur, "euroleague.team_match_stats", TMS_COLS, trows,
            "competition,season_code,game_code,team_code",
            [c for c in TMS_COLS if c not in ("competition", "season_code", "game_code", "team_code")])
    _upsert(cur, "euroleague.player_match_stats", PMS_COLS, prows,
            "competition,season_code,game_code,person_code",
            [c for c in PMS_COLS if c not in ("competition", "season_code", "game_code", "person_code")])


def run(args):
    here = os.path.dirname(__file__)
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    comp, scode, slabel = args.competition, args.season_code, args.season_label
    print(f"[el] competition={comp} season={scode} label={slabel} dry_run={args.dry_run}", flush=True)

    games = api_get(f"{API}/{comp}/seasons/{scode}/games")["data"]

    if args.schedule:
        print(f"[el] SCHEDULE modu: {len(games)} mac (oynanmamis dahil) game_row+team yazilacak", flush=True)
        conn = None if args.dry_run else psycopg2.connect(os.environ["DATABASE_URL"])
        n = 0
        for meta in games:
            gr, tdims = schedule_rows(meta, comp, scode, slabel)
            if args.dry_run:
                if n < 5:
                    print(f"  R{gr['round']} {gr['phase_code']} {gr['game_date']} "
                          f"{gr['home_team_name']} {gr['home_score']}-{gr['away_score']} "
                          f"{gr['away_team_name']} played={gr['played']}", flush=True)
            else:
                with conn.cursor() as cur:
                    _upsert(cur, "euroleague.teams", TEAM_DIM_COLS, tdims,
                            "competition,season_code,team_code",
                            [c for c in TEAM_DIM_COLS if c not in ("competition", "season_code", "team_code")])
                    _upsert(cur, "euroleague.games", GAME_COLS, [gr],
                            "competition,season_code,game_code",
                            [c for c in GAME_COLS if c not in ("competition", "season_code", "game_code")])
                conn.commit()
            n += 1
        if conn:
            conn.close()
        print(f"[el] SCHEDULE BITTI: {n} mac programi yazildi "
              f"({'DRY-RUN' if args.dry_run else 'DB'}).", flush=True)
        return

    if args.game:
        metas = [g for g in games if g.get("gameCode") == args.game]
    else:
        metas = [g for g in games if g.get("played")]
        if args.phase:
            metas = [g for g in metas if (g.get("phaseType") or {}).get("code") == args.phase]
        if args.limit:
            metas = metas[:args.limit]
    print(f"[el] {len(metas)} mac islenecek", flush=True)

    conn = None if args.dry_run else psycopg2.connect(os.environ["DATABASE_URL"])
    n_games = n_players = 0
    for k, meta in enumerate(metas, 1):
        gc = meta["gameCode"]
        try:
            stats = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}/stats")
        except Exception as e:
            print(f"[el]  mac {gc}: stats hata {e!r}, atlandi", flush=True)
            continue
        if not stats or "local" not in stats or not stats["local"].get("players"):
            print(f"[el]  mac {gc}: box yok, atlandi", flush=True)
            continue
        gr, tdims, trows, pdims, prows = normalize(meta, stats, comp, scode, slabel)
        n_games += 1
        n_players += len(prows)
        if args.dry_run:
            print(f"\n=== mac {gc} ({gr['identifier']}) R{gr['round']} {gr['phase_code']} "
                  f"{gr['home_team_name']} {gr['home_score']}-{gr['away_score']} {gr['away_team_name']} "
                  f"{gr['game_date']} ===", flush=True)
            print(f"  oyuncu: {len(prows)}", flush=True)
            for pr in prows[:3]:
                print(f"    [{pr['person_code']}] {pr['player_name']} ({pr['team_code']}) "
                      f"dk={pr['minutes']} sayi={pr['points']} rib={pr['treb']} as={pr['assists']} "
                      f"3s={pr['fg3m']}/{pr['fg3a']} val={pr['valuation']}", flush=True)
        else:
            with conn.cursor() as cur:
                write_game(cur, gr, tdims, trows, pdims, prows)
            conn.commit()
            if k % 20 == 0 or k == len(metas):
                print(f"[el]  {k}/{len(metas)} yuklendi", flush=True)
        time.sleep(args.sleep)
    if conn:
        conn.close()
    print(f"\n[el] BITTI: {n_games} mac, {n_players} oyuncu-satiri "
          f"({'DRY-RUN, DB yazilmadi' if args.dry_run else 'DB yazildi'}).", flush=True)


def main():
    ap = argparse.ArgumentParser(description="EuroLeague/EuroCup box-score ingestion")
    ap.add_argument("--competition", required=True, choices=["E", "U"], help="E=EuroLeague, U=EuroCup")
    ap.add_argument("--season-code", required=True, help="E2025 | U2025")
    ap.add_argument("--season-label", required=True, help="2025-2026")
    ap.add_argument("--phase", help="yalniz bu faz (RS/PO/FF)")
    ap.add_argument("--game", type=int, help="tek mac (gameCode) - test")
    ap.add_argument("--limit", type=int, help="ilk N mac - test")
    ap.add_argument("--schedule", action="store_true",
                    help="tum programi (oynanmamis dahil) game_row+team olarak yaz, stats CEKME")
    ap.add_argument("--sleep", type=float, default=0.15, help="istekler arasi sn")
    ap.add_argument("--dry-run", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
