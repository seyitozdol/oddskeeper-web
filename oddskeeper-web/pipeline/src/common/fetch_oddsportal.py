# -*- coding: utf-8 -*-
"""OddsPortal oranlari (site='oddsportal') - 3. kaynak, oran karsilastirma.

OddsPortal VPS Alman IP'sinden direkt yukleniyor (Cloudflare challenge YOK,
proxy/GB gerekmez - 2026-07-30 dogrulandi). Oranlar DOM'da render:
  mac satiri = div.group.flex; ilk cocuk "20:30Galatasaray–Corum" (saat+ev–dep),
  sonraki 3 cocuk 1X2 orani. Lig sayfasi o ligin yaklasan maclarini + 1X2 verir.

Turk domestic (Super Lig/1.Lig) + Avrupa kupalarini kapsar - en genis kaynak.
Headful Chromium + Xvfb (sistem chromium). Eslestirme load_site_odds.resolve.
tracker.site_event_odds + event_odds_availability'ye site='oddsportal' yazar.

Kullanim: xvfb-run -a python fetch_oddsportal.py [--dry-run] [--chromium-path P]
"""
from __future__ import annotations

import datetime
import os
import sys

import psycopg2
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load_site_odds import resolve  # takim-adi eslestirme  # noqa: E402

BASE = "https://www.oddsportal.com"
LEAGUES = [
    ("Süper Lig", "/football/turkey/super-lig/"),
    ("1. Lig", "/football/turkey/1-lig/"),
    ("Şampiyonlar Ligi", "/football/europe/champions-league/"),
    ("Avrupa Ligi", "/football/europe/europa-league/"),
    ("Konferans Ligi", "/football/europe/conference-league/"),
]
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")

# Sayfadaki mac satirlarini cikaran JS. div.group.flex: [saat+ev–dep, o1, ox, o2].
EXTRACT_JS = r"""() => {
  const out = [];
  const rows = document.querySelectorAll('div.group.flex, div[class~="group"]');
  for (const row of rows) {
    const kids = Array.from(row.children).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim());
    if (kids.length < 4) continue;
    const head = kids[0];
    // saat (HH:MM) opsiyonel + ev–dep (en-dash veya tire)
    const m = head.match(/^(\d{1,2}:\d{2})?\s*(.+?)\s*[–—]\s*(.+)$/);
    if (!m) continue;
    const odds = kids.slice(1).filter(k => /^\d+\.\d{1,2}$/.test(k));
    if (odds.length < 3) continue;
    // OddsPortal Avrupa sayfalarinda takim adina " (Tur)" gibi ulke eki koyuyor;
    // eslestirmeyi bozmasin diye temizle.
    const strip = (s) => s.replace(/\s*\([A-Za-z]{2,3}\)\s*$/, '').trim();
    const home = strip(m[2]), away = strip(m[3]);
    if (!home || !away || home.length > 40 || away.length > 40) continue;
    out.push({ home, away, o1: odds[0], ox: odds[1], o2: odds[2] });
  }
  // benzersiz (home,away)
  const seen = new Set(), uniq = [];
  for (const r of out) { const k = r.home + '|' + r.away; if (!seen.has(k)) { seen.add(k); uniq.push(r); } }
  return uniq;
}"""


def scrape(chromium_path: str | None) -> list[dict]:
    rows: list[dict] = []
    with sync_playwright() as pw:
        kw = {"headless": False}
        if chromium_path:
            kw["executable_path"] = chromium_path
        b = pw.chromium.launch(**kw)
        ctx = b.new_context(locale="en-GB", viewport={"width": 1600, "height": 1050}, user_agent=UA)
        p = ctx.new_page()
        for name, path in LEAGUES:
            try:
                p.goto(BASE + path, timeout=45000, wait_until="commit")
            except Exception as ex:
                print(f"[atlandi] {name}: {type(ex).__name__}", flush=True)
                continue
            p.wait_for_timeout(15000)
            try:
                found = p.evaluate(EXTRACT_JS)
            except Exception as ex:
                print(f"[hata] {name}: {type(ex).__name__}", flush=True)
                continue
            for r in found:
                r["competition"] = name
            rows.extend(found)
            print(f"[{name}] {len(found)} mac", flush=True)
        b.close()
    # global benzersiz
    seen, uniq = set(), []
    for r in rows:
        k = (r["home"], r["away"])
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq


def main() -> None:
    dry = "--dry-run" in sys.argv
    chromium_path = None
    for a in sys.argv:
        if a == "--chromium-path":
            i = sys.argv.index(a)
            chromium_path = sys.argv[i + 1] if i + 1 < len(sys.argv) else None

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(
        "select event_id, home_team_name, away_team_name from tracker.upcoming_events "
        "where sport='football' and status_type in ('notstarted','inprogress') "
        "and start_ts > now() - interval '6 hours'"
    )
    our = [{"event_id": r[0], "home_team_name": r[1], "away_team_name": r[2]} for r in cur.fetchall()]

    scraped = scrape(chromium_path)
    print(f"OddsPortal: {len(scraped)} mac (1X2)", flush=True)

    # her mac icin 3 secim satiri
    site_rows: list[dict] = []
    for r in scraped:
        for sel, odd in [(r["home"], r["o1"]), ("Beraberlik", r["ox"]), (r["away"], r["o2"])]:
            try:
                site_rows.append({"home": r["home"], "away": r["away"], "market": "Maç Sonucu",
                                  "selection": sel, "odds": float(odd)})
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
                   values ('oddsportal',%s,%s,%s,%s,%s,'OddsPortal',null,'oddsportal','oddsportal',%s)
                   on conflict (site, home_team_name, away_team_name, market_name, selection)
                   do update set odds=excluded.odds, captured_at=excluded.captured_at""",
                (h, a, r["market"], r["selection"], r["odds"], now_iso),
            )
    for eid, info in per_event.items():
        cur.execute(
            """insert into tracker.event_odds_availability
               (event_id, site, has_odds, listed, market_count, site_home_name, site_away_name, match_score, checked_at)
               values (%s,'oddsportal',true,true,%s,%s,%s,%s,now())
               on conflict (event_id, site) do update set
                 has_odds=true, listed=true, market_count=excluded.market_count,
                 site_home_name=excluded.site_home_name, site_away_name=excluded.site_away_name,
                 match_score=excluded.match_score, checked_at=now()""",
            (eid, len(info["markets"]), info["home"], info["away"], info["score"]),
        )
    conn.commit()
    conn.close()
    print(f"yazildi: {len(per_event)} mac oddsportal oranli isaretlendi")


if __name__ == "__main__":
    main()
