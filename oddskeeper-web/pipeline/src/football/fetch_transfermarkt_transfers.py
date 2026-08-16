# -*- coding: utf-8 -*-
"""Transfermarkt'tan Süper Lig kulüplerinin transferlerini (gelen + giden) çeker.

Akış:
  1. TR1 lig sayfasından 18 kulübün Transfermarkt id'leri alınır.
  2. Kulüpler ref.team_mapping display_name'leriyle isim benzerliğinden
     team_slug + display_name'e eşlenir (fetch_transfermarkt_values ile aynı).
  3. Her kulübün transfers sayfasından (saison_id) "Arrivals" ve "Departures"
     blokları ayrıştırılır: oyuncu adı + fotoğraf (TM CDN), yaş, uyruk, pozisyon,
     karşı kulüp (ad + logo) ve bonservis.
  4. Oyuncular analytics.player_current_info_v1 ile isimden eşlenip player_slug
     doldurulur (profil linki için). Eşleşmezse foto yine TM'den gelir.
  5. football.tsl_transfers seçili sezon için silinip yeniden yazılır.

Elle çalıştırılır:
    .venv\\Scripts\\python.exe src\\football\\fetch_transfermarkt_transfers.py [2025|2026]

saison_id 2025 -> "2025/2026", 2026 -> "2026/2027". Argümansız her ikisi de.
İstekler arası 3 sn beklenir (kulüp başına 1 istek).
"""

import os
import re
import sys
import time
import unicodedata

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

# saison_id -> season_label
SEASON_LABELS = {"2025": "2025/2026", "2026": "2026/2027"}


def norm(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("ı", "i").replace("ø", "o").replace("ß", "ss")
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def _name_match(tm_name, our_name):
    """Kisaltmali/eksik-onad ad uyumu (fetch_transfermarkt_values ile ayni)."""
    a, b = norm(tm_name).split(), norm(our_name).split()
    if not a or not b:
        return False
    if a[-1] != b[-1]:
        if not (len(a) >= 2 and len(b) >= 2 and a[-2:] == b[-2:]):
            return False
    fa, fb = a[0], b[0]
    if fa == fb or fa.startswith(fb) or fb.startswith(fa):
        return True
    given_a, given_b = set(a[:-1]), set(b[:-1])
    return bool(given_a and given_b and (given_a & given_b))


def fetch(url):
    last = None
    for attempt in range(4):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=45)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY_SECONDS)
            return resp.text
        except requests.RequestException as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise last


def _eur(text):
    m = re.search(r"€([\d.]+)(m|k|bn)", text or "")
    if not m:
        return None
    mult = {"k": 1_000, "m": 1_000_000, "bn": 1_000_000_000}[m.group(2)]
    return int(float(m.group(1)) * mult)


def parse_fee_cell(cell_html):
    """Son 'rechts' hucresinden (fee_text, fee_eur, is_loan_return) uretir.
    is_loan_return True ise satir atlanir (kiralık dönüşü, gerçek transfer değil)."""
    if not cell_html:
        return None, None, False
    if "End of loan" in cell_html:
        return "End of loan", None, True
    loan_fee = re.search(r"Loan fee:.*?<i[^>]*>([^<]+)</i>", cell_html, re.S)
    if loan_fee:
        val = loan_fee.group(1).strip()
        return f"loan (€{val.lstrip('€')})", _eur(val), False
    text = re.sub(r"<[^>]+>", " ", cell_html)
    text = re.sub(r"\s+", " ", text).strip()
    return (text or None), _eur(text), False


def wappen_url(club_id):
    return f"https://img.a.transfermarkt.technology/wappen/medium/{club_id}.png"


def _responsive_tables(html):
    """Sayfadaki responsive-table bloklarini sirasiyla dondurur."""
    starts = [m.start() for m in re.finditer(r'<div class="responsive-table">', html)]
    blocks = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else len(html)
        blocks.append(html[s:e])
    return blocks


