# -*- coding: utf-8 -*-
"""Fikstür <-> Bets10 maç bağlayıcı (Match/Player Stats Model Fixture ID sekmeleri).

Her modelin fikstürü kendi id uzayında; Bets10 verisi (fixture id 'f-...' + 1X2
oran) SofaScore event'ine bağlı. Bu iş ikisini eşleştirip
tracker.fixture_bets10_link tablosunu doldurur. Frontend analytics wrapper'ından
okur ve Fixture ID sekmesinde "Bets10'dan doldur" önerisi olarak gösterir.

İki lig, iki eşleşme stratejisi:
  TSL  : analytics.league_fixtures_v1 (apifootball/Opta slug uzayı) <->
         upcoming_events (SofaScore) BULANIK ad+tarih eşleşmesi. load_site_odds'un
         olgunlaşmış puanlayıcısı (fold/tokens/name_score/pair_score, U19/stopword
         korumaları) yeniden kullanılır; turnuva 'Trendyol Süper Lig' ile filtrelenir.
  TFF1 : analytics.tff1_fixtures_v1 SofaScore-native; fixture_id == SofaScore
         event_id (aynı id uzayı, doğrulandı) -> KESİN eşleşme, bulanıklık yok.

Kullanım:
  python link_fixtures_bets10.py [--dry-run]
"""
from __future__ import annotations

import os
import sys

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load_site_odds import (  # noqa: E402
    fold, name_score, pair_score, MATCH_THRESHOLD, MARGIN,
)

# upcoming_events_v1 tournament_name -> lig anahtarı (senior; U19 PAF Ligi hariç).
TSL_TOURNAMENT = "Trendyol Süper Lig"
TFF1_TOURNAMENT = "1. Lig"


def load_bets10_events(cur) -> dict[int, dict]:
    """SofaScore event_id -> Bets10 maçı (fixture id + 1X2 oran + ad/tarih/turnuva).

    Kaynak analytics.upcoming_event_odds_v1 (site='bets10', Maç Sonucu) +
    tracker.upcoming_events (ad/tarih/turnuva). 1X2 seçimleri: 'Beraberlik' =
    draw; diğer ikisi takım-adı VARYANTI olabilir ('Amed SFK' vs 'Amed Sportif
    Faaliyetler'), o yüzden ev/deplasman ataması name_score ile yapılır.
    """
    cur.execute(
        """
        select o.event_id, o.site_event_id, o.selection, o.odds,
               u.home_team_name, u.away_team_name, u.start_ts::date, u.tournament_name
        from analytics.upcoming_event_odds_v1 o
        join tracker.upcoming_events u on u.event_id = o.event_id
        where o.site = 'bets10' and o.market_name = 'Maç Sonucu'
          and u.sport = 'football'
        """
    )
    ev: dict[int, dict] = {}
    for eid, seid, sel, odds, home, away, d, tour in cur.fetchall():
        e = ev.setdefault(eid, {
            "event_id": eid, "site_event_id": seid,
            "home": home, "away": away, "date": d, "tournament": tour,
            "sels": [],
        })
        if seid and not e["site_event_id"]:
            e["site_event_id"] = seid
        e["sels"].append((sel, float(odds) if odds is not None else None))
    for e in ev.values():
        e.update(_split_1x2(e["sels"], e["home"], e["away"]))
    return ev


