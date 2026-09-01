"""CEV EuroVolley 2026 (Kadinlar) -> volleyball.* semasi.

Kaynak legacy www-old.cev.eu (ASP.NET, server-render HTML) -> saf requests +
BeautifulSoup yeter, tarayici/proxy GEREKMEZ. Yeni site (eurovolley.cev.eu) kabuk;
veri legacy sayfalarda. FIVB adaptorunun (fetch_volleyballworld.py) CEV paraleli.

Veri yuzeyleri (ID=1573 = EuroVolley 2026 Women, PID=2992 = Final Phase):
  MatchPage.aspx?ID=1573&mID=N     -> tarih/saat/salon + takimlar + set-set skor
                                      (mID araligi taranir; sayfa her mID'de render
                                      olur, gecerlilik takim-adi + tarih penceresiyle)
  CompetitionTeamDetails.aspx      -> genis kadro bio (PlayerID, poz, boy, dogum yili)
  Statistics.aspx?ID=1573          -> "Match Stats Details per Player" gorunumu:
                                      ASP.NET postback zinciri (VIEWSTATE) ile oyuncu
                                      basina mac-mac SERVE/RECEPTION/ATTACK/BLOCK tablosu

Kimlik: CEV PlayerID != FIVB id. Once players.cev_player_id koprusu, yoksa isim-token
eslestirme (ayni ulke kodu kadrolarinda); eslesmeyene sentetik fivb_id = -cev_player_id.
Round -> tarih: satir etiketi "8 Preliminary" gibi gun indeksi; match_date =
2026-08-20 + round (takimin gercek mac tarihleriyle dogrulanir, oturmayan satir atlanir).

Idempotent; turnuva boyunca tekrar kosulabilir. Kullanim:
  python fetch_cev_eurovolley.py --dry-run --tur-only
  python fetch_cev_eurovolley.py                 # tam: maclar+kadro+istatistik+fixtures
  python fetch_cev_eurovolley.py --skip-stats    # sadece maclar/kadro/fixtures (hizli)
"""
import argparse
import json
import os
import re
import time
import unicodedata
from datetime import date, datetime, timedelta

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import psycopg2

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
BASE = "https://www-old.cev.eu/Competition-Area/"

COMP = dict(
    slug="cev-eurovolley", year=2026, gender="W", name="EuroVolley 2026", source="cev",
    cev_id=1573, pid=2992,
    date_from=date(2026, 8, 21), date_to=date(2026, 9, 6),
    round_base=date(2026, 8, 20),          # match_date = round_base + round_no gun
    mid_ranges=[(84300, 84500), (85060, 85130)],
)

# CEV TeamID -> (sayfadaki BUYUK ad, 3-harf kod, gosterim adi). Qualification dahil 33
# takim; final 24'u maclarda gorunenlerden suzulur. Yeni ad cikarsa uyari basilir.
TEAMS = {
    13436: ("AZERBAIJAN", "AZE", "Azerbaijan"),
    13437: ("BULGARIA", "BUL", "Bulgaria"),
    13438: ("CZECHIA", "CZE", "Czechia"),
    13439: ("GERMANY", "GER", "Germany"),
    13440: ("ESTONIA", "EST", "Estonia"),
    13441: ("PORTUGAL", "POR", "Portugal"),
    13442: ("KOSOVO", "KOS", "Kosovo"),
    13443: ("ROMANIA", "ROU", "Romania"),
    13444: ("FRANCE", "FRA", "France"),
    13445: ("ITALY", "ITA", "Italy"),
    13446: ("GEORGIA", "GEO", "Georgia"),
    13447: ("GREECE", "GRE", "Greece"),
    13448: ("CROATIA", "CRO", "Croatia"),
    13449: ("ISRAEL", "ISR", "Israel"),
    13450: ("LATVIA", "LAT", "Latvia"),
    13451: ("HUNGARY", "HUN", "Hungary"),
    13452: ("THE NETHERLANDS", "NED", "Netherlands"),
    13453: ("SLOVENIA", "SLO", "Slovenia"),
    13454: ("MONTENEGRO", "MNE", "Montenegro"),
    13455: ("SERBIA", "SRB", "Serbia"),
    13456: ("AUSTRIA", "AUT", "Austria"),
    13457: ("POLAND", "POL", "Poland"),
    13458: ("SPAIN", "ESP", "Spain"),
    13459: ("SLOVAKIA", "SVK", "Slovakia"),
    13460: ("FINLAND", "FIN", "Finland"),
    13461: ("SWEDEN", "SWE", "Sweden"),
    13462: ("SWITZERLAND", "SUI", "Switzerland"),
    13463: ("TÜRKIYE", "TUR", "Türkiye"),
    13464: ("UKRAINE", "UKR", "Ukraine"),
    13465: ("BELGIUM", "BEL", "Belgium"),
    13466: ("NORTH MACEDONIA", "MKD", "North Macedonia"),
    13500: ("DENMARK", "DEN", "Denmark"),
    13501: ("BOSNIA & HERZEGOVINA", "BIH", "Bosnia & Herzegovina"),
}
NAME2CODE = {n: c for n, c, _ in TEAMS.values()}
CODE2TID = {c: tid for tid, (_, c, _) in TEAMS.items()}
CODE2NAME = {c: d for _, c, d in TEAMS.values()}

