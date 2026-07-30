"""Bahis sitesi oran yukleyici (DOM snapshot dump'indan).

Akis:
  1. capture_odds_snippet.js dump'i ayristirilir (site'ye gore parser secilir).
  2. Ham satirlar tracker.site_event_odds'a upsert edilir.
  3. Sitenin takim adlari bizim tracker.upcoming_events kayitlariyla eslestirilir
     ve tracker.event_odds_availability doldurulur (has_odds + market_count).

Kullanim:
  python load_site_odds.py <dump.json> [--dry-run]

Site adi dump'in icindeki hostname'den cikarilir (bet365 / bets10).
Eslestirme SAAT ile degil TAKIM ADI ile yapilir: bet365 kendi yerel saat
dilimini gosteriyor (TSI'den 1 saat geri goruldu).
"""
from __future__ import annotations

import json
import os
import sys
import unicodedata

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_bet365_snapshot import parse_dump as parse_bet365  # noqa: E402

# Takim adi normalizasyonunda atilacak kulup ekleri. u16/u18/u21 gibi yas
# belirtecleri KASITLI olarak birakilir; atilirsa farkli yas gruplari birbirine
# karisir (repoda daha once yasanan isim eslestirme tuzagi).
CLUB_STOPWORDS = {
    "fc", "sc", "sk", "jk", "fk", "cf", "ac", "as", "if", "bk", "bc",
    "club", "kulubu", "spor", "sports", "sportif", "afc", "cfr", "ks",
    "tc", "sv", "vfl", "vfb", "fsv", "rc", "us", "ss", "ssc", "aik",
}

MATCH_THRESHOLD = 0.55
MARGIN = 0.15  # en iyi ile ikinci arasindaki asgari fark


def fold(text: str) -> str:
    """Turkce karakterleri ASCII'ye indirger, kucuk harfe cevirir."""
    s = text.replace("ı", "i").replace("İ", "i").replace("ş", "s")
    s = s.replace("Ş", "s").replace("ğ", "g").replace("Ğ", "g")
    s = s.replace("ç", "c").replace("Ç", "c").replace("ö", "o")
    s = s.replace("Ö", "o").replace("ü", "u").replace("Ü", "u")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def tokens(name: str) -> set[str]:
    s = fold(name)
    raw = [t for t in "".join(c if c.isalnum() else " " for c in s).split() if t]
    keep = [t for t in raw if t not in CLUB_STOPWORDS and len(t) > 1]
    return set(keep or raw)


def name_score(a: str, b: str) -> float:
    """0..1 benzerlik. Token kesisimi + kapsama (substring) birlesimi."""
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    jac = len(inter) / len(ta | tb)
    # kapsama: bir tarafin tum anlamli tokenlari digerinde geciyorsa guclu sinyal
    cover = max(len(inter) / len(ta), len(inter) / len(tb))
    fa, fb = fold(a).replace(" ", ""), fold(b).replace(" ", "")
    sub = 1.0 if (fa and fb and (fa in fb or fb in fa)) else 0.0
    return max(jac, cover * 0.9, sub * 0.85)


def pair_score(site_home: str, site_away: str, ev: dict) -> float:
    h = name_score(site_home, ev["home_team_name"])
    a = name_score(site_away, ev["away_team_name"])
    # iki taraf da makul olmali; tek taraf guclu olsa bile digeri cokerse esleme yok
    if min(h, a) < 0.3:
        return 0.0
    return (h + a) / 2


def resolve(site_events: list[tuple[str, str]], our_events: list[dict]) -> dict:
    """(home, away) -> {event_id, score}. Belirsiz eslesmeler atlanir."""
    out = {}
    for home, away in site_events:
        scored = []
        for ev in our_events:
            s = pair_score(home, away, ev)
            if s > 0:
                scored.append((s, ev))
        if not scored:
            continue
        scored.sort(key=lambda t: t[0], reverse=True)
        best_score, best_ev = scored[0]
        second = scored[1][0] if len(scored) > 1 else 0.0
        if best_score >= MATCH_THRESHOLD and (best_score - second) >= MARGIN:
            out[(home, away)] = {
                "event_id": best_ev["event_id"],
                "score": round(best_score, 3),
                "our": f"{best_ev['home_team_name']} - {best_ev['away_team_name']}",
            }
    return out


PARSERS = {"bet365": parse_bet365}


