# -*- coding: utf-8 -*-
"""Transfermarkt'tan Süper Lig oyuncu piyasa değerlerini çeker.

Akış:
  1. TR1 lig sayfasından 18 kulübün Transfermarkt id'leri alınır.
  2. Kulüpler ref.team_mapping display_name'leriyle isim benzerliğinden
     team_slug'a eşlenir.
  3. Her kulübün kadro sayfasından (plus/1) oyuncu adı, doğum tarihi ve
     piyasa değeri ayrıştırılır.
  4. analytics.player_current_info_v1'deki oyuncularla önce doğum tarihi +
     soyad, sonra normalize tam isim üzerinden eşlenir.
  5. football.player_market_values tablosuna upsert edilir.

Elle çalıştırılır:  .venv\\Scripts\\python.exe src\\football\\fetch_transfermarkt_values.py
Nazik olmak için istekler arasında 3 sn beklenir (toplam ~19 istek).
"""

import os
import re
import sys
import time
import unicodedata
from datetime import datetime

import psycopg2
import requests
from dotenv import load_dotenv

BASE = "https://www.transfermarkt.com"
LEAGUE_URL = f"{BASE}/super-lig/startseite/wettbewerb/TR1"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}
REQUEST_DELAY_SECONDS = 3


def norm(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("ı", "i").replace("ø", "o").replace("ß", "ss")
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def fetch(url):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    time.sleep(REQUEST_DELAY_SECONDS)
    return resp.text


def parse_market_value(text):
    """'€75.00m' / '€200k' / '-' -> EUR tamsayı ya da None."""
    text = text.strip().replace("€", "")
    m = re.match(r"^([\d.]+)(m|k)$", text)
    if not m:
        return None
    value = float(m.group(1))
    return int(value * (1_000_000 if m.group(2) == "m" else 1_000))


def parse_squad(html):
    """Kadro sayfasından oyuncu satırlarını çıkarır."""
    players = []
    # Satırlar: profil linki -> isim; aynı satırda doğum tarihi ve değer.
    row_chunks = re.split(r'<tr class="(?:odd|even)">', html)[1:]
    for chunk in row_chunks:
        pm = re.search(r'href="/[a-z0-9-]+/profil/spieler/(\d+)">\s*([^<]+?)\s*</a>', chunk)
        if not pm:
            continue
        tm_id, name = pm.group(1), pm.group(2)
        bm = re.search(r'>(\d{2}/\d{2}/\d{4}) \(\d+\)</td>', chunk)
        birth = None
        if bm:
            birth = datetime.strptime(bm.group(1), "%d/%m/%Y").date()
        vm = re.search(r"marktwertverlauf/spieler/\d+\">([^<]+)</a>", chunk)
        value = parse_market_value(vm.group(1)) if vm else None
        players.append({"tm_id": tm_id, "name": name, "birth": birth, "value": value})
    return players


def main():
    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # 1) Lig sayfasından kulüpler
    league_html = fetch(LEAGUE_URL)
    club_links = re.findall(
        r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html
    )
    clubs = {}
    for tm_slug, tm_id, _season in club_links:
        clubs.setdefault(tm_id, tm_slug)
    print(f"Transfermarkt kulüp sayısı: {len(clubs)}")

    # 2) Kulüp -> team_slug eşleşmesi (aktif takımlar)
    cur.execute(
        """
        select distinct tm.team_slug, tm.display_name
        from ref.team_mapping tm
        join football.team_squad_current s on s.source_team_id = tm.source_team_id
        where tm.is_active
        """
    )
    our_teams = cur.fetchall()

    # Jenerik kelimeler eşleşmede sayılmaz; yoksa "istanbul-basaksehir-fk"
    # ile "Erzurumspor FK" ortak "fk" yüzünden eşleşebiliyor.
    STOPWORDS = {
        "fk", "sk", "as", "jk", "spor", "kulubu", "istanbul", "ankara",
        "buyuksehir", "belediye", "belediyesi", "genclik",
    }

    def match_team(tm_slug):
        tm_tokens = set(norm(tm_slug.replace("-", " ")).split()) - STOPWORDS
        best, best_score = None, 0
        for team_slug, display_name in our_teams:
            tokens = (
                set(norm(display_name).split()) | set(norm(team_slug).split("-"))
            ) - STOPWORDS
            score = len(tm_tokens & tokens)
            if score > best_score:
                best, best_score = team_slug, score
        return best if best_score > 0 else None

    club_to_slug = {}
    for tm_id, tm_slug in clubs.items():
        slug = match_team(tm_slug)
        if slug:
            club_to_slug[tm_id] = slug
        else:
            print(f"UYARI: kulüp eşlenemedi: {tm_slug} ({tm_id})")
    print(f"Eşlenen kulüp: {len(club_to_slug)}")

    # 3-4) Kadrolar + oyuncu eşleşmesi
    total_matched = total_unmatched = 0
    for tm_id, team_slug in club_to_slug.items():
        squad_url = f"{BASE}/{clubs[tm_id]}/kader/verein/{tm_id}/saison_id/2026/plus/1"
        players = parse_squad(fetch(squad_url))

        cur.execute(
            """
            select apifootball_player_id, player_slug, player_name,
                   coalesce(full_name, ''), coalesce(first_name, ''),
                   coalesce(last_name, ''), birth_date
            from analytics.player_current_info_v1
            where current_team_slug = %s
            """,
            (team_slug,),
        )
        ours = cur.fetchall()

        by_birth = {}
        for row in ours:
            if row[6]:
                by_birth.setdefault(row[6], []).append(row)

        matched = 0
        for p in players:
            if p["value"] is None:
                continue
            target = None

            # a) doğum tarihi + isim kesişimi
            if p["birth"] and p["birth"] in by_birth:
                candidates = by_birth[p["birth"]]
                if len(candidates) == 1:
                    target = candidates[0]
                else:
                    tm_tokens = set(norm(p["name"]).split())
                    for c in candidates:
                        our_tokens = set(norm(f"{c[4]} {c[5]} {c[3]} {c[2]}").split())
                        if tm_tokens & our_tokens:
                            target = c
                            break

            # b) normalize tam isim eşitliği / soyad+ad kesişimi
            if target is None:
                tm_tokens = set(norm(p["name"]).split())
                best, best_score = None, 0
                for c in ours:
                    our_tokens = set(norm(f"{c[4]} {c[5]} {c[3]} {c[2]}").split())
                    score = len(tm_tokens & our_tokens)
                    if score > best_score:
                        best, best_score = c, score
                if best is not None and best_score >= 2:
                    target = best

            if target is None:
                total_unmatched += 1
                continue

            cur.execute(
                """
                insert into football.player_market_values
                  (apifootball_player_id, player_slug, tm_player_id,
                   tm_player_name, market_value_eur, team_slug, fetched_at)
                values (%s, %s, %s, %s, %s, %s, now())
                on conflict (apifootball_player_id) do update set
                  player_slug = excluded.player_slug,
                  tm_player_id = excluded.tm_player_id,
                  tm_player_name = excluded.tm_player_name,
                  market_value_eur = excluded.market_value_eur,
                  team_slug = excluded.team_slug,
                  fetched_at = now()
                """,
                (target[0], target[1], p["tm_id"], p["name"], p["value"], team_slug),
            )
            matched += 1

        conn.commit()
        total_matched += matched
        print(f"{team_slug}: TM {len(players)} oyuncu, eşlenen {matched}")

    print(f"TOPLAM: eşlenen {total_matched}, eşlenemeyen (değerli) {total_unmatched}")


if __name__ == "__main__":
    sys.exit(main())