def parse_transfer_rows(block):
    """Bir arrivals/departures blogundaki oyuncu satirlarini ayristirir."""
    tb = block.find("<tbody>")
    body = block[tb:] if tb >= 0 else block
    chunks = re.split(r'<tr class="odd">|<tr class="even">', body)[1:]
    out = []
    for chunk in chunks:
        pm = re.search(r'/profil/spieler/(\d+)"[^>]*>\s*([^<]+?)\s*<', chunk)
        if not pm:
            continue
        tm_id, name = pm.group(1), pm.group(2).strip()
        photo_m = re.search(r'data-src="([^"]+)"[^>]*class="bilderrahmen-fixed', chunk)
        if not photo_m:
            photo_m = re.search(r'class="bilderrahmen-fixed[^"]*"[^>]*data-src="([^"]+)"', chunk)
        photo = photo_m.group(1) if photo_m else None
        pos_m = re.search(r'/profil/spieler/\d+".*?</a>.*?<td>([^<]+)</td>', chunk, re.S)
        position = pos_m.group(1).strip() if pos_m else None
        age_m = re.search(r'<td class="zentriert">(\d+)</td>', chunk)
        age = int(age_m.group(1)) if age_m else None
        nat_m = re.search(
            r'<td class="zentriert"><img[^>]+title="([^"]+)"[^>]*class="flaggenrahmen"',
            chunk,
        )
        nationality = nat_m.group(1).strip() if nat_m else None
        # Karsi kulup: verein linkli inline-table (wappen + kisa ad).
        club_m = re.search(
            r'href="/[a-z0-9-]+/(?:startseite|kader|spielplan)/verein/(\d+)"[^>]*>\s*<img[^>]+title="([^"]+)"[^>]*class="tiny_wappen"',
            chunk,
        )
        club_id = club_m.group(1) if club_m else None
        club_name = club_m.group(2).strip() if club_m else None
        if not club_name:
            # "Without Club" / "Retired" gibi metin durumlari
            txt = re.search(r'<td>\s*(Without Club|Retired|Career break|Unknown)\s*</td>', chunk)
            club_name = txt.group(1) if txt else None
        fee_cells = re.findall(r'<td class="rechts[^"]*"[^>]*>(.*?)</td>', chunk, re.S)
        fee_text, fee_eur, loan_return = parse_fee_cell(fee_cells[-1] if fee_cells else None)
        if loan_return:
            continue  # kiralık dönüşü/bitişi: gerçek transfer değil, atla
        out.append({
            "tm_id": tm_id,
            "name": name,
            "photo": photo,
            "position": position,
            "age": age,
            "nationality": nationality,
            "club_id": club_id,
            "club_name": club_name,
            "club_logo": wappen_url(club_id) if club_id else None,
            "fee_text": fee_text,
            "fee_eur": fee_eur,
        })
    return out


def build_name_index(cur):
    """Tum oyuncularin ad -> (slug, foto) haritasi (isim eslesmesi icin)."""
    cur.execute(
        """
        select player_slug, player_name, coalesce(full_name,''), photo_url
        from analytics.player_current_info_v1
        """
    )
    rows = cur.fetchall()
    return rows  # (slug, player_name, full_name, photo)


