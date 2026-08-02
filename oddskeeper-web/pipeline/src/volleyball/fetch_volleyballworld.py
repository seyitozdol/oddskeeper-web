"""Volleyball World (FIVB) istatistik cekimi -> volleyball.* semasi.

Kaynak en.volleyballworld.com server-render HTML (tablolar ham HTML'de) -> saf
requests + BeautifulSoup yeter, tarayici GEREKMEZ. Kimlik kalici FIVB oyuncu id'si
(/players/{id}) uzerinden -> fuzzy-match yok, idempotent upsert (competition, fivb_id).

Her turnuva icin:
  1) 7 kategori istatistik tablosu (best-scorers/attackers/blockers/servers/setters/
     diggers/receivers) -> TUM oyuncular icin volleyball.player_competition_stats
  2) takim listesi + kadro -> teams, roster, players
  3) oyuncu profili (bio + mac-mac 7 kategori) -> players(bio), player_match_stats
     Varsayilan: SADECE Turkiye (TUR) kadrosu icin profil; --all-profiles hepsi.

Kullanim:
  python fetch_volleyballworld.py --competition vnl-2024-w --dry-run
  python fetch_volleyballworld.py --competition vnl-2024-w
  python fetch_volleyballworld.py --all                      # 4 FIVB turnuvasi
  python fetch_volleyballworld.py --all --all-profiles       # her takim + her oyuncu profili
"""
import argparse
import json
import os
import re
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# --- Turnuva konfigurasyonu (bu tur: 4 FIVB kadin turnuvasi) ---------------
ROOT = "https://en.volleyballworld.com/volleyball/competitions"
COMPS = {
    "vnl-2024-w": dict(slug="volleyball-nations-league", year=2024, gender="W",
                       name="VNL 2024", base=f"{ROOT}/volleyball-nations-league/2024", gseg="women/"),
    "vnl-2025-w": dict(slug="volleyball-nations-league", year=2025, gender="W",
                       name="VNL 2025", base=f"{ROOT}/volleyball-nations-league/2025", gseg="women/"),
    "vnl-2026-w": dict(slug="volleyball-nations-league", year=2026, gender="W",
                       name="VNL 2026", base=f"{ROOT}/volleyball-nations-league", gseg="women/"),
    "wch-2025-w": dict(slug="women-world-championship", year=2025, gender="W",
                       name="Women World Championship 2025", base=f"{ROOT}/women-world-championship", gseg=""),
    "og-2024-w":  dict(slug="volleyball-olympic-games-paris-2024", year=2024, gender="W",
                       name="Olympic Games Paris 2024", base=f"{ROOT}/volleyball-olympic-games-paris-2024", gseg="women/"),
}

CATEGORIES = ["best-scorers", "best-attackers", "best-blockers", "best-servers",
              "best-setters", "best-diggers", "best-receivers"]

# player_competition_stats kolon eslemesi: kategori -> tablodaki metrik kolonlarinin db adlari
# (rank/name/team ilk 3 kolon; kalanlar sirayla asagidaki adlara)
STAT_COLS = {
    "best-scorers":   ["points", "attack_points", "block_points", "serve_points"],
    "best-attackers": ["atk_points", "atk_errors", "atk_attempts", "atk_avg", "atk_success", "atk_total"],
    "best-blockers":  ["blk_blocks", "blk_errors", "blk_rebounds", "blk_avg", "blk_eff", "blk_total"],
    "best-servers":   ["srv_points", "srv_errors", "srv_attempts", "srv_avg", "srv_success", "srv_total"],
    "best-setters":   ["set_successful", "set_errors", "set_attempts", "set_avg", "set_success", "set_total"],
    "best-diggers":   ["dig_digs", "dig_errors", "dig_receptions", "dig_avg", "dig_success", "dig_total"],
    "best-receivers": ["rec_successful", "rec_errors", "rec_attempts", "rec_avg", "rec_success", "rec_total"],
}
RANK_COL = {
    "best-scorers": "scorer_rank", "best-attackers": "atk_rank", "best-blockers": "blk_rank",
    "best-servers": "srv_rank", "best-setters": "set_rank", "best-diggers": "dig_rank",
    "best-receivers": "rec_rank",
}
INT_COLS = {"points", "attack_points", "block_points", "serve_points",
            "atk_points", "atk_errors", "atk_attempts", "atk_total",
            "blk_blocks", "blk_errors", "blk_rebounds", "blk_total",
            "srv_points", "srv_errors", "srv_attempts", "srv_total",
            "set_successful", "set_errors", "set_attempts", "set_total",
            "dig_digs", "dig_errors", "dig_receptions", "dig_total",
            "rec_successful", "rec_errors", "rec_attempts", "rec_total"}

