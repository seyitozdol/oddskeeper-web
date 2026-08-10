# -*- coding: utf-8 -*-
"""BMBets oranlari (site='bmbets') - 4. kaynak, oran karsilastirma.

bmbets.com server-rendered HTML doner; duz curl ile 200 geliyor (Cloudflare
challenge YOK, tarayici/proxy gerekmez - 2026-08-10 dogrulandi). Mac satiri:
  tr.main-table-row > td.players-name-col (.player-1 a / .player-2 a takim
  adlari) + td.odds-col4 hucreleri (1, X, 2 "en yuksek" oranlari; bk-count
  hucresi bookmaker sayisi, atlanir).

Turk domestic (Super Lig / 1. Lig) + Avrupa kupalari + kulup hazirlik maclari.
Avrupa kupalarinin URL'i faza gore degisiyor (eleme '-qualifying/-qualification',
ana tur duz ad); ikisi de listede, bos sayfa 0 satirla zararsiz gecer.
Eslestirme load_site_odds.resolve; tracker.site_event_odds +
event_odds_availability'ye site='bmbets' yazar.

Kullanim: python fetch_bmbets.py [--dry-run]
"""
from __future__ import annotations

import datetime
import os
import re
import sys

import psycopg2
from bs4 import BeautifulSoup
from curl_cffi import requests as cr
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load_site_odds import resolve  # takim-adi eslestirme  # noqa: E402

BASE = "https://bmbets.com"
LEAGUES = [
    ("Süper Lig", "/football/turkey/turkcell-super-league/"),
    ("1. Lig", "/football/turkey/tff-1-league/"),
    ("Şampiyonlar Ligi", "/football/europe/uefa-champions-league/"),
    ("Şampiyonlar Ligi Eleme", "/football/europe/uefa-champions-league-qualifying/"),
    ("Avrupa Ligi", "/football/europe/uefa-europa-league/"),
    ("Avrupa Ligi Eleme", "/football/europe/uefa-europa-league-qualification/"),
    ("Konferans Ligi", "/football/europe/uefa-conference-league/"),
    ("Konferans Ligi Eleme", "/football/europe/uefa-conference-league-qualification/"),
    ("Kulüp Hazırlık", "/football/world/club-friendlies/"),
]

ODDS_RE = re.compile(r"^\d+(?:\.\d{1,2})?$")


def fetch_page(path: str) -> str | None:
    try:
        r = cr.get(BASE + path, impersonate="chrome", timeout=30)
    except Exception as ex:
        print(f"[hata] {path}: {type(ex).__name__}", flush=True)
        return None
    if r.status_code != 200:
        print(f"[atlandi] {path}: HTTP {r.status_code}", flush=True)
        return None
    return r.text


def parse_rows(html: str) -> list[dict]:
    """Lig sayfasindan (home, away, o1, ox, o2) satirlari cikarir."""
    soup = BeautifulSoup(html, "lxml")
    out: list[dict] = []
    for tr in soup.select("tr.main-table-row"):
        names = tr.select("td.players-name-col a")
        if len(names) < 2:
            continue
        home = names[0].get_text(strip=True)
        away = names[1].get_text(strip=True)
        if not home or not away or len(home) > 60 or len(away) > 60:
            continue
        odds: list[str] = []
        for td in tr.select("td.odds-col4"):
            cls = td.get("class") or []
            if "bk-count" in cls:
                continue
            # hucre metni "1" (mobile-bet-type span) + oran; span'i atip kalani al
            for span in td.select("span"):
                span.extract()
            val = td.get_text(strip=True)
            odds.append(val)
        # futbolda 3 yollu (1/X/2) bekliyoruz; "-" veya eksik hucre = oran yok
        if len(odds) < 3 or not all(ODDS_RE.match(o) for o in odds[:3]):
            continue
        out.append({"home": home, "away": away, "o1": odds[0], "ox": odds[1], "o2": odds[2]})
    return out


