# -*- coding: utf-8 -*-
"""Bets10 ag-yakalama (capture_odds_vps.py) dump ayristirici.

Oranlar `/api/sb/v1/widgets/events-table/v2` XHR yanitinda TEMIZ JSON olarak
geliyor (2026-07-30 VPS spike'inda dogrulandi, TR-geo proxy ile). Yapisi:

  data.events[]     : {id, participants[{label, side}], competitionName, startDate}
  data.markets[]    : {id, eventId, marketTemplateId, label}   (E1X2M=1X2, EOU25M=A/U 2.5)
  data.selections[] : {marketId, odds(sayi), selectionTemplateId, participantLabel, label}

selectionTemplateId: 1X2 -> HOME/DRAW/AWAY ; Alt/Ust -> OVER/UNDER.

Cikti satirlari load_site_odds.py ile uyumlu (home/away/market/selection/odds...).
Not: DOM kazima (parse_bets10_snapshot.py) yerine bu kullanilir; cok daha temiz.
"""
from __future__ import annotations

import json
import re
import sys

# marketTemplateId -> okunabilir market adi
MARKET_NAME = {
    "E1X2M": "Maç Sonucu",
    "EOU25M": "Alt/Üst 2.5",
    "EOU15M": "Alt/Üst 1.5",
    "EOU35M": "Alt/Üst 3.5",
    "EBTSM": "Karşılıklı Gol",
    "EDCM": "Çifte Şans",
}
# selectionTemplateId -> okunabilir secim (takim adi ayrica participantLabel'dan)
SEL_NAME = {"DRAW": "Beraberlik", "OVER": "Üst", "UNDER": "Alt", "YES": "Var", "NO": "Yok"}

# categoryName -> tracker.upcoming_events.sport degeri. Basketbol 2-yollu (beraberlik
# yok); parser secimleri selectionTemplateId'den turettigi icin ek is gerekmez.
SPORT_MAP = {"Futbol": "football", "Basketbol": "basketball", "Voleybol": "volleyball"}

# SANAL / E-SPOR ELEME: Bets10 gercek kulup adlariyla 7/24 donen simulasyon
# maclari sunuyor (competitionName 'eFutbol Turkiye - 8 dakika', 'e-Basketbol
# Valhalla', 'eBasketball NextGen'...; takim adinda oyuncu takma adi
# 'Galatasaray (lzrn)'). Bunlar GERCEK fiksture cok benziyor ve matcher'i
# yaniltiyordu (Galatasaray (lzrn) -> gercek Galatasaray-Basaksehir 0.90). Tum
# sanal ligler 'e' oneki + Futbol/Basketbol/Football/Basketball ile basliyor;
# 'El Salvador', 'Euroleague', 'Ekvador' gibi GERCEK ligleri etkilemez.
_ESPORTS_RE = re.compile(r"^\s*e-?\s*(futbol|basketbol|football|basketball)", re.IGNORECASE)
# Oyuncu takma adi / sunucu etiketi parantezi: 'Galatasaray (lzrn)', 'Boston
# Celtics (Kiev)'. GERCEK maclarda parantez EN FAZLA bir tarafta olur ve ulke
# kodu/ayirt edicidir ('CA River Plate (Arg)', 'FC Iberia 1999 (Saburtalo)').
_TAG_RE = re.compile(r"\([^)]+\)")


def is_esports(competition: str | None) -> bool:
    return bool(competition and _ESPORTS_RE.match(competition))


def _has_tag(label: str | None) -> bool:
    return bool(label and _TAG_RE.search(label))


def is_virtual(competition: str | None, home: str | None, away: str | None) -> bool:
    """Sanal/e-spor maci mi? (1) competitionName 'e-Futbol/Basketbol...' oneki,
    veya (2) HER IKI takim adinda da parantez tag'i (competitionName bos gelen
    sanal NBA maclarini yakalar: 'Boston Celtics (Kiev)' / 'Milwaukee Bucks
    (Krakow)'). Tek tarafli parantez GERCEKtir (ulke kodu), elenmez."""
    return is_esports(competition) or (_has_tag(home) and _has_tag(away))