POSITIONS = {"libero", "setter", "outside spiker", "outside hitter", "middle blocker",
             "opposite", "opposite spiker", "universal"}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "text/html"})


def get_html(url, tries=3):
    for k in range(tries):
        try:
            r = SESSION.get(url, timeout=40)
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


def post_html(url, data, tries=3):
    for k in range(tries):
        try:
            r = SESSION.post(url, data=data, timeout=60)
            r.raise_for_status()
            r.encoding = "utf-8"
            return r.text
        except Exception as e:
            if k == tries - 1:
                print(f"  ! POST fail: {e}")
                return None
            time.sleep(1.5 * (k + 1))
    return None


def num(s):
    """'12'->12, '63,2'->63.2, '-0,11'->-0.11, ''/None -> None."""
    if s is None:
        return None
    s = str(s).replace("\xa0", "").strip().replace("%", "").replace(",", ".")
    if s in ("", "-", "--"):
        return None
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


def to_date(s):
    s = (s or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def fold(s):
    """Isim token seti: lower + aksan fold (l-stroke vb. manuel)."""
    s = (s or "").lower().replace("ł", "l").replace("đ", "d").replace("ø", "o").replace("æ", "ae").replace("ß", "ss")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return set(t for t in re.split(r"[^a-z]+", s) if len(t) > 1)


def cev_name_to_full(name):
    """'VARGAS Melissa Teresa' -> 'Melissa Teresa Vargas' (BUYUK tokenler soyad)."""
    toks = name.split()
    sur = [t for t in toks if t.isupper() and len(t) > 1]
    first = [t for t in toks if t not in sur]
    def tc(t):
        return t[0] + t[1:].lower() if len(t) > 1 else t
    return " ".join(first + [tc(t) for t in sur]) if first else " ".join(tc(t) for t in sur)


def cev_surname(name):
    toks = [t for t in name.split() if t.isupper() and len(t) > 1]
    return " ".join(t[0] + t[1:].lower() for t in toks) if toks else name.split()[0]


def connect():
    load_dotenv()
    return psycopg2.connect(os.environ["DATABASE_URL"].strip().strip('"'))


def ensure_competition(cur):
    cur.execute(
        """insert into volleyball.competitions (comp_slug, year, gender, name, source)
           values (%(slug)s, %(year)s, %(gender)s, %(name)s, %(source)s)
           on conflict (comp_slug, year, gender) do nothing""", COMP)
    cur.execute("select id from volleyball.competitions where comp_slug=%s and year=%s and gender=%s",
                (COMP["slug"], COMP["year"], COMP["gender"]))
    return cur.fetchone()[0]


# ---------------------------------------------------------------- maclar ----
def parse_match(html):
    soup = BeautifulSoup(html, "lxml")

    def sp(suffix):
        el = soup.find("span", id=re.compile(re.escape(suffix) + "$"))
        return el.get_text(" ", strip=True) if el else None

    home, away = sp("Content_Left_LB_Casa"), sp("Content_Left_LB_Ospiti")
    if not home or not away:
        return None
    hcode, acode = NAME2CODE.get(home.upper()), NAME2CODE.get(away.upper())
    if not hcode or not acode:
        return None
    d = to_date(sp("_L_MatchDate"))
    if not d or not (COMP["date_from"] <= d <= COMP["date_to"]):
        return None
    sets = []
    for n in range(1, 6):
        a, b = num(sp(f"_LB_Set{n}Casa")), num(sp(f"_LB_Set{n}Ospiti"))
        if a is not None and b is not None and (a > 0 or b > 0):
            sets.append({"a": int(a), "b": int(b)})
    hs, as_ = num(sp("_LB_SetCasa")), num(sp("_LB_SetOspiti"))
    played = bool(sets) and (hs or 0) + (as_ or 0) >= 3
    return dict(
        date=d, home=hcode, away=acode,
        home_sets=int(hs) if hs is not None else None,
        away_sets=int(as_) if as_ is not None else None,
        sets=sets, status="Results" if played else "Scheduled",
        hour=sp("_L_MatchHour"), hall=sp("_L_Impianto"), city=sp("_L_Citta"),
    )


def scan_matches(cur, comp_id, ranges):
    cur.execute("select match_no from volleyball.matches where competition_id=%s and status='Results'", (comp_id,))
    done = {r[0] for r in cur.fetchall()}
    found, extra = {}, {}
    total = sum(hi - lo + 1 for lo, hi in ranges)
    print(f"  mID taramasi: {total} aday ({len(done)} bitmis atlanir)")
    k = 0
    for lo, hi in ranges:
        for mid in range(lo, hi + 1):
            if mid in done:
                continue
            k += 1
            html = get_html(BASE + f"MatchPage.aspx?ID={COMP['cev_id']}&mID={mid}&PID={COMP['pid']}")
            rec = parse_match(html) if html else None
            if rec:
                found[mid] = rec
                extra[mid] = (rec.pop("hour"), rec.pop("hall"), rec.pop("city"))
            if k % 40 == 0:
                print(f"    ... {k} istek, {len(found)} mac")
            time.sleep(0.2)
    for mid, r in found.items():
        cur.execute(
            """insert into volleyball.matches
                 (competition_id, match_no, match_date, home_team_id, away_team_id,
                  home_code, away_code, home_sets, away_sets, set_scores, status)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (competition_id, match_no) do update set
                 match_date=excluded.match_date, home_code=excluded.home_code,
                 away_code=excluded.away_code, home_sets=excluded.home_sets,
                 away_sets=excluded.away_sets, set_scores=excluded.set_scores,
                 status=excluded.status, updated_at=now()""",
            (comp_id, mid, r["date"], CODE2TID.get(r["home"]), CODE2TID.get(r["away"]),
             r["home"], r["away"], r["home_sets"], r["away_sets"],
             json.dumps(r["sets"]), r["status"]))
    print(f"  -> {len(found)} mac yazildi/guncellendi")
    return found, extra


def upsert_teams(cur, comp_id):
    cur.execute("select distinct home_code from volleyball.matches where competition_id=%s "
                "union select distinct away_code from volleyball.matches where competition_id=%s",
                (comp_id, comp_id))
    codes = sorted({r[0] for r in cur.fetchall() if r[0]})
    for c in codes:
        cur.execute(
            """insert into volleyball.teams (competition_id, team_code, team_name, edition_team_id)
               values (%s,%s,%s,%s)
               on conflict (competition_id, team_code) do update set
                 team_name=excluded.team_name, edition_team_id=excluded.edition_team_id""",
            (comp_id, c, CODE2NAME.get(c, c), CODE2TID.get(c)))
    print(f"  -> {len(codes)} takim")
    return codes


# ----------------------------------------------------------- kadro + kimlik ----
def fetch_team_bio(team_code):
    tid = CODE2TID[team_code]
    html = get_html(BASE + f"CompetitionTeamDetails.aspx?TeamID={tid}&ID={COMP['cev_id']}")
    if not html:
        return {}
    soup = BeautifulSoup(html, "lxml")
    out = {}
    for a in soup.find_all("a", href=re.compile(r"PlayerDetails\.aspx")):
        m = re.search(r"PlayerID=(\d+)", a["href"])
        name = a.get_text(" ", strip=True)
        if not m or not name:
            continue
        pid = int(m.group(1))
        tr = a.find_parent("tr")
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")] if tr else []
        rec = dict(name=name, position=None, height=None, birth_year=None, shirt=None)
        nums = []
        for cell in cells:
            low = cell.lower()
            if low in POSITIONS:
                rec["position"] = cell
            v = num(cell)
            if isinstance(v, int):
                nums.append(v)
        for v in nums:
            if 1 <= v <= 99 and rec["shirt"] is None:
                rec["shirt"] = v
            elif 140 <= v <= 230 and rec["height"] is None:
                rec["height"] = v
            elif 1970 <= v <= 2012 and rec["birth_year"] is None:
                rec["birth_year"] = v
        out[pid] = rec
    return out


def resolve_players(cur, comp_id, team_bios):
    """CEV pid -> fivb_id (kopru/isim/sentetik) + players/roster upsert."""
    cur.execute("select cev_player_id, fivb_id from volleyball.players where cev_player_id is not null")
    bridge = dict(cur.fetchall())
    cur.execute(
        """select distinct r.team_code, p.fivb_id, p.full_name, coalesce(p.short_name,'')
           from volleyball.roster r join volleyball.players p on p.fivb_id = r.fivb_id""")
    pool = {}
    for code, fid, full, short in cur.fetchall():
        pool.setdefault(code, []).append((fid, fold((full or "") + " " + short)))

    pid2fid, n_bridge, n_name, n_synth = {}, 0, 0, 0
    for code, bios in team_bios.items():
        for pid, b in bios.items():
            if pid in bridge:
                fid = bridge[pid]; n_bridge += 1
            else:
                toks = fold(b["name"])
                best, second, bfid = 0, 0, None
                for fid_c, ptoks in pool.get(code, []):
                    sc = len(toks & ptoks)
                    if sc > best:
                        best, second, bfid = sc, best, fid_c
                    elif sc == best:
                        second = sc
                if best >= 2 and best > second:
                    fid = bfid; n_name += 1
                    cur.execute("update volleyball.players set cev_player_id=%s, "
                                "position=coalesce(position,%s), height_cm=coalesce(height_cm,%s) "
                                "where fivb_id=%s", (pid, b["position"], b["height"], fid))
                else:
                    fid = -pid; n_synth += 1
            pid2fid[pid] = (fid, code)
            if fid < 0:
                cur.execute(
                    """insert into volleyball.players
                         (fivb_id, full_name, short_name, position, height_cm, nationality, cev_player_id)
                       values (%s,%s,%s,%s,%s,%s,%s)
                       on conflict (fivb_id) do update set
                         full_name=excluded.full_name,
                         position=coalesce(volleyball.players.position, excluded.position),
                         height_cm=coalesce(volleyball.players.height_cm, excluded.height_cm),
                         cev_player_id=excluded.cev_player_id, updated_at=now()""",
                    (fid, cev_name_to_full(b["name"]), cev_surname(b["name"]),
                     b["position"], b["height"], code, pid))
    print(f"  kimlik: {n_bridge} kopru + {n_name} isim eslesme + {n_synth} sentetik")
    return pid2fid


def upsert_roster(cur, comp_id, pid2fid, team_bios, played_pids):
    n = 0
    for code, bios in team_bios.items():
        for pid, b in bios.items():
            if pid not in played_pids:
                continue
            fid, _ = pid2fid[pid]
            cur.execute(
                """insert into volleyball.roster (competition_id, team_code, fivb_id, shirt_number, position)
                   values (%s,%s,%s,%s,%s)
                   on conflict (competition_id, fivb_id) do update set
                     team_code=excluded.team_code,
                     shirt_number=coalesce(excluded.shirt_number, volleyball.roster.shirt_number),
                     position=coalesce(excluded.position, volleyball.roster.position)""",
                (comp_id, code, fid, b["shirt"], b["position"]))
            n += 1
    print(f"  -> roster {n} oyuncu (istatistigi olanlar)")


# ------------------------------------------------------------- istatistik ----
STATS_URL = BASE + "Statistics.aspx?ID={}".format(1573)
DDL_PLAYERS = "ctl00$Content_Left$DDL_Players"
DDL_PHASES = "ctl00$Content_Left$DDL_Phases"
RLB_CS = "ctl00_Content_Left_RLB_PlayerStats_ClientState"
RLB_TARGET = "ctl00$Content_Left$RLB_PlayerStats"


def form_fields(soup):
    form = soup.find("form")
    fields = {}
    for i in form.find_all(["input", "select", "textarea"]):
        n = i.get("name")
        if not n:
            continue
        if i.name == "select":
            sel = i.find("option", selected=True)
            fields[n] = sel.get("value", "") if sel else ""
        else:
            fields[n] = i.get("value", "") or ""
    return fields


def stats_open_session():
    """Statistics -> 'Match Stats Details per Player' + Final Phase secili durum."""
    html = get_html(STATS_URL)
    if not html:
        return None, None
    f = form_fields(BeautifulSoup(html, "lxml"))
    f[RLB_CS] = ('{"isEnabled":true,"logEntries":[],"selectedIndices":[0],'
                 '"checkedIndices":[],"scrollPosition":0}')
    f["__EVENTTARGET"], f["__EVENTARGUMENT"] = RLB_TARGET, ""
    html = post_html(STATS_URL, f)
    if not html:
        return None, None
    f = form_fields(BeautifulSoup(html, "lxml"))
    f[DDL_PHASES] = str(COMP["pid"])          # Final Phase
    f["__EVENTTARGET"], f["__EVENTARGUMENT"] = DDL_PHASES, ""
    html = post_html(STATS_URL, f)
    if not html:
        return None, None
    soup = BeautifulSoup(html, "lxml")
    dd = soup.find("select", attrs={"name": DDL_PLAYERS})
    ids = [int(o["value"]) for o in dd.find_all("option") if (o.get("value") or "").isdigit()] if dd else []
    print(f"  stats oturumu acildi: dropdown'da {len(ids)} oyuncu")
    return form_fields(soup), set(ids)


# mac satiri kolonlari (Round + PlayedSet sonrasi 23 metrik)
MSD_COLS = ["pts_tot", "pts_won", "pts_bp",
            "srv_tot", "srv_ace", "srv_err", "srv_aps", "srv_eff",
            "rec_tot", "rec_err", "rec_neg", "rec_exc", "rec_pct", "rec_eff",
            "atk_tot", "atk_err", "atk_blk", "atk_exc", "atk_pct", "atk_eff",
            "blk_net", "blk_pts", "blk_pps"]


def parse_msd(html):
    """-> (mac satirlari [{round, played_set, <MSD_COLS>}], totals dict|None)"""
    soup = BeautifulSoup(html, "lxml")
    target = None
    for tbl in soup.find_all("table"):
        head = tbl.find("tr")
        if head and "Round" in head.get_text() and "POINTS" in tbl.get_text():
            target = tbl
    if target is None:
        return [], None
    rows, totals = [], None
    for tr in target.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) != 2 + len(MSD_COLS):
            continue
        label = cells[0]
        vals = dict(zip(MSD_COLS, (num(c) for c in cells[2:])))
        vals["played_set"] = num(cells[1])
        m = re.match(r"^(\d+)\s+(.+)$", label)
        if m and "qual" not in m.group(2).lower():
            vals["round"] = int(m.group(1))
            vals["phase"] = m.group(2).strip()
            rows.append(vals)
        elif label.strip().lower() == "totals":
            totals = vals
    return rows, totals