def scrape() -> list[dict]:
    rows: list[dict] = []
    for name, path in LEAGUES:
        html = fetch_page(path)
        if html is None:
            continue
        found = parse_rows(html)
        for r in found:
            r["competition"] = name
        rows.extend(found)
        print(f"[{name}] {len(found)} mac", flush=True)
    # global benzersiz (ayni mac hem eleme hem ana tur sayfasinda olabilir)
    seen, uniq = set(), []
    for r in rows:
        k = (r["home"], r["away"])
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq


def main() -> None:
    dry = "--dry-run" in sys.argv

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # Kadin (gender='F') event'ler adayliktan cikarilir; bmbets sayfalarimiz
    # erkek musabakasi (load_site_odds'taki guard ile ayni gerekce).
    cur.execute(
        "select event_id, home_team_name, away_team_name from tracker.upcoming_events "
        "where sport='football' and status_type in ('notstarted','inprogress') "
        "and start_ts > now() - interval '6 hours' "
        "and gender is distinct from 'F'"
    )
    our = [{"event_id": r[0], "home_team_name": r[1], "away_team_name": r[2]} for r in cur.fetchall()]

    scraped = scrape()
    print(f"BMBets: {len(scraped)} mac (1X2)", flush=True)

    # her mac icin 3 secim satiri
    site_rows: list[dict] = []
    for r in scraped:
        for sel, odd in [(r["home"], r["o1"]), ("Beraberlik", r["ox"]), (r["away"], r["o2"])]:
            try:
                site_rows.append({"home": r["home"], "away": r["away"], "market": "Maç Sonucu",
                                  "selection": sel, "odds": float(odd),
                                  "competition": r["competition"]})
            except ValueError:
                pass

    site_pairs = sorted({(r["home"], r["away"]) for r in site_rows})
    matches = resolve(site_pairs, our)
    print(f"takipteki futbol maci: {len(our)} | ESLESEN: {len(matches)}")
    for (h, a), m in sorted(matches.items()):
        print(f"  {h} - {a}  ->  {m['our']}")

    if dry:
        print("--dry-run: yazilmadi")
        return
    if not matches:
        print("eslesen mac yok; yazilmadi")
        return

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    per_event: dict[int, dict] = {}
    for (h, a), m in matches.items():
        eid = m["event_id"]
        rows = [r for r in site_rows if r["home"] == h and r["away"] == a]
        per_event[eid] = {"home": h, "away": a, "score": m["score"],
                          "markets": {r["market"] for r in rows}}
        for r in rows:
            cur.execute(
                """insert into tracker.site_event_odds
                   (site, home_team_name, away_team_name, market_name, selection, odds,
                    competition, start_text, page_kind, snapshot_label, captured_at)
                   values ('bmbets',%s,%s,%s,%s,%s,%s,null,'bmbets','bmbets',%s)
                   on conflict (site, home_team_name, away_team_name, market_name, selection)
                   do update set odds=excluded.odds, competition=excluded.competition,
                     captured_at=excluded.captured_at""",
                (h, a, r["market"], r["selection"], r["odds"], r["competition"], now_iso),
            )
    for eid, info in per_event.items():
        cur.execute(
            """insert into tracker.event_odds_availability
               (event_id, site, has_odds, listed, market_count, site_home_name, site_away_name, match_score, checked_at)
               values (%s,'bmbets',true,true,%s,%s,%s,%s,now())
               on conflict (event_id, site) do update set
                 has_odds=true, listed=true, market_count=excluded.market_count,
                 site_home_name=excluded.site_home_name, site_away_name=excluded.site_away_name,
                 match_score=excluded.match_score, checked_at=now()""",
            (eid, len(info["markets"]), info["home"], info["away"], info["score"]),
        )
    conn.commit()
    conn.close()
    print(f"yazildi: {len(per_event)} mac bmbets oranli isaretlendi")


if __name__ == "__main__":
    main()