def _split_1x2(sels: list[tuple], home: str, away: str) -> dict:
    """3 seçimi home/draw/away oranına böler."""
    home_odds = draw_odds = away_odds = None
    non_draw = []
    for sel, odds in sels:
        if odds is None:
            continue
        if fold(sel) in ("beraberlik", "draw"):
            draw_odds = odds
        else:
            non_draw.append((sel, odds))
    # kalan ikisini ev/deplasmana name_score ile ata
    for sel, odds in non_draw:
        sh = name_score(sel, home)
        sa = name_score(sel, away)
        if sh >= sa:
            # daha iyi ev eşleşmesi; ev doluysa diğerini deplasmana bırak
            if home_odds is None:
                home_odds = odds
            else:
                away_odds = odds
        else:
            if away_odds is None:
                away_odds = odds
            else:
                home_odds = odds
    return {"home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds}


def resolve_tsl(cur, bets10: dict[int, dict]) -> list[dict]:
    """league_fixtures_v1 (Süper Lig) <-> Bets10 bulanık ad+tarih eşleşmesi."""
    cur.execute(
        """
        select fixture_id, home_team_slug, away_team_slug, fixture_date
        from analytics.league_fixtures_v1
        where competition = 'Süper Lig'
        """
    )
    fixtures = cur.fetchall()
    cands = [e for e in bets10.values() if e["tournament"] == TSL_TOURNAMENT]

    out = []
    for fid, hslug, aslug, fdate in fixtures:
        ev = {"home_team_name": hslug, "away_team_name": aslug}  # slug'ı ad gibi puanla
        scored = []
        for e in cands:
            if e["date"] != fdate:
                continue
            s = pair_score(e["home"], e["away"], ev)
            if s > 0:
                scored.append((s, e))
        if not scored:
            continue
        scored.sort(key=lambda t: t[0], reverse=True)
        best_s, best_e = scored[0]
        second = scored[1][0] if len(scored) > 1 else 0.0
        if best_s >= MATCH_THRESHOLD and (best_s - second) >= MARGIN:
            out.append(_row("tsl", fid, best_e, round(best_s, 3)))
    return out


def resolve_tff1(cur, bets10: dict[int, dict]) -> list[dict]:
    """tff1_fixtures_v1.fixture_id == SofaScore event_id (kesin)."""
    cur.execute(
        """
        select fixture_id from analytics.tff1_fixtures_v1
        where coalesce(lower(fixture_status),'scheduled') in
              ('scheduled','postponed','cancelled','notstarted')
        """
    )
    out = []
    for (fid,) in cur.fetchall():
        e = bets10.get(int(fid))
        if e and e["tournament"] == TFF1_TOURNAMENT:
            out.append(_row("tff1", fid, e, 1.0))
    return out


def _row(league: str, fixture_id, e: dict, score: float) -> dict:
    return {
        "league": league, "fixture_id": int(fixture_id), "event_id": e["event_id"],
        "bets10_event_id": e["site_event_id"],
        "home_odds": e["home_odds"], "draw_odds": e["draw_odds"], "away_odds": e["away_odds"],
        "match_score": score,
    }


def main() -> None:
    dry = "--dry-run" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    bets10 = load_bets10_events(cur)
    rows = resolve_tsl(cur, bets10) + resolve_tff1(cur, bets10)

    print(f"Bets10 futbol maçı (oranlı): {len(bets10)}")
    print(f"eşleşen fikstür: {len(rows)} "
          f"(tsl {sum(1 for r in rows if r['league']=='tsl')}, "
          f"tff1 {sum(1 for r in rows if r['league']=='tff1')})\n")
    for r in sorted(rows, key=lambda r: (r["league"], r["fixture_id"])):
        print(f"  {r['league']} fix={r['fixture_id']} eid={r['event_id']} "
              f"b10={r['bets10_event_id']} "
              f"1X2={r['home_odds']}/{r['draw_odds']}/{r['away_odds']} "
              f"score={r['match_score']}")

    if dry:
        print("\n--dry-run: yazılmadı")
        return

    for r in rows:
        cur.execute(
            """
            insert into tracker.fixture_bets10_link
              (league, fixture_id, event_id, bets10_event_id,
               home_odds, draw_odds, away_odds, match_score, updated_at)
            values (%(league)s,%(fixture_id)s,%(event_id)s,%(bets10_event_id)s,
                    %(home_odds)s,%(draw_odds)s,%(away_odds)s,%(match_score)s, now())
            on conflict (league, fixture_id) do update set
              event_id = excluded.event_id,
              bets10_event_id = excluded.bets10_event_id,
              home_odds = excluded.home_odds,
              draw_odds = excluded.draw_odds,
              away_odds = excluded.away_odds,
              match_score = excluded.match_score,
              updated_at = now()
            """,
            r,
        )
    conn.commit()
    conn.close()
    print(f"\nyazıldı: {len(rows)} bağ")


if __name__ == "__main__":
    main()