POOL_END = date(2026, 8, 28)


def elim_index(phase_label):
    """Eleme fazi satir etiketi -> takimin eleme maci sirasi (None = pool/Preliminary).
    Satirdaki 'Round' elemede GUN DEGIL faz sirasidir (hepsi '9 8th Final' gibi);
    tarih, takimin 28 Agu sonrasi maclarinin sirasindan bulunur."""
    s = (phase_label or "").lower()
    if "8th" in s or "eight" in s:
        return 0
    if "quarter" in s:
        return 1
    if "semi" in s:
        return 2
    if "final" in s or "3rd" in s or "bronze" in s:
        return 3      # takim ya bronz ya final oynar: eleme listesinde 4. mac
    return None


def iv(v):
    return int(v) if isinstance(v, (int, float)) and v is not None else None


def write_player_stats(cur, comp_id, fid, code, rows, totals, team_dates):
    """Mac satirlari -> player_match_stats (FIVB-jsonb formatinda) + totals -> pcs."""
    written = 0
    pool_dates = {t for t in team_dates if t <= POOL_END}
    elim_dates = sorted(t for t in team_dates if t > POOL_END)
    for r in rows:
        eidx = elim_index(r.get("phase"))
        if eidx is None:
            # Preliminary: Round = turnuva gun indeksi (21 Agu = 1). Sadece pool
            # maclarina baglanir (eleme maclarina +-1 kaymasi YASAK — 8F satiri
            # 28 Agu pool macini ezmisti).
            d = COMP["round_base"] + timedelta(days=r["round"])
            if d not in pool_dates:
                near = [t for t in pool_dates if abs((t - d).days) <= 1]
                if len(near) == 1:
                    d = near[0]
                else:
                    print(f"    ! pool round {r['round']} ({code}) mac bulunamadi, atlandi")
                    continue
        else:
            if eidx >= len(elim_dates):
                print(f"    ! eleme satiri '{r.get('phase')}' ({code}) icin mac yok, atlandi")
                continue
            d = elim_dates[eidx]
        home, away = team_dates[d]
        cats = {
            "scoring": {"points": iv(r["pts_tot"]), "attack_points": iv(r["atk_exc"]),
                        "block_points": iv(r["blk_pts"]), "serve_points": iv(r["srv_ace"]),
                        "won": iv(r["pts_won"]), "break_points": iv(r["pts_bp"])},
            "serve": {"points": iv(r["srv_ace"]), "errors": iv(r["srv_err"]),
                      "attempts": iv(r["srv_tot"]), "avg": r["srv_aps"],
                      "efficiency": r["srv_eff"], "total": iv(r["srv_tot"])},
            "reception": {"successful": iv(r["rec_exc"]), "errors": iv(r["rec_err"]),
                          "attempts": iv(r["rec_tot"]), "negative": iv(r["rec_neg"]),
                          "success": r["rec_pct"], "efficiency": r["rec_eff"],
                          "total": iv(r["rec_tot"])},
            "attack": {"points": iv(r["atk_exc"]), "errors": iv(r["atk_err"]),
                       "attempts": iv(r["atk_tot"]), "blocked": iv(r["atk_blk"]),
                       "success": r["atk_pct"], "efficiency": r["atk_eff"],
                       "total": iv(r["atk_tot"])},
            "block": {"blocks": iv(r["blk_pts"]), "net": iv(r["blk_net"]), "avg": r["blk_pps"]},
        }
        for cat, data in cats.items():
            data["sets_played"] = iv(r["played_set"])
            cur.execute(
                """insert into volleyball.player_match_stats
                     (competition_id, fivb_id, match_date, home_team, away_team, category, data)
                   values (%s,%s,%s,%s,%s,%s,%s)
                   on conflict (competition_id, fivb_id, match_date, category)
                   do update set home_team=excluded.home_team, away_team=excluded.away_team,
                                 data=excluded.data""",
                (comp_id, fid, d, home, away, cat, json.dumps(data)))
        written += 1
    t = totals or {}
    if t or rows:
        agg = lambda k: iv(sum((r[k] or 0) for r in rows)) if not t else iv(t.get(k))
        aggf = lambda k: t.get(k) if t else None
        cur.execute(
            """insert into volleyball.player_competition_stats
                 (competition_id, fivb_id, team_code,
                  points, attack_points, block_points, serve_points,
                  atk_points, atk_errors, atk_attempts, atk_success, atk_total,
                  blk_blocks, blk_avg,
                  srv_points, srv_errors, srv_attempts, srv_avg,
                  rec_successful, rec_errors, rec_attempts, rec_success)
               values (%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s, %s,%s,%s,%s, %s,%s,%s,%s)
               on conflict (competition_id, fivb_id) do update set
                 team_code=excluded.team_code, points=excluded.points,
                 attack_points=excluded.attack_points, block_points=excluded.block_points,
                 serve_points=excluded.serve_points, atk_points=excluded.atk_points,
                 atk_errors=excluded.atk_errors, atk_attempts=excluded.atk_attempts,
                 atk_success=excluded.atk_success, atk_total=excluded.atk_total,
                 blk_blocks=excluded.blk_blocks, blk_avg=excluded.blk_avg,
                 srv_points=excluded.srv_points, srv_errors=excluded.srv_errors,
                 srv_attempts=excluded.srv_attempts, srv_avg=excluded.srv_avg,
                 rec_successful=excluded.rec_successful, rec_errors=excluded.rec_errors,
                 rec_attempts=excluded.rec_attempts, rec_success=excluded.rec_success,
                 updated_at=now()""",
            (comp_id, fid, code,
             agg("pts_tot"), agg("atk_exc"), agg("blk_pts"), agg("srv_ace"),
             agg("atk_exc"), agg("atk_err"), agg("atk_tot"), aggf("atk_pct"), agg("atk_tot"),
             agg("blk_pts"), aggf("blk_pps"),
             agg("srv_ace"), agg("srv_err"), agg("srv_tot"), aggf("srv_aps"),
             agg("rec_exc"), agg("rec_err"), agg("rec_tot"), aggf("rec_pct")))
    return written