# profil sayfasindaki 7 mac-mac tablosu (DOM sirasi) -> (kategori adi, metrik kolon adlari)
PROFILE_TABLES = [
    ("scoring",   ["points", "attack_points", "block_points", "serve_points"]),
    ("attack",    ["points", "errors", "attempts", "avg", "success", "total"]),
    ("block",     ["blocks", "errors", "rebounds", "avg", "efficiency", "total"]),
    ("serve",     ["points", "errors", "attempts", "avg", "success", "total"]),
    ("reception", ["successful", "errors", "attempts", "avg", "success", "total"]),
    ("dig",       ["digs", "errors", "receptions", "avg", "success", "total"]),
    ("set",       ["successful", "errors", "attempts", "avg", "success", "total"]),
]

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "text/html"})


def get_html(url: str, tries: int = 3) -> str | None:
    for k in range(tries):
        try:
            r = SESSION.get(url, timeout=30)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            r.encoding = "utf-8"
            return r.text
        except Exception as e:
            if k == tries - 1:
                print(f"  ! GET fail {url}: {e}")
                return None
            time.sleep(1.5 * (k + 1))
    return None


def num(s):
    """'12' -> 12, '38.77' -> 38.77, '-4.09' -> -4.09, '' -> None"""
    if s is None:
        return None
    s = str(s).replace("\xa0", "").strip().replace("%", "")
    if s in ("", "-", "--", "nan"):
        return None
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


def to_date(s):
    s = (s or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def cell_text(td):
    return td.get_text(" ", strip=True)


def parse_stat_table(html: str, category: str):
    """Bir kategori sayfasindan satirlari cikar: [{fivb_id, short_name, team_code, <metrik...>, rank}]"""
    soup = BeautifulSoup(html, "lxml")
    tbl = soup.find("table")
    if not tbl:
        return []
    rows = tbl.find_all("tr")
    out = []
    cols = STAT_COLS[category]
    for tr in rows[1:]:
        tds = tr.find_all(["td", "th"])
        if len(tds) < 3 + len(cols):
            continue
        a = tr.find("a", href=True)
        pid = None
        if a and "/players/" in a["href"]:
            m = re.search(r"/players/(\d+)", a["href"])
            pid = int(m.group(1)) if m else None
        if pid is None:
            continue
        rank = num(cell_text(tds[0]))
        short_name = cell_text(tds[1])
        team_code = cell_text(tds[2])
        rec = {"fivb_id": pid, "short_name": short_name, "team_code": team_code,
               RANK_COL[category]: int(rank) if rank is not None else None}
        for i, colname in enumerate(cols):
            v = num(cell_text(tds[3 + i]))
            if colname in INT_COLS and v is not None:
                v = int(v)
            rec[colname] = v
        out.append(rec)
    return out


def parse_teams(html: str):
    """teams sayfasi -> [{team_code, team_name, edition_team_id}]"""
    soup = BeautifulSoup(html, "lxml")
    seen = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"/teams/(?:(?:women|men)/)?(\d+)/", a["href"])
        if not m:
            continue
        tid = int(m.group(1))
        txt = a.get_text(" ", strip=True)
        cm = re.search(r"([A-Z]{3})$", txt.replace(" ", ""))
        if not cm:
            continue
        code = cm.group(1)
        name = txt[: -len(code)].strip() or code
        seen[tid] = (code, name)
    return [{"edition_team_id": tid, "team_code": c, "team_name": n} for tid, (c, n) in seen.items()]


