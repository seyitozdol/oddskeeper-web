# -*- coding: utf-8 -*-
"""Transfermarkt'tan TFF 1. Lig oyunculari icin piyasa degerleri (sofascore id'li).

Akis:
  1. pipeline/data/sofascore/*/lineup_*.json dosyalarindan oyuncu kimlik bilgisi
     toplanir (id, isim, dogum tarihi, boy, ulke, pozisyon) ve
     football.sofascore_player_info tablosuna upsert edilir.
  2. TM TR2 (1. Lig) + TR1 (Super Lig, yukselen takimlarin oyunculari icin)
     kulup kadrolari cekilir (guncel sezon 2026/27).
  3. TM oyunculari dogum tarihi + isim kesisimiyle sofascore oyuncularina eslenir.
  4. football.tff1_player_market_values (sofascore_player_id pk) tablosuna upsert.

Elle calistirilir: .venv\\Scripts\\python.exe src\\football\\fetch_transfermarkt_values_tff1.py
Istekler arasi 3 sn (~40 istek).
"""
import json
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
BASE = "https://www.transfermarkt.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}
DELAY = 3
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def norm(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().replace("ı", "i").replace("ø", "o").replace("ß", "ss").replace("đ", "d")
    return re.sub(r"[^a-z0-9 ]", "", text).strip()


def fetch(url):
    # Site ara ara zaman asimi veriyor; birkac kez tekrar dene.
    last = None
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=45)
            resp.raise_for_status()
            time.sleep(DELAY)
            return resp.text
        except requests.RequestException as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise last


def parse_market_value(text):
    text = text.strip().replace("€", "")
    m = re.match(r"^([\d.]+)(m|k)$", text)
    if not m:
        return None
    return int(float(m.group(1)) * (1_000_000 if m.group(2) == "m" else 1_000))


def parse_squad(html):
    players = []
    for chunk in re.split(r'<tr class="(?:odd|even)[^"]*">', html)[1:]:
        pm = re.search(r'href="/[a-z0-9-]+/profil/spieler/(\d+)">\s*([^<]+?)\s*<', chunk)
        if not pm:
            continue
        birth = None
        bm = re.search(r'>(\d{2}/\d{2}/\d{4}) \(\d+\)</td>', chunk)
        if bm:
            birth = datetime.strptime(bm.group(1), "%d/%m/%Y").date()
        vm = re.search(r'marktwertverlauf/spieler/\d+">([^<]+)</a>', chunk)
        players.append({"tm_id": pm.group(1), "name": pm.group(2), "birth": birth,
                        "value": parse_market_value(vm.group(1)) if vm else None})
    return players


def collect_sofa_players():
    """Lineup JSON'larindan sofascore oyuncu kimlikleri (son gorulen kayit kazanir)."""
    players = {}
    for d in sorted((ROOT / "data" / "sofascore").glob("*/")):
        for f in d.glob("lineup_*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            for side in ("home", "away"):
                for p in (data.get(side) or {}).get("players") or []:
                    info = p.get("player") or {}
                    pid = info.get("id")
                    if not pid:
                        continue
                    dob = info.get("dateOfBirthTimestamp")
                    players[pid] = {
                        "name": info.get("name"),
                        "slug": info.get("slug"),
                        "birth": (EPOCH + timedelta(seconds=dob)).date() if dob is not None else None,
                        "height": info.get("height"),
                        "country": ((info.get("country") or {}).get("name")),
                        "position": info.get("position"),
                    }
    return players


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute("""
        create table if not exists football.sofascore_player_info (
          sofascore_player_id text primary key,
          player_name text,
          player_slug text,
          birth_date date,
          height_cm int,
          country text,
          position text,
          updated_at timestamptz default now()
        )""")
    cur.execute("""
        create table if not exists football.tff1_player_market_values (
          sofascore_player_id text primary key,
          tm_player_id text,
          tm_player_name text,
          market_value_eur bigint,
          tm_club text,
          fetched_at timestamptz default now()
        )""")
    conn.commit()

    sofa = collect_sofa_players()
    print(f"Sofa oyuncu kimligi: {len(sofa)}")
    psycopg2.extras.execute_values(
        cur,
        """insert into football.sofascore_player_info
             (sofascore_player_id, player_name, player_slug, birth_date, height_cm, country, position)
           values %s on conflict (sofascore_player_id) do update set
             player_name=excluded.player_name, player_slug=excluded.player_slug,
             birth_date=excluded.birth_date, height_cm=excluded.height_cm,
             country=excluded.country, position=excluded.position, updated_at=now()""",
        [(str(pid), p["name"], p["slug"], p["birth"], p["height"], p["country"], p["position"])
         for pid, p in sofa.items()],
    )
    conn.commit()
    print("[sofascore_player_info] upsert tamam")

    by_birth = {}
    by_tokens = {}
    for pid, p in sofa.items():
        if p["birth"]:
            by_birth.setdefault(p["birth"], []).append(pid)
        toks = tuple(sorted(norm(p["name"]).split()))
        if toks:
            by_tokens.setdefault(toks, []).append(pid)

    total_m = total_u = 0
    for comp in ("1-lig/startseite/wettbewerb/TR2", "super-lig/startseite/wettbewerb/TR1"):
        league_html = fetch(f"{BASE}/{comp}")
        clubs = {}
        for tm_slug, tm_id, _s in re.findall(
                r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html):
            clubs.setdefault(tm_id, tm_slug)
        print(f"{comp.split('/')[0]}: {len(clubs)} kulup")
        for tm_id, tm_slug in clubs.items():
            try:
                squad = parse_squad(fetch(f"{BASE}/{tm_slug}/kader/verein/{tm_id}/saison_id/2026/plus/1"))
            except Exception as e:  # noqa
                print(f"UYARI: {tm_slug} kadro cekilemedi: {e}")
                continue
            matched = 0
            for p in squad:
                if p["value"] is None:
                    continue
                target = None
                tm_toks = set(norm(p["name"]).split())
                if p["birth"] and p["birth"] in by_birth:
                    cands = by_birth[p["birth"]]
                    if len(cands) == 1 and (tm_toks & set(norm(sofa[cands[0]]["name"]).split())):
                        target = cands[0]
                    else:
                        for c in cands:
                            if tm_toks & set(norm(sofa[c]["name"]).split()):
                                target = c
                                break
                if target is None:
                    hit = by_tokens.get(tuple(sorted(tm_toks)))
                    if hit and len(hit) == 1:
                        target = hit[0]
                if target is None:
                    total_u += 1
                    continue
                cur.execute(
                    """insert into football.tff1_player_market_values
                         (sofascore_player_id, tm_player_id, tm_player_name, market_value_eur, tm_club, fetched_at)
                       values (%s,%s,%s,%s,%s,now())
                       on conflict (sofascore_player_id) do update set
                         tm_player_id=excluded.tm_player_id, tm_player_name=excluded.tm_player_name,
                         market_value_eur=excluded.market_value_eur, tm_club=excluded.tm_club, fetched_at=now()""",
                    (str(target), p["tm_id"], p["name"], p["value"], tm_slug),
                )
                matched += 1
            conn.commit()
            total_m += matched
            print(f"  {tm_slug}: TM {len(squad)}, eslenen {matched}", flush=True)
    print(f"TOPLAM eslenen {total_m}, eslenemeyen (degerli) {total_u}")


if __name__ == "__main__":
    main()