def update_ranks(cur, comp_id):
    for col, order in (("scorer_rank", "points"), ("atk_rank", "atk_points"),
                       ("blk_rank", "blk_blocks"), ("srv_rank", "srv_points"),
                       ("rec_rank", "rec_successful")):
        cur.execute(
            f"""update volleyball.player_competition_stats s set {col}=r.rn
                from (select fivb_id, row_number() over (order by {order} desc nulls last) rn
                      from volleyball.player_competition_stats where competition_id=%s) r
                where s.competition_id=%s and s.fivb_id=r.fivb_id""",
            (comp_id, comp_id))


# --------------------------------------------------------------- fixtures ----
def sync_fixtures(cur, comp_id, extra):
    cur.execute("""select match_no, match_date, home_code, away_code, status
                   from volleyball.matches where competition_id=%s
                    and (home_code='TUR' or away_code='TUR')""", (comp_id,))
    n_fin, n_up = 0, 0
    for mid, d, h, a, status in cur.fetchall():
        if status == "Results":
            # seed fiksturler hep TUR-ev yazilmisti; CEV cetvelinde ters olabilir -> iki yon
            cur.execute("""update volleyball.fixtures set status='Finished'
                           where competition_name=%s and match_date=%s
                             and ((home_code=%s and away_code=%s) or (home_code=%s and away_code=%s))
                             and status <> 'Finished'""",
                        (COMP["name"], d, h, a, a, h))
            n_fin += cur.rowcount
        else:
            hour, hall, city = extra.get(mid, (None, None, None))
            venue = ", ".join(x for x in (hall, city) if x) or None
            stage = "Pool A" if d <= date(2026, 8, 28) else "Final Phase"
            cur.execute(
                """insert into volleyball.fixtures
                     (competition_name, stage, match_date, match_time,
                      home_code, away_code, home_name, away_name, venue, status)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,'Scheduled')
                   on conflict (competition_name, match_date, home_code, away_code)
                   do update set match_time=coalesce(excluded.match_time, volleyball.fixtures.match_time),
                                 venue=coalesce(excluded.venue, volleyball.fixtures.venue),
                                 stage=excluded.stage, status='Scheduled'""",
                (COMP["name"], stage, d, hour, h, a, CODE2NAME.get(h, h), CODE2NAME.get(a, a), venue))
            n_up += 1
    print(f"  fixtures: {n_fin} Finished, {n_up} yaklasan upsert")


