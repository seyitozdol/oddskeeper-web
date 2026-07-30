# -*- coding: utf-8 -*-
"""bet365 oranlarini API-Football uzerinden ceker (site='bet365').

NEDEN: bet365 dogrudan otomasyonla oran vermiyor (anti-bot; VPS spike'inda
kupon bos, zap WS payload'siz - 2026-07-30). API-Football'da bet365 bookmaker
id=8 ve Avrupa kupalari (Sampiyonlar/Avrupa/Konferans Ligi) icin oran veriyor.
KISIT: (1) Turk DOMESTIC ligleri (Super Lig, 1.Lig) API'de KAPSANMAZ - onlar
Bets10'dan gelir. (2) Oranlar maca ~1-3 gun kala yuklenir, uzak maclar bos.
Bu yuzden bu loader Turk takimlarinin Avrupa maclarinin bet365 kolonunu, maca
yaklastikca doldurur.

Tarayici/proxy YOK; mevcut API_FOOTBALL_KEY (.env) + kota ile calisir.
Eslestirme takim adiyla (load_site_odds mantigi). Kullanim: python fetch_apifootball_odds.py [--dry-run]
"""
from __future__ import annotations

import os
import sys
import time

import psycopg2
import requests
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load_site_odds import resolve  # takim-adi eslestirme  # noqa: E402

API_BASE = "https://v3.football.api-sports.io"
SEASON = 2026
BOOKMAKER_BET365 = 8
# Turk takimlarinin oynadigi Avrupa kupalari (API-Football league id).
# Milli takim turnuvalari mac oldukca eklenebilir (EURO=4, Nations=5, Dunya K.=1).
LEAGUES = [2, 3, 848]  # Sampiyonlar / Avrupa / Konferans Ligi
MW_BET = "Match Winner"
OU_BET = "Goals Over/Under"


def api_get(key: str, path: str) -> dict:
    for _ in range(4):
        try:
            r = requests.get(f"{API_BASE}{path}", headers={"x-apisports-key": key}, timeout=30)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        time.sleep(1.5)
    return {"response": []}


def fixtures_for_league(key: str, league: int, date_from: str, date_to: str) -> dict:
    """fixture_id -> (home, away, iso_date)."""
    out = {}
    d = api_get(key, f"/fixtures?league={league}&season={SEASON}&from={date_from}&to={date_to}")
    for fx in d.get("response", []):
        t = fx["teams"]
        out[fx["fixture"]["id"]] = (t["home"]["name"], t["away"]["name"], fx["fixture"]["date"])
    return out


def odds_for_league(key: str, league: int) -> dict:
    """fixture_id -> [(market, selection, odd)] (yalnizca bet365, 1X2 + A/U 2.5)."""
    out: dict[int, list] = {}
    page = 1
    while True:
        d = api_get(key, f"/odds?league={league}&season={SEASON}&bookmaker={BOOKMAKER_BET365}&page={page}")
        for r in d.get("response", []):
            fid = r["fixture"]["id"]
            rows = []
            for bm in r.get("bookmakers", []):
                for bet in bm.get("bets", []):
                    if bet["name"] == MW_BET:
                        for v in bet["values"]:
                            sel = {"Home": "HOME", "Draw": "Beraberlik", "Away": "AWAY"}.get(v["value"], v["value"])
                            rows.append(("Maç Sonucu", sel, float(v["odd"])))
                    elif bet["name"] == OU_BET:
                        for v in bet["values"]:
                            if v["value"] in ("Over 2.5", "Under 2.5"):
                                sel = "Üst 2.5" if v["value"].startswith("Over") else "Alt 2.5"
                                rows.append(("Alt/Üst 2.5", sel, float(v["odd"])))
            if rows:
                out[fid] = rows
        paging = d.get("paging", {})
        if page >= paging.get("total", 1):
            break
        page += 1
        time.sleep(0.3)
    return out