def match_player(name, index):
    for slug, pname, fname, photo in index:
        for cand in (fname, pname):
            if cand and _name_match(name, cand):
                return slug, photo
    return None, None


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    seasons = [a for a in sys.argv[1:] if a in SEASON_LABELS] or list(SEASON_LABELS.keys())

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    league_html = fetch(LEAGUE_URL)
    club_links = re.findall(
        r'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/(\d+)"', league_html
    )
    clubs = {}
    for tm_slug, tm_id, _ in club_links:
        clubs.setdefault(tm_id, tm_slug)
    print(f"Transfermarkt kulüp sayısı: {len(clubs)}")

    cur.execute(
        """
        select distinct tm.team_slug, tm.display_name
        from ref.team_mapping tm
        join football.team_squad_current s on s.source_team_id = tm.source_team_id
        where tm.is_active
        """
    )
    our_teams = cur.fetchall()
    STOPWORDS = {
        "fk", "sk", "as", "jk", "spor", "kulubu", "istanbul", "ankara",
        "buyuksehir", "belediye", "belediyesi", "genclik",
    }

    def match_team(tm_slug):
        tm_tokens = set(norm(tm_slug.replace("-", " ")).split()) - STOPWORDS
        best, best_name, best_score = None, None, 0
        for team_slug, display_name in our_teams:
            tokens = (set(norm(display_name).split()) | set(norm(team_slug).split("-"))) - STOPWORDS
            score = len(tm_tokens & tokens)
            if score > best_score:
                best, best_name, best_score = team_slug, display_name, score
        return (best, best_name) if best_score > 0 else (None, None)

    club_meta = {}  # tm_id -> (team_slug, display_name)
    for tm_id, tm_slug in clubs.items():
        slug, dname = match_team(tm_slug)
        if slug:
            club_meta[tm_id] = (slug, dname)
        else:
            print(f"UYARI: kulüp eşlenemedi: {tm_slug} ({tm_id})")
    print(f"Eşlenen kulüp: {len(club_meta)}")

    name_index = build_name_index(cur)
    print(f"Oyuncu ad indeksi: {len(name_index)}")

    for saison in seasons:
        season_label = SEASON_LABELS[saison]
        records = []  # dict rows to insert
        for tm_id, (team_slug, dname) in club_meta.items():
            tm_slug = clubs[tm_id]
            url = f"{BASE}/{tm_slug}/transfers/verein/{tm_id}/saison_id/{saison}"
            html = fetch(url)
            tables = _responsive_tables(html)
            if len(tables) < 2:
                print(f"  {team_slug}: transfer tablosu bulunamadı ({len(tables)})")
                continue
            arrivals = parse_transfer_rows(tables[0])
            departures = parse_transfer_rows(tables[1])
            club_logo = wappen_url(tm_id)
            for p in arrivals:
                slug, our_photo = match_player(p["name"], name_index)
                records.append({
                    "season_label": season_label, "player_name": p["name"],
                    "player_slug": slug, "player_photo_url": p["photo"] or our_photo,
                    "position_code": p["position"], "age": p["age"], "nationality": p["nationality"],
                    "from_team_name": p["club_name"], "from_team_logo": p["club_logo"],
                    "to_team_name": dname, "to_team_logo": club_logo,
                    "fee_text": p["fee_text"], "fee_eur": p["fee_eur"], "is_tsl_arrival": True,
                })
            for p in departures:
                slug, our_photo = match_player(p["name"], name_index)
                records.append({
                    "season_label": season_label, "player_name": p["name"],
                    "player_slug": slug, "player_photo_url": p["photo"] or our_photo,
                    "position_code": p["position"], "age": p["age"], "nationality": p["nationality"],
                    "from_team_name": dname, "from_team_logo": club_logo,
                    "to_team_name": p["club_name"], "to_team_logo": p["club_logo"],
                    "fee_text": p["fee_text"], "fee_eur": p["fee_eur"], "is_tsl_arrival": False,
                })
            print(f"  {team_slug}: gelen {len(arrivals)}, giden {len(departures)}")

        arr = sum(1 for r in records if r["is_tsl_arrival"])
        dep = len(records) - arr
        print(f"[{season_label}] toplam: gelen {arr}, giden {dep}")

        # Güvenlik: parse bozulmuşsa (neredeyse boş) yazma. 18 kulüplük ligde
        # 40'tan az gelen = ayrıştırma kırık demektir.
        if arr < 40:
            print(f"  ATLANDI: gelen sayısı çok düşük ({arr}); ayrıştırma kırık olabilir. Yazılmadı.")
            continue

        cur.execute("delete from football.tsl_transfers where season_label=%s", (season_label,))
        # Aynı (player, from, to) tekrarı olursa son kaydı tut.
        seen = set()
        inserted = 0
        for r in records:
            key = (r["season_label"], r["player_name"], r["from_team_name"], r["to_team_name"])
            if key in seen:
                continue
            seen.add(key)
            cur.execute(
                """
                insert into football.tsl_transfers
                  (season_label, player_name, player_slug, player_photo_url, position_code,
                   age, nationality, from_team_name, from_team_logo, to_team_name, to_team_logo,
                   fee_text, fee_eur, is_tsl_arrival, source)
                values (%(season_label)s,%(player_name)s,%(player_slug)s,%(player_photo_url)s,
                   %(position_code)s,%(age)s,%(nationality)s,%(from_team_name)s,%(from_team_logo)s,
                   %(to_team_name)s,%(to_team_logo)s,%(fee_text)s,%(fee_eur)s,%(is_tsl_arrival)s,
                   'transfermarkt')
                """,
                r,
            )
            inserted += 1
        conn.commit()
        print(f"  YAZILDI: {inserted} satır (foto: {sum(1 for r in records if r['player_photo_url'])}).")

    cur.close()
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