# ------------------------------------------------------------------- main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-stats", action="store_true")
    ap.add_argument("--skip-scan", action="store_true", help="mac taramasini atla")
    ap.add_argument("--tur-only", action="store_true", help="istatistikte sadece TUR oyunculari")
    ap.add_argument("--resume", action="store_true",
                    help="bugun istatistigi yazilmis oyunculari atla (yarim kalan kosuyu tamamlama)")
    args = ap.parse_args()

    conn = connect()
    cur = conn.cursor()
    comp_id = ensure_competition(cur)
    print(f"=== {COMP['name']} (competition_id={comp_id}) ===")

    extra = {}
    if not args.skip_scan:
        print("\n[1] maclar (mID taramasi)")
        _, extra = scan_matches(cur, comp_id, COMP["mid_ranges"])
    print("\n[2] takimlar")
    codes = upsert_teams(cur, comp_id)

    print("\n[3] kadro bio")
    team_bios = {}
    for c in codes:
        team_bios[c] = fetch_team_bio(c)
        print(f"  {c}: {len(team_bios[c])} oyuncu (genis liste)")
        time.sleep(0.2)
    pid2fid = resolve_players(cur, comp_id, team_bios)

    played_pids = set()
    if not args.skip_stats:
        print("\n[4] oyuncu istatistikleri (postback zinciri)")
        state, ddl_ids = stats_open_session()
        if state is None:
            print("  ! stats oturumu acilamadi")
        else:
            # yalniz oynanmis maclar: istatistik satiri Scheduled maca baglanmamali
            # (SRB 8F satirinin yarinki QF'e yapismasi gibi)
            cur.execute("""select match_date, home_code, away_code from volleyball.matches
                           where competition_id=%s and status='Results'""", (comp_id,))
            all_matches = cur.fetchall()
            team_dates = {}
            for d, h, a in all_matches:
                team_dates.setdefault(h, {})[d] = (h, a)
                team_dates.setdefault(a, {})[d] = (h, a)
            targets = [(pid, code) for code, bios in team_bios.items() for pid in bios
                       if pid in ddl_ids and (not args.tur_only or code == "TUR")]
            if args.resume:
                cur.execute(
                    """select p.cev_player_id from volleyball.player_competition_stats s
                       join volleyball.players p on p.fivb_id = s.fivb_id
                       where s.competition_id=%s and s.updated_at::date = current_date
                         and p.cev_player_id is not null""", (comp_id,))
                done_today = {r[0] for r in cur.fetchall()}
                targets = [t for t in targets if t[0] not in done_today]
                print(f"  resume: {len(done_today)} bugun islenmis, atlandi")
            print(f"  hedef: {len(targets)} oyuncu")
            n_played = 0
            for i, (pid, code) in enumerate(targets, 1):
                f = dict(state)
                f[DDL_PLAYERS] = str(pid)
                f["__EVENTTARGET"], f["__EVENTARGUMENT"] = DDL_PLAYERS, ""
                html = post_html(STATS_URL, f)
                if not html:
                    continue
                state = form_fields(BeautifulSoup(html, "lxml"))
                rows, totals = parse_msd(html)
                if rows:
                    fid, _ = pid2fid[pid]
                    write_player_stats(cur, comp_id, fid, code, rows, totals,
                                       team_dates.get(code, {}))
                    played_pids.add(pid)
                    n_played += 1
                if i % 25 == 0:
                    print(f"    ... {i}/{len(targets)} ({n_played} istatistikli)")
                    conn.commit() if not args.dry_run else None
                time.sleep(0.35)
            print(f"  -> {n_played} oyuncuya mac-mac veri yazildi")
            update_ranks(cur, comp_id)
        upsert_roster(cur, comp_id, pid2fid, team_bios, played_pids)

    print("\n[5] fixtures senkron")
    sync_fixtures(cur, comp_id, extra)

    if args.dry_run:
        conn.rollback()
        print("\n(dry-run rollback)")
    else:
        conn.commit()
        print("\ncommit OK")
    cur.close()
    conn.close()
    print("BITTI.")


if __name__ == "__main__":
    main()