def main() -> None:
    dry = "--dry-run" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    key = (os.environ.get("API_FOOTBALL_KEY") or "").strip().strip('"')
    if not key:
        raise SystemExit("Eksik API_FOOTBALL_KEY (.env)")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # takip ettigimiz yaklasan futbol maclari
    cur.execute(
        "select event_id, home_team_name, away_team_name from tracker.upcoming_events "
        "where sport='football' and status_type in ('notstarted','inprogress') "
        "and start_ts > now() - interval '6 hours'"
    )
    our = [{"event_id": r[0], "home_team_name": r[1], "away_team_name": r[2]} for r in cur.fetchall()]

    import datetime
    today = datetime.date.today()
    date_from, date_to = today.isoformat(), (today + datetime.timedelta(days=14)).isoformat()

    # API'den bet365 oranli maclari topla
    site_rows: list[dict] = []  # {home, away, market, selection, odds, site_event_id}
    n_api_matches = 0
    for lg in LEAGUES:
        fixtures = fixtures_for_league(key, lg, date_from, date_to)
        odds = odds_for_league(key, lg)
        for fid, rows in odds.items():
            if fid not in fixtures:
                continue
            home, away, _ = fixtures[fid]
            n_api_matches += 1
            for market, sel, odd in rows:
                selection = home if sel == "HOME" else away if sel == "AWAY" else sel
                site_rows.append({"home": home, "away": away, "market": market,
                                  "selection": selection, "odds": odd, "site_event_id": str(fid)})

    site_pairs = sorted({(r["home"], r["away"]) for r in site_rows})
    matches = resolve(site_pairs, our)

    print(f"API-Football bet365: {n_api_matches} Avrupa maci oranli, {len(site_rows)} satir")
    print(f"takipteki futbol maci: {len(our)} | ESLESEN: {len(matches)}")
    for (h, a), m in sorted(matches.items()):
        print(f"  {h} - {a}  ->  {m['our']}")

    if dry:
        print("--dry-run: yazilmadi")
        return
    if not matches:
        print("eslesen mac yok (oranlar henuz dusmemis olabilir); yazilmadi")
        return

    import datetime as _dt
    now_iso = _dt.datetime.now(_dt.timezone.utc).isoformat()
    per_event: dict[int, dict] = {}
    for (h, a), m in matches.items():
        eid = m["event_id"]
        rows = [r for r in site_rows if r["home"] == h and r["away"] == a]
        per_event[eid] = {"home": h, "away": a, "score": m["score"],
                          "markets": {r["market"] for r in rows}, "rows": rows}
        for r in rows:
            cur.execute(
                """insert into tracker.site_event_odds
                   (site, home_team_name, away_team_name, market_name, selection, odds,
                    competition, start_text, page_kind, snapshot_label, captured_at)
                   values ('bet365',%s,%s,%s,%s,%s,'Avrupa (API-Football)',null,'apifootball','apifootball',%s)
                   on conflict (site, home_team_name, away_team_name, market_name, selection)
                   do update set odds=excluded.odds, captured_at=excluded.captured_at""",
                (h, a, r["market"], r["selection"], r["odds"], now_iso),
            )
    for eid, info in per_event.items():
        cur.execute(
            """insert into tracker.event_odds_availability
               (event_id, site, has_odds, listed, market_count, site_home_name, site_away_name, match_score, checked_at)
               values (%s,'bet365',true,true,%s,%s,%s,%s,now())
               on conflict (event_id, site) do update set
                 has_odds=true, listed=true, market_count=excluded.market_count,
                 site_home_name=excluded.site_home_name, site_away_name=excluded.site_away_name,
                 match_score=excluded.match_score, checked_at=now()""",
            (eid, len(info["markets"]), info["home"], info["away"], info["score"]),
        )
    conn.commit()
    conn.close()
    print(f"yazildi: {len(per_event)} mac bet365 oranli isaretlendi")


if __name__ == "__main__":
    main()
