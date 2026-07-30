"""bet365 DOM snapshot ayristirici (capture_odds_snippet.js v3 ciktisi).

Girdi: pipeline/browser/capture_odds_snippet.js ile alinan dump JSON'u.
Cikti: [{sport, competition, home, away, start_text, market, selection, odds}]

Iki sayfa tipi ayristirilir:
  LISTE  : bir sayfada onlarca mac + 1X2 (ya da 2 yollu) oranlari.
           Iki farkli duzen gorulmustur; ikisi de desteklenir.
  DETAY  : tek mac, tum market bloklari (Full Time Result, To Qualify,
           Both Teams to Score, Goals Over/Under, ...).

Not: bet365 saatleri kendi yerel diliminde gosteriyor (TSI'den 1 saat geri
goruldu), bu yuzden eslestirme SAAT ile degil TAKIM ADI ile yapilir; saat
yalnizca dogrulama icin saklanir.
"""
from __future__ import annotations

import json
import re
import sys

# Sol menu ve alt bilgi gurultusu: icerik bu isaretler arasinda.
NAV_TAIL = ("Ski Jumping", "Alpine Skiing", "Winter Sports")
FOOTER_HEADS = (
    "Receive live updates",
    "Information and transmission delays",
    "Gambling can be addictive",
    "Open Alerts",
)

TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")
ODDS_RE = re.compile(r"^\d+(?:\.\d+)?$")
DECIMAL_ODDS_RE = re.compile(r"^\d+\.\d+$")
DATE_RE = re.compile(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w{3}$")
DATETIME_RE = re.compile(r"^\d{1,2}\s+\w{3}\s+\d{1,2}:\d{2}$")
INT_RE = re.compile(r"^\d+$")
AGG_RE = re.compile(r"^\(\d+\)\s*-\s*\(\d+\)$")

# Market blogu basliklarindan sonra gelen ve atlanacak etiketler.
MARKET_NOISE = {
    "BB",
    "90'",
    "+ Stoppage Time",
    "ET",
    "Includes Extra Time",
    "SUB ON PLAY ON",
    "Bet Builder",
    "",
}

# Sekme / bolum adlari: market basligi sayilmamalari icin.
TAB_NAMES = {
    "Popular",
    "Bet Builder",
    "Scorers",
    "Shots",
    "Result",
    "Corners",
    "Goals",
    "Half",
    "Other",
    "Asian Lines",
    "Matches",
    "Bet Boost",
    "Bet Builder +",
    "All",
    "Featured",
    "Competitions",
    "Outrights",
    "Offers",
    "Markets",
    "Show more",
}

# Detay sayfasinda ilgilendigimiz market basliklari (whitelist degil, sadece
# bu isimler gorulurse market blogu baslangici kabul edilir).
KNOWN_MARKETS = (
    "Full Time Result",
    "To Qualify",
    "Double Chance",
    "Both Teams to Score",
    "Goals Over/Under",
    "Alternative Total Goals",
    "Result/Both Teams to Score",
    "To Score in Both Halves",
    "Method Of Qualification",
    "Half Time/Full Time",
    "Correct Score",
    "Total Goals",
    "Draw No Bet",
    "Asian Handicap",
    "Match Handicap",
    "Money Line",
    "Game Total",
    "Total Points",
    "Point Handicap",
    "Either to Score",
    "Either to Score First",
    "Player Shots On Target",
    "Player Shots",
    "Goalscorers",
)


def clean_lines(body_text: str) -> list[str]:
    """Menu ve footer gurultusunu atip anlamli satirlari dondurur."""
    lines = [ln.strip() for ln in body_text.split("\n")]
    start = 0
    for marker in NAV_TAIL:
        for i, ln in enumerate(lines):
            if ln == marker and i > start:
                start = i + 1
    end = len(lines)
    for head in FOOTER_HEADS:
        for i, ln in enumerate(lines):
            if i > start and ln.startswith(head):
                end = min(end, i)
                break
    return [ln for ln in lines[start:end] if ln]


def looks_like_team(line: str) -> bool:
    if not line or len(line) > 60:
        return False
    if TIME_RE.match(line) or DATE_RE.match(line) or DATETIME_RE.match(line):
        return False
    if INT_RE.match(line) or DECIMAL_ODDS_RE.match(line) or AGG_RE.match(line):
        return False
    if line in TAB_NAMES or line in MARKET_NOISE:
        return False
    if line in ("1", "X", "2", "Over", "Under", "Yes", "No", "Draw"):
        return False
    # cok fazla rakam iceren satirlar takim adi degil
    digits = sum(c.isdigit() for c in line)
    return digits <= len(line) // 3


def parse_list_page(lines: list[str]) -> list[dict]:
    """Liste sayfasi: mac basina 1X2 (3 yollu) veya 1-2 (2 yollu) oranlari.

    Iki duzen:
      A) TIME, HOME, AWAY, [int]*, o1, oX, o2
      B) DATE, HOME, AWAY, [int]*, TIME, [int]?, '1', o1, 'X', oX, '2', o2
    """
    out: list[dict] = []
    competition = None
    i = 0
    n = len(lines)

    while i < n:
        ln = lines[i]

        # rekabet basligi: 'Qualifying', 'League', 'Cup', 'Lig' vs iceren ve
        # ardindan tarih/saat gelen satirlar
        if looks_like_team(ln) and re.search(
            r"(Qualif|League|Cup|Lig|Division|Liga|Serie|Friendl|EuroBasket|Championship|Super)",
            ln,
            re.I,
        ):
            competition = ln
            i += 1
            continue

        # duzen A: saat once
        if TIME_RE.match(ln) and i + 2 < n:
            home, away = lines[i + 1], lines[i + 2]
            if looks_like_team(home) and looks_like_team(away):
                odds, j = collect_odds(lines, i + 3, want=3)
                if len(odds) >= 2:
                    out.extend(
                        make_rows(competition, home, away, ln, odds, "list")
                    )
                    i = j
                    continue

        # duzen B: tarih once, saat ortada
        if DATE_RE.match(ln) and i + 2 < n:
            home, away = lines[i + 1], lines[i + 2]
            if looks_like_team(home) and looks_like_team(away):
                # saati bul
                k = i + 3
                time_text = None
                while k < min(i + 9, n):
                    if TIME_RE.match(lines[k]):
                        time_text = lines[k]
                        k += 1
                        break
                    k += 1
                if time_text:
                    odds, j = collect_odds(lines, k, want=3)
                    if len(odds) >= 2:
                        out.extend(
                            make_rows(
                                competition, home, away, time_text, odds, "list"
                            )
                        )
                        i = j
                        continue
        i += 1

    return out


def collect_odds(lines: list[str], start: int, want: int) -> tuple[list[str], int]:
    """start'tan itibaren ondalikli oranlari toplar; '1'/'X'/'2' etiketlerini
    ve tek haneli sayac/rozet degerlerini atlar."""
    odds: list[str] = []
    i = start
    n = len(lines)
    guard = 0
    while i < n and len(odds) < want and guard < 12:
        ln = lines[i]
        if DECIMAL_ODDS_RE.match(ln):
            odds.append(ln)
        elif ln in ("1", "X", "2") or INT_RE.match(ln) or AGG_RE.match(ln):
            pass
        else:
            break
        i += 1
        guard += 1
    return odds, i


def make_rows(
    competition: str | None,
    home: str,
    away: str,
    start_text: str,
    odds: list[str],
    page_kind: str,
) -> list[dict]:
    if len(odds) >= 3:
        market = "Full Time Result"
        sels = [home, "Draw", away]
    else:
        market = "Match Winner"
        sels = [home, away]
    rows = []
    for sel, od in zip(sels, odds):
        rows.append(
            {
                "competition": competition,
                "home": home,
                "away": away,
                "start_text": start_text,
                "market": market,
                "selection": sel,
                "odds": float(od),
                "page_kind": page_kind,
            }
        )
    return rows


def parse_detail_page(lines: list[str]) -> list[dict]:
    """Detay sayfasi: bas kisimdan mac kimligi, sonra market bloklari."""
    competition = None
    start_text = None
    home = away = None

    # bas kismi iki bicimde gorulur:
    #   A) competition / '30 Jul 19:00' / 'Midtjylland v Besiktas'
    #   B) competition / '30 Jul 18:00' / 'FC Inter' / '(1) - (1)' / 'Basaksehir'
    # Arada '•' gibi ayrac satirlar olabilir.
    for i, ln in enumerate(lines[:40]):
        if not DATETIME_RE.match(ln):
            continue
        start_text = ln
        # rekabet adini geriye dogru ara (ayrac satirlarini atla)
        for back in range(i - 1, max(-1, i - 5), -1):
            cand_comp = lines[back]
            if looks_like_team(cand_comp) and len(cand_comp) > 4:
                competition = cand_comp
                break
        # A bicimi: ' v ' ayracli tek satir
        for nxt in lines[i + 1 : i + 4]:
            if " v " in nxt and not AGG_RE.match(nxt):
                parts = [p.strip() for p in nxt.split(" v ", 1)]
                if len(parts) == 2 and all(looks_like_team(p) for p in parts):
                    home, away = parts
                    break
        # B bicimi: iki ayri satir, aradaki skor satiri atlanir
        if not home:
            cand = [
                x
                for x in lines[i + 1 : i + 6]
                if looks_like_team(x) and " v " not in x
            ]
            if len(cand) >= 2:
                home, away = cand[0], cand[1]
        break

    if not home or not away:
        return []

    base = {
        "competition": competition,
        "home": home,
        "away": away,
        "start_text": start_text,
        "page_kind": "detail",
    }

    out: list[dict] = []
    seen_markets: set[str] = set()

    for i, ln in enumerate(lines):
        if ln not in KNOWN_MARKETS or ln in seen_markets:
            continue
        seen_markets.add(ln)
        shape = MARKET_SHAPES.get(ln)
        pairs = (
            extract_shaped(lines, i + 1, shape, home, away) if shape else None
        )
        if pairs:
            for sel, od in pairs:
                out.append({**base, "market": ln, "selection": sel, "odds": od})
        else:
            # Sekli bilinmeyen ya da dogrulanamayan market: yalnizca VARLIK
            # kaydedilir. Yanlis oran yazmaktansa oransiz kaydetmek yeglenir.
            out.append({**base, "market": ln, "selection": None, "odds": None})
    return out


# Market sekilleri: secim etiketleri sabit olanlarda oran guvenle okunabilir.
# Izgara duzenli marketler (Correct Score, Half Time/Full Time, Player Shots
# gibi) innerText'te satir/kolon duzeni kayboldugu icin BILEREK haric; onlar
# yalnizca 'market var' bilgisiyle kaydedilir.
MARKET_SHAPES: dict[str, str] = {
    "Full Time Result": "three",
    "To Qualify": "two",
    "Draw No Bet": "two",
    "Match Winner": "two",
    "Money Line": "two",
    "Both Teams to Score": "yesno",
    "Goals Over/Under": "overunder",
    "Total Points": "overunder",
    "Game Total": "overunder",
}


def extract_shaped(
    lines: list[str], start: int, shape: str, home: str, away: str
) -> list[tuple[str, float]] | None:
    """Beklenen secim etiketlerini ve oranlarini sirayla okur.

    Etiketler beklenenle uyusmazsa None doner (yanlis atama yapmamak icin).
    """
    if shape == "three":
        wanted = [home, ("Draw", "Tie"), away]
    elif shape == "two":
        wanted = [home, away]
    elif shape == "yesno":
        wanted = [("Yes",), ("No",)]
    elif shape == "overunder":
        wanted = [("Over",), ("Under",)]
    else:
        return None

    pairs: list[tuple[str, float]] = []
    idx = 0
    pending: str | None = None
    line_value: str | None = None
    i = start
    limit = min(len(lines), start + 40)

    while i < limit and idx < len(wanted):
        cur = lines[i]
        if cur in MARKET_NOISE or cur in TAB_NAMES:
            i += 1
            continue
        # baska bir market basligina girdiysek bitir
        if cur in KNOWN_MARKETS:
            break
        expected = wanted[idx]
        names = (expected,) if isinstance(expected, str) else expected
        if cur in names:
            pending = cur
            i += 1
            continue
        if DECIMAL_ODDS_RE.match(cur):
            if pending is None:
                # Alt/ust marketlerinde ilk ondalik SECIM DEGIL, cizgi degeri
                # (ornek: "2.5" sonra Over 1.80 / Under 2.00). Bir kez izin ver.
                if shape == "overunder" and not pairs and line_value is None:
                    line_value = cur
                    i += 1
                    continue
                # oran geldi ama etiket gormedik: blok beklenen sekilde degil
                return None
            label = pending if line_value is None else f"{pending} {line_value}"
            pairs.append((label, float(cur)))
            pending = None
            idx += 1
            i += 1
            continue
        i += 1

    return pairs if len(pairs) == len(wanted) else None


def parse_dump(path: str) -> list[dict]:
    d = json.load(open(path, encoding="utf-8"))
    rows: list[dict] = []
    for snap in d.get("snapshots", []):
        lines = clean_lines(snap.get("bodyText", ""))
        label = snap.get("label")
        detail = parse_detail_page(lines)
        got = detail if detail else parse_list_page(lines)
        for r in got:
            r["snapshot_label"] = label
            r["captured_at"] = snap.get("at")
        rows.extend(got)
    return rows


if __name__ == "__main__":
    rows = parse_dump(sys.argv[1])
    events = {}
    for r in rows:
        events.setdefault((r["home"], r["away"]), []).append(r)
    print(f"{len(rows)} satir, {len(events)} mac\n")
    for (h, a), rs in events.items():
        markets = sorted({x["market"] for x in rs})
        print(f"{h} - {a}  ({rs[0]['competition']}, {rs[0]['start_text']})")
        print(f"   market: {', '.join(markets)}")
        ftr = [x for x in rs if x["market"] in ("Full Time Result", "Match Winner")]
        if ftr:
            print(
                "   sonuc oranlari: "
                + ", ".join(f"{x['selection']}={x['odds']}" for x in ftr if x["odds"])
            )
