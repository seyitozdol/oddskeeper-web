# -*- coding: utf-8 -*-
"""bet365 oranlarini API-Football uzerinden ceker (site='bet365').

NEDEN: bet365 dogrudan otomasyonla oran vermiyor (anti-bot; VPS spike'inda
kupon bos, zap WS payload'siz - 2026-07-30). API-Football'da bet365 bookmaker
id=8 hem Avrupa kupalari (Sampiyonlar/Avrupa/Konferans Ligi) hem de Turk domestic
ligleri (Super Lig, 1. Lig) icin oran veriyor (LEAGUES). KISIT: Oranlar maca ~1-3
gun kala yuklenir, uzak maclar bos; bu loader takipteki maclarin bet365 kolonunu
maca yaklastikca doldurur. NOT: /leagues coverage.odds bayragi Turk domestic ligleri
icin false gorunur ama asil /odds endpoint'i hem Super Lig hem 1. Lig icin gercek
bet365 orani doner (2026-08-08 dogrulandi).

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
# Turk takimlarinin oynadigi ligler (API-Football league id):
#   2/3/848 = Sampiyonlar/Avrupa/Konferans Ligi ; 667 = Kulup Hazirlik maclari ;
#   203 = Super Lig ; 204 = TFF 1. Lig.
# NOT (2026-08-08): API-Football'un /leagues coverage.odds bayragi Turk domestic
# ligleri icin false gorunse de asil /odds?bookmaker=8 endpoint'i hem Super Lig hem
# 1. Lig maclari icin GERCEK bet365 orani donduruyor (canli dogrulandi: Bandirmaspor-
# Istanbulspor 1X2 2.10/3.25/3.20, Galatasaray-Corum 1.18/6.00/12.00 + Alt/Ust).
# Milli takim turnuvalari mac oldukca eklenebilir (10=uluslararasi hazirlik,
# 5=Nations, 4=EURO elemeleri, 34=Dunya K. elemeleri UEFA).
LEAGUES = [2, 3, 848, 667, 203, 204]
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
    """fixture_id -> (home, away, iso_date). /fixtures SAYFALAMA DESTEKLEMEZ
    ('page' parametresi hata verir); tek cagrida tum fikstur'leri doner (buyuk
    liglerde 500+ mac tek yanitta gelir)."""
    out = {}
    d = api_get(key, f"/fixtures?league={league}&season={SEASON}&from={date_from}&to={date_to}")
    for fx in d.get("response", []):
        t = fx["teams"]
        out[fx["fixture"]["id"]] = (t["home"]["name"], t["away"]["name"], fx["fixture"]["date"])
    return out


def odds_for_fixture(key: str, fid: int) -> list:
    """Tek fikstur icin bet365 (1X2 + A/U 2.5) satirlari. Kota verimli: yalnizca
    takipteki maclarla eslesen fikstur'lere cagrilir (lig geneli sayfalama yok)."""
    d = api_get(key, f"/odds?fixture={fid}&bookmaker={BOOKMAKER_BET365}")
    rows = []
    for r in d.get("response", []):
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
    return rows


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

    # 1) Tum liglerin fikstur'lerini topla (ucuz, sayfalamali), (home,away)->fid.
    fixture_by_pair: dict[tuple, int] = {}
    for lg in LEAGUES:
        for fid, (home, away, _) in fixtures_for_league(key, lg, date_from, date_to).items():
            fixture_by_pair.setdefault((home, away), fid)
    print(f"API-Football fikstur: {len(fixture_by_pair)} mac ({len(LEAGUES)} lig)")

    # 2) Fikstur'leri takipteki maclarla ESLESTIR (isim), sonra YALNIZCA
    #    eslesenler icin bet365 orani cek (kota verimli).
    site_pairs = sorted(fixture_by_pair.keys())
    matches = resolve(site_pairs, our)
    print(f"takipteki futbol maci: {len(our)} | ESLESEN fikstur: {len(matches)}")

    site_rows: list[dict] = []
    for (h, a), m in sorted(matches.items()):
        fid = fixture_by_pair[(h, a)]
        rows = odds_for_fixture(key, fid)
        got = "bet365 VAR" if rows else "oran yok"
        print(f"  {h} - {a}  ->  {m['our']}  ({got})")
        for market, sel, odd in rows:
            selection = h if sel == "HOME" else a if sel == "AWAY" else sel
            site_rows.append({"home": h, "away": a, "market": market,
                              "selection": selection, "odds": odd, "site_event_id": str(fid)})

    # Yalnizca gercekten bet365 orani olan maclari isaretle.
    matches = {p: m for p, m in matches.items()
               if any(r["home"] == p[0] and r["away"] == p[1] for r in site_rows)}
    print(f"bet365 orani olan: {len(matches)}")

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
