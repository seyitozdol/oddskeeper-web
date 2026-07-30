"""Bets10 DOM snapshot ayristirici (capture_odds_snippet.js v3 ciktisi).

NEDEN LINK METNI: Bets10 tum sportsbook arayuzunu shadow DOM icinde render
ediyor ve `sb-xp-sportsbook-app` shadow kokunun icerigi disaridan okunamiyor
(innerText shadow sinirini gecmiyor, textContent ise yalnizca CSS donduruyor).
Ancak mac satirinin TAMAMI <a> etiketinin metninde duruyor:

  Avrupa Ligi FC Midtjylland BeşiktaşSüper oran Bu Gece 19:00
  Maç Sonucu FC Midtjylland 2.00 Beraberlik 3.75 Beşiktaş 3.60

Basliktaki takim adlari bitisik yazilabildigi icin ("Maccabi Tel AvivSheriff
Tiraspol") oradan ayirmak guvenilir degil. Buna karsilik "Maç Sonucu"
sonrasindaki bolum takim adlarini oranlarla ayrilmis halde veriyor; ayristirma
oradan yapilir. Href ayrica eventId, spor ve lig yolunu saglar.

SINIR: Bu yontem yalnizca liste satirindaki ANA marketi (1X2 / 1-2) verir.
Alt/ust, handikap gibi diger marketler mac detay sayfasinda ve shadow DOM
icinde kaldigi icin bu yolla cikarilamiyor.
"""
from __future__ import annotations

import json
import re
import sys
from urllib.parse import unquote, urlparse

MARKET_LABEL = "Maç Sonucu"

# "Maç Sonucu <ev> <o1> Beraberlik <ox> <dep> <o2>"  (3 yollu: futbol)
THREE_WAY_RE = re.compile(
    r"Maç Sonucu\s+(?P<home>.+?)\s+(?P<o1>\d+\.\d+)\s+Beraberlik\s+"
    r"(?P<ox>\d+\.\d+)\s+(?P<away>.+?)\s+(?P<o2>\d+\.\d+)\s*$"
)
# "Maç Sonucu <ev> <o1> <dep> <o2>"  (2 yollu: basketbol/voleybol)
TWO_WAY_RE = re.compile(
    r"Maç Sonucu\s+(?P<home>.+?)\s+(?P<o1>\d+\.\d+)\s+"
    r"(?P<away>.+?)\s+(?P<o2>\d+\.\d+)\s*$"
)

SPORT_MAP = {
    "futbol": "football",
    "basketbol": "basketball",
    "voleybol": "volleyball",
}


def parse_href(href: str) -> dict:
    """/tr/spor-bahisleri/<spor>/<bolge>/<lig>/<slug>?eventId=<id>"""
    parsed = urlparse(href)
    parts = [p for p in parsed.path.split("/") if p]
    info: dict = {"event_id": None, "sport": None, "league_path": None, "slug": None}
    if "eventId=" in href:
        info["event_id"] = href.split("eventId=")[-1].split("&")[0]
    try:
        idx = parts.index("spor-bahisleri")
    except ValueError:
        return info
    rest = parts[idx + 1 :]
    if rest:
        info["sport"] = SPORT_MAP.get(rest[0], rest[0])
    if len(rest) >= 2:
        info["league_path"] = "/".join(rest[1:-1]) if len(rest) > 2 else rest[1]
    if len(rest) >= 3:
        info["slug"] = unquote(rest[-1])
    return info


def parse_anchor(text: str) -> dict | None:
    """Link metninden takim adlari + ana market oranlarini cikarir."""
    if MARKET_LABEL not in text:
        return None
    m = THREE_WAY_RE.search(text)
    if m:
        return {
            "market": "Maç Sonucu",
            "home": m.group("home").strip(),
            "away": m.group("away").strip(),
            "odds": [
                (m.group("home").strip(), float(m.group("o1"))),
                ("Beraberlik", float(m.group("ox"))),
                (m.group("away").strip(), float(m.group("o2"))),
            ],
        }
    m = TWO_WAY_RE.search(text)
    if m:
        home, away = m.group("home").strip(), m.group("away").strip()
        # 3 yollu kaliba uymayip 2 yollu kaliba uyan ama icinde 'Beraberlik'
        # gecen satirlar bozuk demektir; atla.
        if "Beraberlik" in home or "Beraberlik" in away:
            return None
        return {
            "market": "Maç Sonucu",
            "home": home,
            "away": away,
            "odds": [
                (home, float(m.group("o1"))),
                (away, float(m.group("o2"))),
            ],
        }
    return None


def competition_from_text(text: str, home: str) -> str | None:
    """Basliktaki lig adi: metnin basindan ilk takim adina kadarki kisim."""
    idx = text.find(home)
    if idx > 0:
        return text[:idx].strip() or None
    return None


def parse_dump(path: str) -> list[dict]:
    d = json.load(open(path, encoding="utf-8"))
    # event_id -> en yeni satir
    best: dict[str, dict] = {}

    for snap in d.get("snapshots", []):
        captured = snap.get("at")
        label = snap.get("label")
        for a in snap.get("anchors", []):
            href, text = a.get("href", ""), a.get("text", "")
            if "eventId=" not in href or MARKET_LABEL not in text:
                continue
            parsed = parse_anchor(text)
            if not parsed:
                continue
            info = parse_href(href)
            key = info["event_id"] or f"{parsed['home']}|{parsed['away']}"
            prev = best.get(key)
            if prev and (prev["captured_at"] or "") > (captured or ""):
                continue
            best[key] = {
                **parsed,
                **info,
                "competition": competition_from_text(text, parsed["home"]),
                "captured_at": captured,
                "snapshot_label": label,
            }

    rows: list[dict] = []
    for e in best.values():
        for selection, odds in e["odds"]:
            rows.append(
                {
                    "competition": e.get("competition"),
                    "home": e["home"],
                    "away": e["away"],
                    "start_text": None,
                    "market": e["market"],
                    "selection": selection,
                    "odds": odds,
                    "page_kind": "list",
                    "captured_at": e["captured_at"],
                    "snapshot_label": e.get("snapshot_label"),
                    "site_event_id": e.get("event_id"),
                    "sport": e.get("sport"),
                }
            )
    return rows


if __name__ == "__main__":
    rows = parse_dump(sys.argv[1])
    events: dict[tuple, list] = {}
    for r in rows:
        events.setdefault((r["home"], r["away"]), []).append(r)
    print(f"{len(rows)} satir, {len(events)} mac\n")
    for (h, a), rs in events.items():
        vals = ", ".join(f"{x['selection']}={x['odds']}" for x in rs)
        print(f"{h} - {a}  [{rs[0]['sport']}] {rs[0]['competition']}")
        print(f"   {rs[0]['market']}: {vals}")