def rows_from_events_table(body: dict, captured_at: str | None, label: str | None) -> list[dict]:
    data = body.get("data") or {}
    events = {}
    for ev in data.get("events") or []:
        parts = sorted(ev.get("participants") or [], key=lambda p: p.get("side", 0))
        home = next((p.get("label") for p in parts if p.get("side") == 1), None)
        away = next((p.get("label") for p in parts if p.get("side") == 2), None)
        if not home or not away:
            continue
        if is_virtual(ev.get("competitionName"), home, away):
            continue
        events[ev.get("id")] = {
            "home": home, "away": away,
            "competition": ev.get("competitionName"),
            "start": ev.get("startDate"),
            "sport": SPORT_MAP.get(ev.get("categoryName"), "football"),
        }
    markets = {}
    for m in data.get("markets") or []:
        markets[m.get("id")] = {
            "eventId": m.get("eventId"),
            "template": m.get("marketTemplateId"),
            "label": m.get("marketFriendlyName") or m.get("label"),
            "line": m.get("lineValue") or "",
        }

    out: list[dict] = []
    for sel in data.get("selections") or []:
        odds = sel.get("odds")
        if odds is None:
            continue
        mk = markets.get(sel.get("marketId"))
        if not mk:
            continue
        ev = events.get(mk["eventId"])
        if not ev:
            continue
        tmpl = sel.get("selectionTemplateId") or ""
        if tmpl in ("HOME", "AWAY"):
            selection = sel.get("participantLabel") or sel.get("label")
        else:
            selection = SEL_NAME.get(tmpl, sel.get("label") or tmpl)
            if tmpl in ("OVER", "UNDER") and mk.get("line"):
                selection = f"{selection} {mk['line']}"
        market_name = MARKET_NAME.get(mk["template"], mk.get("label") or mk["template"])
        out.append({
            "competition": ev["competition"],
            "home": ev["home"],
            "away": ev["away"],
            "start_text": ev["start"],
            "market": market_name,
            "selection": selection,
            "odds": float(odds),
            "page_kind": "events-table",
            "captured_at": captured_at,
            "snapshot_label": label,
            "site_event_id": mk["eventId"],
            "sport": ev.get("sport", "football"),
            "listed_only": False,
        })
    return out


def parse_dump(path: str) -> list[dict]:
    """capture_odds_vps.py netcap dump'indan (responses[]) satirlari cikarir."""
    d = json.load(open(path, encoding="utf-8"))
    rows: list[dict] = []
    # ayni event-market birden cok yakalanabilir; en yeni kazanir
    best: dict[tuple, dict] = {}
    for r in d.get("responses") or []:
        if "events-table" not in r.get("url", ""):
            continue
        body = r.get("json")
        if not body:
            continue
        for row in rows_from_events_table(body, r.get("at") or d.get("dumpedAt"), None):
            key = (row["home"], row["away"], row["market"], row["selection"])
            prev = best.get(key)
            if prev is None or (row["captured_at"] or "") >= (prev["captured_at"] or ""):
                best[key] = row
    rows = list(best.values())
    return rows


if __name__ == "__main__":
    rows = parse_dump(sys.argv[1])
    ev: dict[tuple, list] = {}
    for r in rows:
        ev.setdefault((r["home"], r["away"]), []).append(r)
    print(f"{len(rows)} satir, {len(ev)} mac\n")
    for (h, a), rs in ev.items():
        print(f"{h} - {a}  ({rs[0]['competition']}, {rs[0]['start_text']})")
        for x in sorted(rs, key=lambda z: z["market"]):
            print(f"    {x['market']:14s} {x['selection']:22s} {x['odds']}")