def parse_roster(html: str):
    """team players sayfasi -> [{fivb_id, shirt_number, position}]"""
    soup = BeautifulSoup(html, "lxml")
    by_pid = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"/players/(\d+)", a["href"])
        if not m:
            continue
        pid = int(m.group(1))
        txt = a.get_text(" ", strip=True)
        by_pid.setdefault(pid, [])
        if txt:
            by_pid[pid].append(txt)
    out = []
    for pid, parts in by_pid.items():
        number, position = None, None
        for p in parts:
            if p.isdigit():
                number = int(p)
            elif re.fullmatch(r"[A-Za-z. ]{1,20}", p) and len(p) <= 4 and p.upper() == p:
                position = p  # kisa pozisyon kodu (L/OH/MB/S/OP)
        out.append({"fivb_id": pid, "shirt_number": number, "position": position})
    return out


def parse_profile(html: str):
    """profil sayfasi -> (bio dict, [match rows]) ; match row = {date, home, away, category, data}"""
    soup = BeautifulSoup(html, "lxml")
    bio = {}
    # Dogal sirali ad (Ad Soyad): h1.vbw-player-name; title'daki "Soyad Ad" sirasi degil.
    name_el = soup.select_one("h1.vbw-player-name") or soup.select_one(".vbw-player-name")
    natural = name_el.get_text(" ", strip=True) if name_el else None
    title = soup.title.get_text(strip=True) if soup.title else ""
    bio["full_name"] = natural or (title.split(" - ")[0].strip() if title else None)
    txt = soup.get_text("\n")
    def grab(label):
        m = re.search(re.escape(label) + r"\s*\n\s*([^\n]+)", txt, re.I)
        return m.group(1).strip() if m else None
    bio["position"] = grab("Position")
    bio["nationality"] = grab("Nationality")
    h = grab("Height")
    bio["height_cm"] = int(re.sub(r"[^0-9]", "", h)) if h and re.search(r"\d", h) else None
    bd = grab("Birth date")   # sitede etiket "Birth date" (kucuk d)
    bio["birth_date"] = to_date(bd) if bd else None

    matches = []
    tables = soup.find_all("table")
    for idx, (cat, colnames) in enumerate(PROFILE_TABLES):
        if idx >= len(tables):
            break
        for tr in tables[idx].find_all("tr")[1:]:
            tds = tr.find_all(["td", "th"])
            if len(tds) < 3 + len(colnames):
                continue
            home = cell_text(tds[0]); away = cell_text(tds[1]); d = to_date(cell_text(tds[2]))
            if d is None:
                continue
            data = {}
            for j, cn in enumerate(colnames):
                data[cn] = num(cell_text(tds[3 + j]))
            matches.append({"date": d, "home": home, "away": away, "category": cat, "data": data})
    return bio, matches


# --------------------------- DB katmani --------------------------------------
def connect():
    load_dotenv()
    u = os.environ["DATABASE_URL"].strip().strip('"')
    c = psycopg2.connect(u)
    c.autocommit = False
    return c


def upsert_competition(cur, cfg):
    cur.execute(
        """insert into volleyball.competitions (comp_slug, year, gender, name)
           values (%s,%s,%s,%s)
           on conflict (comp_slug, year, gender) do update set name=excluded.name
           returning id""",
        (cfg["slug"], cfg["year"], cfg["gender"], cfg["name"]),
    )
    return cur.fetchone()[0]


