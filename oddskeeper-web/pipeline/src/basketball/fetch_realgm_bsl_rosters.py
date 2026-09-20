"""RealGM BSL kadro görüntüsü → basketball.realgm_roster_snapshot (kadro denetiminin referansı).

RealGM transferi en iyi bilen kaynak (futbolda Transfermarkt'ın yeri) AMA Cloudflare bot
korumasının arkasında: VPS IP'sine hep, ev IP'sine de birkaç istekten sonra doğrulama sayfası
gösterir (2026-09-20 ölçümü). Bu yüzden OTOMATİKLEŞTİRİLEMEZ ve koruma aşılmaz. GÜVENİLİR YOL:
görüntü gerçek tarayıcı oturumunda (sayfa içi fetch) alınır, JSON olarak kaydedilir ve
`--from-json` ile tabloya yazılır. Doğrudan HTTP yolu yalnız "şansa" çalışır; engellenirse
görüntüye dokunmadan çıkar. Denetim (build_bsl_squad_audit.py) VPS'te SON görüntüden kurulur;
görüntü tarihi sayfada görünür. Sezon başladıktan sonra üyeliğin asıl doğrulayıcısı maç verisidir.

Takım sayfaları basketball.teams.realgm_team_id'den kurulur (yeni takımda id'yi oraya yaz).
Doğum tarihi yalnız DB'de realgm id'si OLMAYAN (yeni) oyuncular için oyuncu sayfasından alınır.
Bir takım sayfası çekilemezse o takımın ESKİ görüntüsü korunur (yarım çekim kadroyu silmesin).

    python src/basketball/fetch_realgm_bsl_rosters.py [--season-label 2026-2027] [--from-json PATH] [--dry-run]
    # ardından: python src/basketball/build_bsl_squad_audit.py
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

import psycopg2
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from identity import current_season_label

BASE = "https://basketball.realgm.com"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
}
MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def http_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_roster(html):
    """Kadro tablosu (başlığında Nationality olan) → [{id, name, position}]."""
    soup = BeautifulSoup(html, "lxml")
    for table in soup.find_all("table"):
        head = table.find("thead")
        if not head or "Nationality" not in head.get_text():
            continue
        out = []
        for tr in table.find("tbody").find_all("tr"):
            a = tr.find("a", href=re.compile(r"^/player/"))
            if not a:
                continue
            tds = tr.find_all("td")
            pos = tds[2].get_text(strip=True) if len(tds) > 2 else None
            out.append({"id": int(a["href"].rstrip("/").split("/")[-1]), "name": a.get_text(strip=True),
                        "position": pos if pos and pos != "-" else None, "href": a["href"]})
        return out
    return []


def parse_birth_date(html):
    m = re.search(r"Born:\s*(?:</strong>)?\s*([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", BeautifulSoup(html, "lxml").get_text(" "))
    return f"{m.group(3)}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}" if m and m.group(1) in MONTHS else None


def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    season = args.season_label or current_season_label()
    end_year = int(season.split("-")[1])
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""select t.team_slug, t.realgm_team_id from basketball.teams t
                   join basketball.season_participants sp on sp.team_slug = t.team_slug and sp.season_label = %s
                   where t.realgm_team_id is not null order by 1""", (season,))
    teams = cur.fetchall()
    cur.execute("select realgm_player_id, birth_date::text from basketball.players where realgm_player_id is not null")
    known_dob = dict(cur.fetchall())

    rosters = {}
    if args.from_json:            # tarayıcıdan alınmış görüntü (sync_bsl_rosters girdisi) → tabloya
        with open(args.from_json, encoding="utf-8") as f:
            d = json.load(f)
        slug_of = {t["id"]: t["slug"] for t in d["teams"]}
        for p in d["players"]:
            rosters.setdefault(slug_of[p["team_id"]], []).append(
                {"id": p["id"], "name": p["name"], "position": p.get("pos"), "dob": p.get("dob")})
    else:
        for slug, rid in teams:
            url = f"{BASE}/international/league/7/Turkish-BSL/team/{rid}/x/rosters/{end_year}"
            try:
                rows = parse_roster(http_get(url))
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                print(f"[realgm] HATA: {slug} cekilemedi ({e!r}); eski goruntu korunuyor", flush=True)
                continue
            for p in rows:
                p["dob"] = known_dob.get(p["id"])
                if p["id"] not in known_dob:           # yeni oyuncu: doğum tarihi kimlik için gerekli
                    try:
                        p["dob"] = parse_birth_date(http_get(BASE + p["href"]))
                    except (urllib.error.URLError, TimeoutError, OSError):
                        p["dob"] = None
                    time.sleep(0.7)
            rosters[slug] = rows
            print(f"[realgm] {slug}: {len(rows)} oyuncu", flush=True)
            time.sleep(0.8)

    if not rosters:
        print("[realgm] hicbir takim alinamadi (sunucu IP'sinden Cloudflare engeli beklenir); goruntu degismedi", flush=True)
        conn.close()
        return
    if args.dry_run:
        print(f"[realgm] DRY-RUN: {len(rosters)} takim, {sum(len(v) for v in rosters.values())} oyuncu")
        conn.close()
        return
    for slug, rows in rosters.items():
        cur.execute("delete from basketball.realgm_roster_snapshot where season_label=%s and team_slug=%s", (season, slug))
        for p in rows:
            cur.execute("""insert into basketball.realgm_roster_snapshot
                               (season_label, team_slug, realgm_player_id, player_name, birth_date, position, fetched_at)
                           values (%s,%s,%s,%s,%s::date,%s, coalesce(%s::timestamptz, now()))
                           on conflict (season_label, team_slug, realgm_player_id) do nothing""",
                        (season, slug, p["id"], p["name"], p.get("dob"), p.get("position"), args.fetched_at))
    conn.commit()
    conn.close()
    print(f"[realgm] goruntu yazildi: {len(rosters)} takim, {sum(len(v) for v in rosters.values())} oyuncu")


def main():
    ap = argparse.ArgumentParser(description="RealGM BSL kadro goruntusu (ev IP'sinden)")
    ap.add_argument("--season-label")
    ap.add_argument("--from-json", help="rosters_<sezon>_realgm.json (tarayicidan alinmis goruntu)")
    ap.add_argument("--fetched-at", help="--from-json icin goruntunun gercek tarihi (ISO)")
    ap.add_argument("--dry-run", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
