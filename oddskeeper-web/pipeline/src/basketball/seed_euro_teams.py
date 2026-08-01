"""EuroLeague/EuroCup bir sezonun TAKIMLARINI euroleague.teams'e seed'ler (maç yok).
Yeni sezon standings'te takimlarin 0-degerle gorunmesi icin (oyunlar oynanmadan).
Loader (fetch_euroleague.py) yalniz oynanmis maci yazar, o yuzden takim seed'i ayri.

Kullanim: python seed_euro_teams.py --season-code E2026 --season-label 2026-2027
          python seed_euro_teams.py --season-code U2026 --season-label 2026-2027
"""
import argparse
import json
import os
import urllib.request

import psycopg2
from dotenv import load_dotenv

API = "https://api-live.euroleague.net/v2/competitions"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def api_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def run(args):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    comp = args.season_code[0]  # E2026 -> E
    games = api_get(f"{API}/{comp}/seasons/{args.season_code}/games")["data"]
    teams = {}
    for g in games:
        for side in ("local", "road"):
            cl = g.get(side, {}).get("club", {})
            if cl.get("code"):
                teams[cl["code"]] = cl
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        for code, cl in teams.items():
            cur.execute("""insert into euroleague.teams
                (competition, season_code, season_label, team_code, team_name, abbr_name, editorial_name, crest_url)
                values (%s,%s,%s,%s,%s,%s,%s,%s)
                on conflict (competition, season_code, team_code) do update set
                  team_name=excluded.team_name, crest_url=excluded.crest_url, updated_at=now()""",
                (comp, args.season_code, args.season_label, code, cl.get("name"),
                 cl.get("abbreviatedName"), cl.get("editorialName"), (cl.get("images") or {}).get("crest")))
    conn.commit()
    conn.close()
    print(f"{args.season_code}: {len(teams)} takim seed edildi ({args.season_label})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--season-code", required=True, help="E2026 | U2026 ...")
    ap.add_argument("--season-label", required=True, help="2026-2027")
    run(ap.parse_args())