def upsert_player(cur, pid, short_name=None, team_code=None, bio=None):
    cols = {"fivb_id": pid}
    if short_name:
        cols["short_name"] = short_name
    if team_code:
        cols["nationality"] = cols.get("nationality") or None
    if bio:
        for k in ("full_name", "position", "birth_date", "height_cm", "nationality"):
            if bio.get(k) is not None:
                cols[k] = bio[k]
    keys = list(cols.keys())
    vals = [cols[k] for k in keys]
    updates = ", ".join(f"{k}=coalesce(excluded.{k}, volleyball.players.{k})"
                        for k in keys if k != "fivb_id")
    updates = (updates + ", updated_at=now()") if updates else "updated_at=now()"
    cur.execute(
        f"insert into volleyball.players ({', '.join(keys)}) values ({', '.join(['%s']*len(keys))}) "
        f"on conflict (fivb_id) do update set {updates}",
        vals,
    )


def run_competition(cur, key, cfg, do_profiles=True, all_profiles=False, dry=False):
    print(f"\n=== {cfg['name']} ({key}) ===")
    comp_id = upsert_competition(cur, cfg)
    base, gseg = cfg["base"], cfg["gseg"]

    # 1) 7 kategori istatistik -> player_competition_stats (fivb_id bazinda birlestir)
    agg = {}   # fivb_id -> {col: val}
    for cat in CATEGORIES:
        url = f"{base}/statistics/{gseg}{cat}/"
        html = get_html(url)
        if not html:
            print(f"  - {cat}: (yok/404)")
            continue
        rows = parse_stat_table(html, cat)
        print(f"  - {cat}: {len(rows)} satir")
        for rec in rows:
            pid = rec["fivb_id"]
            d = agg.setdefault(pid, {"fivb_id": pid, "team_code": rec.get("team_code"),
                                     "short_name": rec.get("short_name")})
            for k, v in rec.items():
                if k in ("fivb_id", "short_name"):
                    continue
                if k == "team_code":
                    d["team_code"] = d.get("team_code") or v
                else:
                    d[k] = v
        time.sleep(0.4)

    # players + competition stats yaz
    stat_cols_all = ["points", "attack_points", "block_points", "serve_points", "scorer_rank",
                     "atk_points", "atk_errors", "atk_attempts", "atk_avg", "atk_success", "atk_total", "atk_rank",
                     "blk_blocks", "blk_errors", "blk_rebounds", "blk_avg", "blk_eff", "blk_total", "blk_rank",
                     "srv_points", "srv_errors", "srv_attempts", "srv_avg", "srv_success", "srv_total", "srv_rank",
                     "set_successful", "set_errors", "set_attempts", "set_avg", "set_success", "set_total", "set_rank",
                     "dig_digs", "dig_errors", "dig_receptions", "dig_avg", "dig_success", "dig_total", "dig_rank",
                     "rec_successful", "rec_errors", "rec_attempts", "rec_avg", "rec_success", "rec_total", "rec_rank"]
    for pid, d in agg.items():
        upsert_player(cur, pid, short_name=d.get("short_name"), team_code=d.get("team_code"))
        cols = ["competition_id", "fivb_id", "team_code"] + stat_cols_all
        vals = [comp_id, pid, d.get("team_code")] + [d.get(c) for c in stat_cols_all]
        setexpr = ", ".join(f"{c}=excluded.{c}" for c in ["team_code"] + stat_cols_all) + ", updated_at=now()"
        cur.execute(
            f"insert into volleyball.player_competition_stats ({', '.join(cols)}) "
            f"values ({', '.join(['%s']*len(cols))}) "
            f"on conflict (competition_id, fivb_id) do update set {setexpr}",
            vals,
        )
    print(f"  -> {len(agg)} oyuncu competition-stats yazildi")

    # 2) takimlar + kadrolar
    teams_url = f"{base}/teams/{gseg}"
    thtml = get_html(teams_url)
    teams = parse_teams(thtml) if thtml else []
    print(f"  - {len(teams)} takim")
    tur_pids = []
    for t in teams:
        cur.execute(
            """insert into volleyball.teams (competition_id, team_code, team_name, edition_team_id)
               values (%s,%s,%s,%s)
               on conflict (competition_id, team_code) do update
                 set team_name=excluded.team_name, edition_team_id=excluded.edition_team_id""",
            (comp_id, t["team_code"], t["team_name"], t["edition_team_id"]),
        )
        rurl = f"{base}/teams/{gseg}{t['edition_team_id']}/players/"
        rhtml = get_html(rurl)
        roster = parse_roster(rhtml) if rhtml else []
        for pl in roster:
            upsert_player(cur, pl["fivb_id"])
            cur.execute(
                """insert into volleyball.roster (competition_id, team_code, fivb_id, shirt_number, position)
                   values (%s,%s,%s,%s,%s)
                   on conflict (competition_id, fivb_id) do update
                     set team_code=excluded.team_code, shirt_number=excluded.shirt_number,
                         position=coalesce(excluded.position, volleyball.roster.position)""",
                (comp_id, t["team_code"], pl["fivb_id"], pl["shirt_number"], pl["position"]),
            )
        if t["team_code"] == "TUR":
            tur_pids = [pl["fivb_id"] for pl in roster]
        time.sleep(0.3)

    # 3) oyuncu profilleri (bio + mac-mac). Varsayilan: sadece Turkiye
    if do_profiles:
        if all_profiles:
            cur.execute("select fivb_id from volleyball.roster where competition_id=%s", (comp_id,))
            profile_pids = [r[0] for r in cur.fetchall()]
        else:
            profile_pids = tur_pids or [p for p, d in agg.items() if d.get("team_code") == "TUR"]
        print(f"  - {len(profile_pids)} oyuncu profili cekiliyor...")
        pm_count = 0
        for pid in profile_pids:
            purl = f"{base}/players/{pid}"
            phtml = get_html(purl)
            if not phtml:
                continue
            bio, matches = parse_profile(phtml)
            upsert_player(cur, pid, bio=bio)
            for m in matches:
                cur.execute(
                    """insert into volleyball.player_match_stats
                         (competition_id, fivb_id, match_date, home_team, away_team, category, data)
                       values (%s,%s,%s,%s,%s,%s,%s)
                       on conflict (competition_id, fivb_id, match_date, category) do update
                         set home_team=excluded.home_team, away_team=excluded.away_team, data=excluded.data""",
                    (comp_id, pid, m["date"], m["home"], m["away"], m["category"],
                     json.dumps(m["data"])),
                )
                pm_count += 1
            time.sleep(0.35)
        print(f"  -> {pm_count} mac-kategori satiri yazildi")

    if dry:
        print("  (dry-run: rollback)")
        cur.connection.rollback()
    else:
        cur.connection.commit()
        print("  commit OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--competition", help="anahtar (vnl-2024-w ...)")
    ap.add_argument("--all", action="store_true", help="4 FIVB turnuvasinin hepsi")
    ap.add_argument("--all-profiles", action="store_true", help="sadece Turkiye degil, her oyuncu profili")
    ap.add_argument("--no-profiles", action="store_true", help="profil cekme, sadece siralama+kadro")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.all:
        keys = list(COMPS.keys())
    elif args.competition:
        keys = [args.competition]
    else:
        ap.error("--competition veya --all gerekli")

    conn = connect()
    cur = conn.cursor()
    for k in keys:
        cfg = COMPS.get(k)
        if not cfg:
            print(f"! bilinmeyen turnuva: {k}")
            continue
        run_competition(cur, k, cfg, do_profiles=not args.no_profiles,
                        all_profiles=args.all_profiles, dry=args.dry_run)
    cur.close(); conn.close()
    print("\nBITTI.")


if __name__ == "__main__":
    main()