def site_from_dump(path: str) -> str:
    host = json.load(open(path, encoding="utf-8")).get("site", "")
    if "bet365" in host:
        return "bet365"
    if "bets10" in host:
        return "bets10"
    raise SystemExit(f"site taninmadi: {host!r}")


def main() -> None:
    path = sys.argv[1]
    dry = "--dry-run" in sys.argv

    site = site_from_dump(path)
    parser = PARSERS.get(site)
    if parser is None:
        raise SystemExit(
            f"{site} icin parser yok. Once bu sitenin snapshot yapisi cozulmeli."
        )

    rows = parser(path)
    if not rows:
        raise SystemExit("dump'tan hic satir cikarilamadi")

    # Ayni (market, selection) birden fazla snapshot'ta varsa en yenisini tut.
    dedup: dict[tuple, dict] = {}
    for r in rows:
        key = (r["home"], r["away"], r["market"], r["selection"] or "")
        prev = dedup.get(key)
        if prev is None or (r.get("captured_at") or "") >= (prev.get("captured_at") or ""):
            dedup[key] = r
    rows = list(dedup.values())

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(
        """
        select event_id, home_team_name, away_team_name, sport, start_ts
        from tracker.upcoming_events
        where status_type in ('notstarted','inprogress')
          and start_ts > now() - interval '6 hours'
        """
    )
    our = [
        {
            "event_id": r[0],
            "home_team_name": r[1],
            "away_team_name": r[2],
            "sport": r[3],
            "start_ts": r[4],
        }
        for r in cur.fetchall()
    ]

    site_pairs = sorted({(r["home"], r["away"]) for r in rows})
    matches = resolve(site_pairs, our)

    print(f"site: {site}")
    print(f"dump'tan {len(rows)} satir, {len(site_pairs)} mac")
    print(f"bizim takipteki mac sayisi: {len(our)}")
    print(f"ESLESEN: {len(matches)}\n")
    for (h, a), m in sorted(matches.items()):
        print(f"  [{m['score']}] {h} - {a}   ->   {m['our']}")
    unmatched = [p for p in site_pairs if p not in matches]
    print(f"\neslesmeyen site maci: {len(unmatched)} (bizim listede olmayanlar dahil)")

    if dry:
        print("\n--dry-run: veritabanina yazilmadi")
        return

    for r in rows:
        cur.execute(
            """
            insert into tracker.site_event_odds (
                site, home_team_name, away_team_name, market_name, selection,
                odds, competition, start_text, page_kind, snapshot_label, captured_at
            ) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            on conflict (site, home_team_name, away_team_name, market_name, selection)
            do update set
                odds = excluded.odds,
                competition = excluded.competition,
                start_text = excluded.start_text,
                page_kind = excluded.page_kind,
                snapshot_label = excluded.snapshot_label,
                captured_at = excluded.captured_at
            """,
            (
                site, r["home"], r["away"], r["market"], r["selection"] or "",
                r["odds"], r.get("competition"), r.get("start_text"),
                r.get("page_kind"), r.get("snapshot_label"), r["captured_at"],
            ),
        )

    # market sayisi: mac basina benzersiz market adedi
    per_event: dict[int, dict] = {}
    for (h, a), m in matches.items():
        mkts = {r["market"] for r in rows if r["home"] == h and r["away"] == a}
        per_event[m["event_id"]] = {
            "market_count": len(mkts),
            "home": h,
            "away": a,
            "score": m["score"],
        }

    for event_id, info in per_event.items():
        cur.execute(
            """
            insert into tracker.event_odds_availability (
                event_id, site, has_odds, market_count,
                site_home_name, site_away_name, match_score, checked_at
            ) values (%s,%s,true,%s,%s,%s,%s,now())
            on conflict (event_id, site) do update set
                has_odds = true,
                market_count = excluded.market_count,
                site_home_name = excluded.site_home_name,
                site_away_name = excluded.site_away_name,
                match_score = excluded.match_score,
                checked_at = now()
            """,
            (
                event_id, site, info["market_count"],
                info["home"], info["away"], info["score"],
            ),
        )

    # Bu sitede taradigimiz ama bulamadigimiz maclar: has_odds = false.
    # Yalnizca snapshot'ta ilgili spor/turnuva gorulduyse anlamli olurdu; bu yuzden
    # simdilik SADECE eslesmeyenleri false yazmiyoruz (yanlis negatif riski).
    conn.commit()
    conn.close()
    print(f"\nyazildi: {len(rows)} ham satir, {len(per_event)} mac isaretlendi")


if __name__ == "__main__":
    main()
