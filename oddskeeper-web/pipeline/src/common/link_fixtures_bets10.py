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

Basketbol (BSL / EuroLeague / EuroCup): fikstur kaynagi yok, bag EVENT bazli
-> tracker.bb_fixture_bets10_link (bkz. dosya sonundaki BASKETBOL bolumu).

Kullanım:
  python link_fixtures_bets10.py [--dry-run]
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone

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
               u.home_team_name, u.away_team_name, u.start_ts::date, u.start_ts,
               u.tournament_name
        from analytics.upcoming_event_odds_v1 o
        join tracker.upcoming_events u on u.event_id = o.event_id
        where o.site = 'bets10' and o.market_name = 'Maç Sonucu'
          and u.sport = 'football'
        """
    )
    ev: dict[int, dict] = {}
    for eid, seid, sel, odds, home, away, d, start_ts, tour in cur.fetchall():
        e = ev.setdefault(eid, {
            "event_id": eid, "site_event_id": seid,
            "home": home, "away": away, "date": d, "start_ts": start_ts,
            "tournament": tour,
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

    # TARİH TAM-EŞİTLİĞİ KULLANILMAZ: league_fixtures_v1 bir turun TÜM maçlarını
    # tek nominal güne koyuyor (ör. R1'in 9 maçı da 2026-08-16), SofaScore ise
    # gerçek günü tutuyor (matchweek Cuma-Pazartesi yayılır). Sıralı (ev, dep)
    # çifti sezonda TEKİL olduğu için eşleşme yön (pair_score) + margin ile
    # güvenli; tarih yalnızca geniş bir savunma penceresi ve beraberlik bozucu.
    DATE_WINDOW = 10  # gün

    out = []
    for fid, hslug, aslug, fdate in fixtures:
        ev = {"home_team_name": hslug, "away_team_name": aslug}  # slug'ı ad gibi puanla
        scored = []
        for e in cands:
            dd = abs((e["date"] - fdate).days) if (fdate and e["date"]) else 999
            if fdate and e["date"] and dd > DATE_WINDOW:
                continue
            s = pair_score(e["home"], e["away"], ev)
            if s > 0:
                scored.append((s, -dd, e))  # önce puan, sonra en yakın tarih
        if not scored:
            continue
        scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
        best_s, _, best_e = scored[0]
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


# =============================================================================
# BASKETBOL (BSL / EuroLeague / EuroCup) -> tracker.bb_fixture_bets10_link
#
# Basketbolda fikstur kaynagi yok (bb_pm_fixtures elle ekleniyor); bag EVENT
# bazli: SofaScore event -> bizim takim slug'lari. Frontend Fixtures sekmesi
# bu tablodan "Bets10'dan doldur" ile fikstur uretir / mevcut fiksture onerir.
# Bets10 basketbolda 1X2 yok: 'Mac Kazanani' (2 yol) + 'Handikap' (cok cizgili,
# '1 (-6.5)' / '2 (+6.5)') + (feed'e girerse) toplam sayi. Cok cizgide ANA
# cizgi = oranlari en dengeli olan (|ev-dep| min; esitlikte medyana en yakin).
#
# Takim kimligi:
#   BSL   : basketball.teams.sofascore_team_id == upcoming_events.home/away_team_id
#           (KESIN; yoksa ad bulanik yedek). Turnuva: kategori Turkey + Super
#           League / Super Cup / Kupa (kadin, gencler, TBL/TB2L disarida).
#   EL/EC : euroleague.teams (son sezon) team_name/abbr/editorial + BB_ALIASES
#           varyantlari ile name_score (esik/margin load_site_odds ile ayni).
# =============================================================================

# EL/EC team_code -> SofaScore/Bets10 ad varyantlari (euroleague.teams adlarina ek).
# Anahtar ad fold() oncesi serbest; name_score icinde katlanir. Sponsor degisince ekle.
BB_ALIASES: dict[str, tuple[str, ...]] = {
    "BAR": ("Barça Basket", "Barcelona"),
    "MIL": ("Olimpia Milano", "EA7 Emporio Armani Milan", "Armani Milano"),
    "MUN": ("Bayern München", "Bayern Munich"),
    "DUB": ("BC Dubai", "Dubai"),
    "HTA": ("Hapoel Tel-Aviv", "Hapoel Tel Aviv"),
    "ZAL": ("Kauno Žalgiris", "Zalgiris"),
    "RED": ("KK Crvena zvezda", "Crvena Zvezda", "Kızılyıldız"),
    "PAR": ("KK Partizan Mozzart Bet", "Partizan"),
    "OLY": ("Olympiacos BC", "Olympiacos"),
    "PAN": ("Panathinaikos BC", "Panathinaikos"),
    "TEL": ("Maccabi Tel Aviv",),
    "BAS": ("Kosner Baskonia", "Baskonia"),
    "ULK": ("Fenerbahçe Beko", "Fenerbahçe Tarfin", "Fenerbahçe"),
    "IST": ("Anadolu Efes",),
    "BES": ("Beşiktaş Gain", "Beşiktaş"),
    "ASV": ("ASVEL", "LDLC ASVEL"),
    "PRS": ("Paris Basketball", "Paris"),
    "TTK": ("Türk Telekom B.K.", "Türk Telekom"),
    "BUR": ("Tofaş Bursa", "Tofaş"),
    "BAH": ("Bahçeşehir Koleji",),
    "VNC": ("Umana Reyer Venezia", "Reyer Venezia"),
    "NIN": ("BV Chemnitz 99", "Niners Chemnitz"),
    "NAP": ("Guerri Napoli Basketball", "Napoli"),
    "BOU": ("JL Bourg Basket", "JL Bourg"),
    "BUD": ("KK Budućnost VOLI", "Buducnost"),
    "MAN": ("Kids&Us Manresa", "BAXI Manresa", "Manresa"),
    "BLK": ("Balkan Botevgrad",),
    "BCR": ("BC Roma Spqr", "Roma"),
    "MRO": ("Maxima Roma",),
    "SIA": ("Šiauliai", "Siauliai"),
    "TNF": ("La Laguna Tenerife", "Tenerife"),
    "MCO": ("AS Monaco", "Monaco"),
    "LJU": ("Cedevita Olimpija",),
    "JER": ("Hapoel Jerusalem",),
    "TRN": ("Dolomiti Energia Trento", "Trento"),
    "WRO": ("Slask Wroclaw", "Śląsk Wrocław"),
    "ULM": ("ratiopharm Ulm", "Ulm"),
    "KLA": ("Neptunas Klaipeda", "Neptūnas"),
    "LKB": ("Lietkabelis",),
    "LLI": ("London Lions",),
    "CLU": ("U-BT Cluj-Napoca", "Cluj"),
    "ARI": ("Aris Thessaloniki", "Aris"),
    "PAO": ("PAOK",),
    "BGS": ("San Pablo Burgos", "Burgos"),
    "FRA": ("Skyliners Frankfurt", "Frankfurt"),
    "LEM": ("Le Mans",),
    "RIG": ("Riga Zelli", "VEF Riga"),
    "RTK": ("Rostock Seawolves",),
    "TRT": ("Derthona Tortona", "Bertram Tortona"),
}

_BB_EXCLUDE = ("women", "kadin", "gencler", "kbsl", "tbl", "tb2l", "u16", "u18", "u19", "u20", "u21")
_HCP_SEL_RE = re.compile(r"^\s*([12])\s*\(\s*([+-]?\d+(?:[.,]\d+)?)\s*\)")
_NUM_RE = re.compile(r"[+-]?\d+(?:[.,]\d+)?")


def _bb_league(tournament: str | None, category: str | None) -> str | None:
    t = fold(tournament or "")
    if any(x in t for x in _BB_EXCLUDE):
        return None
    if t.startswith("euroleague"):
        return "euroleague"
    if t.startswith("eurocup"):
        return "eurocup"
    if fold(category or "") == "turkey" and any(
        x in t for x in ("super league", "super cup", "turkish cup", "turkiye cup", "basketball cup", "kupa")
    ):
        return "basketball"
    return None


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def _pick_main(lines: dict[float, list]) -> tuple[float, float, float] | None:
    """{cizgi: [oran_a, oran_b]} -> en dengeli cizgi (|a-b| min; esitlikte medyana en yakin)."""
    full = [(ln, ab[0], ab[1]) for ln, ab in lines.items() if ab[0] is not None and ab[1] is not None]
    if not full:
        return None
    med = sorted(ln for ln, _, _ in full)[len(full) // 2]
    full.sort(key=lambda t: (abs(t[1] - t[2]), abs(t[0] - med)))
    return full[0]


def _bb_markets(sels: list[tuple[str, str, float | None]], home: str, away: str) -> dict:
    """(market, selection, odds) listesi -> kazanan / handikap / toplam alanlari."""
    win: list[tuple[str, float]] = []
    hcp: dict[float, list] = {}
    tot: dict[float, list] = {}
    for market, sel, odds in sels:
        if odds is None:
            continue
        m = fold(market)
        s = fold(sel)
        if "kazanan" in m or m in ("winner", "moneyline", "mac sonucu"):
            win.append((sel, odds))
        elif "handikap" in m or "handicap" in m:
            mm = _HCP_SEL_RE.match(sel)
            if not mm:
                continue
            side, val = mm.group(1), _num(mm.group(2))
            line = val if side == "1" else -val   # ev perspektifi
            hcp.setdefault(line, [None, None])[0 if side == "1" else 1] = odds
        elif "toplam" in m or "alt/ust" in m or "ust/alt" in m or "over/under" in m or "total" in m:
            is_over = s.startswith("ust") or s.startswith("over") or s.startswith("+")
            is_under = s.startswith("alt") or s.startswith("under") or s.startswith("-")
            if not (is_over or is_under):
                continue
            num = _NUM_RE.search(sel) or _NUM_RE.search(market)
            if not num:
                continue
            line = abs(_num(num.group(0)))
            tot.setdefault(line, [None, None])[0 if is_over else 1] = odds
    out: dict = {
        "home_odds": None, "away_odds": None,
        "hcp_line": None, "hcp_home_odds": None, "hcp_away_odds": None,
        "total_line": None, "total_over_odds": None, "total_under_odds": None,
    }
    if len(win) == 2:
        (s1, o1), (s2, o2) = win
        # ad puani: hangi secim ev? (Bets10 adi varyant olabilir: 'Tofas' vs 'Tofaş Bursa')
        s1_home = name_score(s1, home) + name_score(s2, away) >= name_score(s1, away) + name_score(s2, home)
        out["home_odds"], out["away_odds"] = (o1, o2) if s1_home else (o2, o1)
    h = _pick_main(hcp)
    if h:
        out["hcp_line"], out["hcp_home_odds"], out["hcp_away_odds"] = h
    t = _pick_main(tot)
    if t:
        out["total_line"], out["total_over_odds"], out["total_under_odds"] = t
    return out


_ROUND_RE = re.compile(r"^\s*round\s+(\d+)\s*$", re.IGNORECASE)


def _bb_week(round_info: str | None) -> int | None:
    """SofaScore round_info 'Round 3' -> 3; 'Final', 'Semifinals' vb. -> None."""
    m = _ROUND_RE.match(round_info or "")
    return int(m.group(1)) if m else None


def load_bets10_basketball(cur) -> dict[int, dict]:
    """SofaScore event_id -> yaklasan basketbol maci (lig anahtari + hafta + Bets10 secimleri).

    Kaynak upcoming_events (son 1 gun + gelecek); Bets10 orani olmayan mac da gelir
    (site_event_id/oran alanlari None) ki Fixtures sekmesi haftayi TAM listelesin.
    """
    cur.execute(
        """
        select u.event_id, o.site_event_id, o.market_name, o.selection, o.odds,
               u.home_team_name, u.away_team_name, u.home_team_id, u.away_team_id,
               u.tournament_name, u.category_name, u.start_ts, u.round_info
        from tracker.upcoming_events u
        left join analytics.upcoming_event_odds_v1 o
          on o.event_id = u.event_id and o.site = 'bets10'
        where u.sport = 'basketball'
          and u.start_ts > now() - interval '1 day'
        """
    )
    ev: dict[int, dict] = {}
    for (eid, seid, market, sel, odds, home, away, hid, aid, tour, cat, start_ts, rinfo) in cur.fetchall():
        league = _bb_league(tour, cat)
        if not league:
            continue
        e = ev.setdefault(eid, {
            "event_id": eid, "site_event_id": seid, "league": league,
            "home": home, "away": away, "home_id": hid, "away_id": aid,
            "tournament": tour, "start_ts": start_ts, "week": _bb_week(rinfo), "sels": [],
        })
        if seid and not e["site_event_id"]:
            e["site_event_id"] = seid
        if market is not None:
            e["sels"].append((market, sel, float(odds) if odds is not None else None))
    for e in ev.values():
        e.update(_bb_markets(e["sels"], e["home"], e["away"]))
    return ev


def _load_bb_teams(cur) -> dict[str, dict]:
    """lig -> {'by_id': {sofa_id: (slug, ad)}, 'names': [(slug, ad, [varyantlar])]}."""
    out: dict[str, dict] = {"basketball": {"by_id": {}, "names": []},
                            "euroleague": {"by_id": {}, "names": []},
                            "eurocup": {"by_id": {}, "names": []}}
    cur.execute("select team_slug, team_name, sofascore_team_id from basketball.teams")
    for slug, name, sid in cur.fetchall():
        if sid is not None:
            out["basketball"]["by_id"][int(sid)] = (slug, name)
        out["basketball"]["names"].append((slug, name, [name]))
    cur.execute(
        """
        select t.competition, t.team_code, t.team_name, t.abbr_name, t.editorial_name
        from euroleague.teams t
        where t.season_code = (select max(season_code) from euroleague.teams x where x.competition = t.competition)
        """
    )
    for comp, code, name, abbr, edit in cur.fetchall():
        league = "euroleague" if comp == "E" else "eurocup"
        variants = [v.strip() for v in (name, abbr, edit) if v and v.strip()]
        variants += list(BB_ALIASES.get(code, ()))
        out[league]["names"].append((code, name or code, variants))
    return out


def _best_team(name: str, teams: list[tuple[str, str, list[str]]]) -> tuple[str, str, float] | None:
    """Ad -> (slug, ad, puan); esik + margin korumali (load_site_odds ile ayni)."""
    scored = []
    for slug, tname, variants in teams:
        s = max((name_score(name, v) for v in variants), default=0.0)
        if s > 0:
            scored.append((s, slug, tname))
    if not scored:
        return None
    scored.sort(key=lambda t: t[0], reverse=True)
    best = scored[0]
    second = scored[1][0] if len(scored) > 1 else 0.0
    # TAM ad eslesmesi (1.0) kesindir; margin aranmaz. Ornek: 'Maxima Roma' MRO'ya 1.0,
    # BCR ('Roma Basketball' -> {roma}) kapsama ile 0.9 -> margin 0.1 ile bosa dusuyordu.
    if best[0] >= 0.999 and second < 0.999:
        return best[1], best[2], round(best[0], 3)
    if best[0] >= MATCH_THRESHOLD and (best[0] - second) >= MARGIN:
        return best[1], best[2], round(best[0], 3)
    return None


def resolve_basketball(cur, events: dict[int, dict]) -> list[dict]:
    teams = _load_bb_teams(cur)
    out = []
    for e in events.values():
        lg = teams[e["league"]]
        sides = []
        for nm, sid in ((e["home"], e["home_id"]), (e["away"], e["away_id"])):
            hit = lg["by_id"].get(int(sid)) if sid is not None else None
            if hit:
                sides.append((hit[0], hit[1], 1.0))
                continue
            bt = _best_team(nm, lg["names"])
            if not bt:
                sides.append(None)
                break
            sides.append(bt)
        if len(sides) < 2 or any(s is None for s in sides):
            continue
        (hs, hn, hsc), (as_, an, asc) = sides
        if hs == as_:
            continue
        out.append({
            "league": e["league"], "event_id": e["event_id"], "bets10_event_id": e["site_event_id"],
            "home_team_slug": hs, "away_team_slug": as_, "home_team_name": hn, "away_team_name": an,
            "tournament_name": e["tournament"], "start_ts": e["start_ts"], "week": e["week"],
            "home_odds": e["home_odds"], "away_odds": e["away_odds"],
            "hcp_line": e["hcp_line"], "hcp_home_odds": e["hcp_home_odds"], "hcp_away_odds": e["hcp_away_odds"],
            "total_line": e["total_line"], "total_over_odds": e["total_over_odds"], "total_under_odds": e["total_under_odds"],
            "match_score": round(min(hsc, asc), 3),
        })
    return out


def main() -> None:
    dry = "--dry-run" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    bets10 = load_bets10_events(cur)

    # DEADLINE DONMASI: baslama saati gecen maclarin eventleri aday havuzundan
    # cikarilir. Bets10 canli/sonuclanmis oranlari (1.00 gibi) linki kirletmesin;
    # tabloda duran son mac-oncesi kayit oldugu gibi donmus kalir (upsert yok).
    now = datetime.now(timezone.utc)
    started = sum(1 for e in bets10.values()
                  if e["start_ts"] is not None and e["start_ts"] <= now)
    bets10 = {k: e for k, e in bets10.items()
              if e["start_ts"] is None or e["start_ts"] > now}

    rows = resolve_tsl(cur, bets10) + resolve_tff1(cur, bets10)
    if started:
        print(f"baslamis mac (donduruldu, guncellenmeyecek): {started}")

    print(f"B10 futbol maçı (oranlı): {len(bets10)}")
    print(f"eşleşen fikstür: {len(rows)} "
          f"(tsl {sum(1 for r in rows if r['league']=='tsl')}, "
          f"tff1 {sum(1 for r in rows if r['league']=='tff1')})\n")
    for r in sorted(rows, key=lambda r: (r["league"], r["fixture_id"])):
        print(f"  {r['league']} fix={r['fixture_id']} eid={r['event_id']} "
              f"b10={r['bets10_event_id']} "
              f"1X2={r['home_odds']}/{r['draw_odds']}/{r['away_odds']} "
              f"score={r['match_score']}")

    # ---- basketbol (ayni deadline kurali) ----
    bb_events = load_bets10_basketball(cur)
    bb_started = sum(1 for e in bb_events.values() if e["start_ts"] is not None and e["start_ts"] <= now)
    bb_events = {k: e for k, e in bb_events.items() if e["start_ts"] is None or e["start_ts"] > now}
    bb_rows = resolve_basketball(cur, bb_events)
    with_b10 = sum(1 for r in bb_rows if r["bets10_event_id"])
    print(f"\nyaklaşan basketbol maçı (BSL/EL/EC): {len(bb_events)}"
          + (f"; başlamış (donduruldu): {bb_started}" if bb_started else ""))
    print(f"eşleşen basketbol maçı: {len(bb_rows)} (B10 oranlı {with_b10}; "
          f"bsl {sum(1 for r in bb_rows if r['league']=='basketball')}, "
          f"el {sum(1 for r in bb_rows if r['league']=='euroleague')}, "
          f"ec {sum(1 for r in bb_rows if r['league']=='eurocup')})")
    unmatched = [e for e in bb_events.values() if e["event_id"] not in {r["event_id"] for r in bb_rows}]
    for r in sorted(bb_rows, key=lambda r: (r["league"], r["start_ts"] or now)):
        print(f"  {r['league']} w={r['week']} eid={r['event_id']} b10={r['bets10_event_id']} "
              f"{r['home_team_slug']} - {r['away_team_slug']} "
              f"ML={r['home_odds']}/{r['away_odds']} HCP={r['hcp_line']} "
              f"({r['hcp_home_odds']}/{r['hcp_away_odds']}) TOT={r['total_line']} score={r['match_score']}")
    for e in unmatched:
        print(f"  ! eşleşmedi {e['league']} eid={e['event_id']} {e['home']} - {e['away']} ({e['tournament']})")

    if dry:
        print("\n--dry-run: yazılmadı")
        return

    for r in bb_rows:
        cur.execute(
            """
            insert into tracker.bb_fixture_bets10_link
              (league, event_id, bets10_event_id, home_team_slug, away_team_slug,
               home_team_name, away_team_name, tournament_name, start_ts, week,
               home_odds, away_odds, hcp_line, hcp_home_odds, hcp_away_odds,
               total_line, total_over_odds, total_under_odds, match_score, updated_at)
            values (%(league)s,%(event_id)s,%(bets10_event_id)s,%(home_team_slug)s,%(away_team_slug)s,
                    %(home_team_name)s,%(away_team_name)s,%(tournament_name)s,%(start_ts)s,%(week)s,
                    %(home_odds)s,%(away_odds)s,%(hcp_line)s,%(hcp_home_odds)s,%(hcp_away_odds)s,
                    %(total_line)s,%(total_over_odds)s,%(total_under_odds)s,%(match_score)s, now())
            on conflict (league, event_id) do update set
              bets10_event_id = excluded.bets10_event_id,
              home_team_slug = excluded.home_team_slug, away_team_slug = excluded.away_team_slug,
              home_team_name = excluded.home_team_name, away_team_name = excluded.away_team_name,
              tournament_name = excluded.tournament_name, start_ts = excluded.start_ts, week = excluded.week,
              home_odds = excluded.home_odds, away_odds = excluded.away_odds,
              hcp_line = excluded.hcp_line, hcp_home_odds = excluded.hcp_home_odds, hcp_away_odds = excluded.hcp_away_odds,
              total_line = excluded.total_line, total_over_odds = excluded.total_over_odds, total_under_odds = excluded.total_under_odds,
              match_score = excluded.match_score, updated_at = now()
            """,
            r,
        )
    # Eski maclar (30+ gun) tablodan dusulur; fiksture uygulanmis degerler bb_pm_fixtures'ta kalir.
    cur.execute("delete from tracker.bb_fixture_bets10_link where start_ts < now() - interval '30 days'")

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
    print(f"\nyazıldı: {len(rows)} futbol bağı + {len(bb_rows)} basketbol bağı")


if __name__ == "__main__":
    main()
