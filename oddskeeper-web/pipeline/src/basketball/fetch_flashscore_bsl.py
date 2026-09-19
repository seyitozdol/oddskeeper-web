"""FlashScore BSL maç + oyuncu box-score çekici — maç bitince OTOMATİK akış (futbol match_scrape kalıbı).

NEDEN FlashScore: TBF (resmi) TR-geo + Cloudflare arkasında, her sezon id'leri elle bulunmalı ve
headful tarayıcı + TR proxy ister. FlashScore aynı box-score'u DÜZ HTTP ile verir: VPS'ten
proxysiz, tarayıcısız, sezon id'si gerekmeden (lig URL'si sabit, sayfa hep güncel sezonu gösterir).

Kaynak:
  keşif   https://www.flashscore.com/basketball/turkey/super-lig/results/
          sayfaya gömülü feed; blok ayracı "~", alan "¬", anahtar÷değer. Alanlar:
          AA=maç id, AD=tip-off (unix), AB=durum (3=bitti), ER=tur ("Round 7" / "Final"),
          AE/AF=ev/dep adı, PX/PY=takım id, WM/WN=takım kısa kodu, AG/AH=skor.
  oyuncu  <feed>/df_psn_1_<maç id>   PF=kolon kodları, PJ=oyuncu, PK=/player/<ad-slug>/<id>/,
          PN=takım kısa kodu, PC=değerler ("|" ayraçlı, "-" = 0). İlk bölüm (PA÷Overall) alınır.
  takım   <feed>/df_st_1_<maç id>    SG=etiket, SH=ev, SI=dep (yalnız "Match" bölümü).
  Feed çağrıları sitenin kendi sayfa ayarında yayınladığı feed_sign değerini x-fsign başlığıyla ister
  (sayfadan okunur, gömülü sabit yedek).

Kimlik: fs oyuncu id'si → player_slug identity.py ile (tam isim → tek aday; yoksa yeni slug +
inceleme kuyruğu). Geçmiş sezon oyuncularının fs id'si build_fs_player_bridge.py ile İSİMSİZ
(istatistik imzası) bağlanır. fouls_drawn FlashScore'da yok → NULL.

ÇİFT YAZIM KORUMASI: aynı maç başka kaynaktan (tbf_api / excel) zaten yazılmışsa ATLANIR; view'lar
tüm kaynakları topladığından iki kaynak aynı maçı yazarsa istatistikler ikiye katlanırdı.

Kullanım:
  python src/basketball/fetch_flashscore_bsl.py                      # bitmiş + yüklenmemiş maçlar
  python src/basketball/fetch_flashscore_bsl.py --dry-run --match nPacC96M --season-path super-lig-2025-2026
Env: FS_BSL_MIN_AGE_H (tip-off'tan sonra en az; vars. 2.5 ≈ bitiş+30dk), FS_BSL_MAX_AGE_D (vars. 14).
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv

from identity import current_season_label, other_source_has, resolve_players, resolve_teams

SITE = "https://www.flashscore.com/basketball/turkey"
FEED = "https://2.flashscore.ninja/2/x/feed"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
FALLBACK_SIGN = "SW9D1eZo"
SOURCE = "flashscore"
COMPETITION = "Basketbol Süper Ligi"
TR_TZ = timezone(timedelta(hours=3))
# Normal sezon 30 hafta; play-off turları TBF'nin hafta numaralamasıyla hizalı (31-33).
PLAYOFF_WEEK = {"quarter-finals": 31, "semi-finals": 32, "final": 33}

# df_psn kolon kodu → db kolonu
P_MAP = {"PTS": "points", "2PM": "fg2m", "2PA": "fg2a", "3PM": "fg3m", "3PA": "fg3a", "FTM": "ftm",
         "FTA": "fta", "OR": "oreb", "DR": "dreb", "REB": "treb", "AST": "assists", "TO": "turnovers",
         "ST": "steals", "BS": "blocks", "BA": "blocks_against", "PF": "fouls_committed"}
# df_st etiketi → db kolonu
T_MAP = {"2-point field goals made": "fg2m", "2-point field goals attempts": "fg2a",
         "3-point field goals made": "fg3m", "3-point field goals attempts": "fg3a",
         "free throws made": "ftm", "free throws attempts": "fta",
         "offensive rebounds": "oreb", "defensive rebounds": "dreb", "total rebounds": "treb",
         "assists": "assists", "turnovers": "turnovers", "steals": "steals", "blocks": "blocks",
         "personal fouls": "fouls_committed"}

PMS_COLS = ["source", "season_label", "competition", "match_key", "match_date", "week",
            "player_slug", "player_name", "team_slug", "team_name", "seconds_played", "minutes",
            "points", "fg2m", "fg2a", "fg2_pct", "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct",
            "oreb", "dreb", "treb", "assists", "turnovers", "steals", "blocks", "blocks_against",
            "fouls_committed", "fs_player_id", "fs_match_id"]
TMS_COLS = ["source", "season_label", "competition", "match_key", "match_date", "week",
            "team_slug", "team_name", "home_away", "opponent_slug", "opponent_name", "points", "opp_points",
            "fg2m", "fg2a", "fg2_pct", "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct", "oreb", "dreb",
            "treb", "assists", "turnovers", "steals", "blocks", "fouls_committed", "fs_team_id", "fs_match_id"]


# ----------------------------- HTTP + feed ayrıştırma -----------------------------
def http_get(url, sign=None):
    req = urllib.request.Request(url, headers={"user-agent": UA, **({"x-fsign": sign} if sign else {})})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace")


def blocks(text):
    """'~' bloklu, '¬' alanlı, 'anahtar÷değer' feed → [dict]."""
    out = []
    for blk in text.split("~"):
        f = dict(x.split("÷", 1) for x in blk.split("¬") if "÷" in x)
        if f:
            out.append(f)
    return out


def _int(v):
    v = (v or "").strip()
    if v in ("", "-"):
        return 0
    try:
        return int(float(v))
    except ValueError:
        return None


def _pct(make, att):
    return round(make / att * 100, 1) if make is not None and att else None


def season_label_of(ts):
    """Tip-off → sezon etiketi. Sezon sınırı 1 Temmuz (BSL Eylül-Haziran)."""
    d = datetime.fromtimestamp(ts, TR_TZ)
    start = d.year if d.month >= 7 else d.year - 1
    return f"{start}-{start + 1}"


def week_of(round_text):
    t = (round_text or "").strip().lower()
    m = re.search(r"round (\d+)", t)
    if m:
        return int(m.group(1))
    for key, wk in PLAYOFF_WEEK.items():
        if t.startswith(key):
            return wk
    return None


def discover(season_path, all_pages=False):
    """Sonuç sayfası → (feed_sign, [maç]). Yalnız BİTMİŞ maçlar (AB=3), maç id'ye göre tekil.

    Sayfa en yeni ~100 maçı gömülü verir; all_pages ile "daha fazla göster" beslemesi
    (tr_1_<ülke>_<turnuva>_<sezon>_<sayfa>_<tz>_en_1) boş dönene kadar gezilir."""
    html = http_get(f"{SITE}/{season_path}/results/")
    m = re.search(r'"feed_sign":"([^"]+)"', html)
    sign = m.group(1) if m else FALLBACK_SIGN
    texts = [html]
    if all_pages:
        cid = re.search(r"country_id\s*[:=]\s*(\d+)", html)
        tid = re.search(r'tournament_id\s*[:=]\s*"([^"]+)"', html)
        sid = re.search(r"seasonId:\s*(\d+)", html)
        if cid and tid and sid:
            for page in range(1, 12):
                t = http_get(f"{FEED}/tr_1_{cid.group(1)}_{tid.group(1)}_{sid.group(1)}_{page}_3_en_1", sign)
                if "AA÷" not in t:
                    break
                texts.append(t)
                time.sleep(0.5)
    games, seen = [], set()
    for text in texts:
        for f in blocks(text):
            if "AA" not in f or f["AA"] in seen or f.get("AB") != "3" or not f.get("AD"):
                continue
            seen.add(f["AA"])
            games.append({
                "mid": f["AA"], "ts": int(f["AD"]), "round": f.get("ER"),
                "home": {"id": f.get("PX"), "name": f.get("AE"), "code": f.get("WM"), "pts": _int(f.get("AG"))},
                "away": {"id": f.get("PY"), "name": f.get("AF"), "code": f.get("WN"), "pts": _int(f.get("AH"))},
            })
    return sign, games


def parse_players(text, game):
    """df_psn → oyuncu satırları (yalnız süre alanlar; ilk 'Overall' bölümü)."""
    cols, rows, section = [], [], 0
    for f in blocks(text):
        if "PA" in f:
            section += 1
            if section > 1:
                break
        elif "PF" in f and "PJ" not in f:
            cols.append(f["PF"])
        elif "PJ" in f and "PC" in f:
            vals = dict(zip(cols[1:], f["PC"].split("|")))          # cols[0] = "Player"
            mm = re.match(r"(\d+):(\d+)", vals.get("MIN", "") or "")
            secs = int(mm.group(1)) * 60 + int(mm.group(2)) if mm else 0
            pk = re.match(r"/player/([^/]+)/([^/]+)/", f.get("PK", ""))
            side = "home" if f.get("PN") == game["home"]["code"] else "away" if f.get("PN") == game["away"]["code"] else None
            if secs <= 0 or not pk or not side:
                continue
            # PK slug'ı "soyad-ad" tam isimdir ("horton-tucker-talen"); PJ kısaltması ("Horton-Tucker T.")
            # soyadın kaç parça olduğunu söyler → "Talen Horton Tucker".
            parts = pk.group(1).split("-")
            n_sur = max(1, len(re.split(r"[\s-]+", f["PJ"].strip())) - 1)
            full = " ".join(parts[n_sur:] + parts[:n_sur]) if len(parts) > n_sur else " ".join(parts)
            row = {"fs_player_id": pk.group(2), "player_name": full.title(), "fs_short": f["PJ"], "side": side,
                   "source_team_id": game[side]["id"], "seconds_played": secs, "minutes": round(secs / 60, 2)}
            row.update({db: _int(vals.get(code)) for code, db in P_MAP.items()})
            # FlashScore hücreyi bazen boş ("-") bırakır: toplam ribaund ayrıntıdan büyükse farkı hücuma yaz
            if row["treb"] is not None and row["treb"] > (row["oreb"] or 0) + (row["dreb"] or 0):
                row["oreb"] = row["treb"] - (row["dreb"] or 0)
            row["fg2_pct"], row["fg3_pct"] = _pct(row["fg2m"], row["fg2a"]), _pct(row["fg3m"], row["fg3a"])
            row["ft_pct"] = _pct(row["ftm"], row["fta"])
            rows.append(row)
    return rows


def parse_team_stats(text):
    """df_st 'Match' bölümü → ({db kolon: ev}, {db kolon: dep})."""
    home, away, in_match = {}, {}, False
    for f in blocks(text):
        if "SE" in f:
            in_match = f["SE"] == "Match"
        elif in_match and "SG" in f:
            db = T_MAP.get(f["SG"].strip().lower())
            if db:
                home[db], away[db] = _int(f.get("SH")), _int(f.get("SI"))
    return home, away


def build_rows(game, players, tstats):
    """Kaynak satırları (kimlik çözümlemeden ÖNCE; slug/isim write_match'te kanonikleşir)."""
    season = season_label_of(game["ts"])
    date = datetime.fromtimestamp(game["ts"], TR_TZ).strftime("%Y-%m-%d")
    base = {"source": SOURCE, "season_label": season, "competition": COMPETITION, "match_date": date,
            "week": week_of(game["round"]), "fs_match_id": game["mid"]}
    team_rows = []
    for side, opp, stats in (("home", "away", tstats[0]), ("away", "home", tstats[1])):
        mine = [p for p in players if p["side"] == side]
        row = dict(base, home_away="Home" if side == "home" else "Away", team_name=game[side]["name"],
                   source_team_id=game[side]["id"], opp_source_team_id=game[opp]["id"], fs_team_id=game[side]["id"],
                   points=game[side]["pts"], opp_points=game[opp]["pts"])
        for db in set(T_MAP.values()):
            # resmi takım istatistiği; yoksa oyuncu toplamı (takım ribaundu oyunculara yazılmaz)
            row[db] = stats.get(db) if stats.get(db) is not None else sum(p.get(db) or 0 for p in mine)
        row["fg2_pct"], row["fg3_pct"] = _pct(row["fg2m"], row["fg2a"]), _pct(row["fg3m"], row["fg3a"])
        row["ft_pct"] = _pct(row["ftm"], row["fta"])
        team_rows.append(row)
    player_rows = [dict(base, **p) for p in players]
    return team_rows, player_rows


# ----------------------------- yazım -----------------------------
def already_loaded(cur, fs_match_id):
    cur.execute("select 1 from basketball.team_match_stats where fs_match_id=%s limit 1", (fs_match_id,))
    return cur.fetchone() is not None


def write_match(cur, team_rows, player_rows):
    season = team_rows[0]["season_label"]
    teams = resolve_teams(cur, team_rows, season, source=SOURCE)
    home = next(t for t in team_rows if t["home_away"] == "Home")
    h, a = teams[home["source_team_id"]], teams[home["opp_source_team_id"]]
    dup = other_source_has(cur, season, home["match_date"], home["week"], h["slug"], a["slug"], home["points"], home["opp_points"], SOURCE)
    if dup:
        print(f"[fs-bsl]  {home['fs_match_id']} ATLANDI: {h['name']} - {a['name']} zaten '{dup}' kaynağından yazılı", flush=True)
        return False
    players = resolve_players(cur, player_rows, season, teams, source=SOURCE,
                              update_roster=(season == current_season_label()))
    match_key = f"{h['name']} - {a['name']}"
    for r in player_rows:
        who, team = players[r["fs_player_id"]], teams[r["source_team_id"]]
        r = dict(r, player_slug=who["slug"], player_name=who["name"], match_key=match_key,
                 team_slug=team["slug"], team_name=team["name"])
        sets = ", ".join(f"{c}=excluded.{c}" for c in PMS_COLS if c not in ("fs_match_id", "fs_player_id"))
        cur.execute(f"""insert into basketball.player_match_stats ({",".join(PMS_COLS)})
            values ({",".join(["%s"] * len(PMS_COLS))})
            on conflict (fs_match_id, fs_player_id) where fs_match_id is not null and fs_player_id is not null
            do update set {sets}, updated_at=now()""", [r.get(c) for c in PMS_COLS])
    for r in team_rows:
        team, opp = teams[r["source_team_id"]], teams[r["opp_source_team_id"]]
        r = dict(r, match_key=match_key, team_slug=team["slug"], team_name=team["name"],
                 opponent_slug=opp["slug"], opponent_name=opp["name"])
        sets = ", ".join(f"{c}=excluded.{c}" for c in TMS_COLS if c not in ("fs_match_id", "fs_team_id"))
        cur.execute(f"""insert into basketball.team_match_stats ({",".join(TMS_COLS)})
            values ({",".join(["%s"] * len(TMS_COLS))})
            on conflict (fs_match_id, fs_team_id) where fs_match_id is not null and fs_team_id is not null
            do update set {sets}, updated_at=now()""", [r.get(c) for c in TMS_COLS])
    return True


def fetch_match(sign, game):
    players = parse_players(http_get(f"{FEED}/df_psn_1_{game['mid']}", sign), game)
    tstats = parse_team_stats(http_get(f"{FEED}/df_st_1_{game['mid']}", sign))
    return build_rows(game, players, tstats)


# ----------------------------- orkestrasyon -----------------------------
def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    min_age = float(os.environ.get("FS_BSL_MIN_AGE_H", "2.5")) * 3600
    max_age = float(os.environ.get("FS_BSL_MAX_AGE_D", "14")) * 86400
    now = time.time()
    sign, games = discover(args.season_path, all_pages=args.all_pages)
    if args.match:
        games = [g for g in games if g["mid"] == args.match]      # yalnız o ligin sonuçlarında varsa
    elif not args.no_age_window:
        games = [g for g in games if min_age <= now - g["ts"] <= max_age]
    print(f"[fs-bsl] kesif: {len(games)} aday mac (sezon yolu={args.season_path})", flush=True)

    conn = None if args.dry_run else psycopg2.connect(os.environ["DATABASE_URL"])
    loaded, dump = 0, []
    for g in sorted(games, key=lambda x: x["ts"]):
        if conn:
            with conn.cursor() as cur:
                if already_loaded(cur, g["mid"]):
                    continue
        team_rows, player_rows = fetch_match(sign, g)
        label = f"{g['home']['name']} {g['home']['pts']}-{g['away']['pts']} {g['away']['name']}"
        if len(player_rows) < 10:          # box-score henüz yayınlanmamış → sonraki turda tekrar dene
            print(f"[fs-bsl]  {g['mid']} {label}: oyuncu verisi eksik ({len(player_rows)}), beklemede", flush=True)
            continue
        if args.dump_json:
            dump.append({"mid": g["mid"], "team_rows": team_rows, "player_rows": player_rows})
        if args.dry_run:
            print(f"[fs-bsl]  {g['mid']} {label} | hafta={team_rows[0]['week']} tarih={team_rows[0]['match_date']} "
                  f"oyuncu={len(player_rows)}", flush=True)
        else:
            with conn.cursor() as cur:
                ok = write_match(cur, team_rows, player_rows)
            conn.commit()
            if ok:
                loaded += 1
                print(f"[fs-bsl]  {g['mid']} {label} yuklendi ({len(player_rows)} oyuncu)", flush=True)
        time.sleep(0.6)

    if conn and loaded:
        with conn.cursor() as cur:
            cur.execute("refresh materialized view analytics.bb_player_metric_window_v1")
            cur.execute("refresh materialized view analytics.bb_player_metric_window_roster_v1")
        conn.commit()
        print("[fs-bsl] tools matview'lari tazelendi", flush=True)
    if conn:
        conn.close()
    if args.dump_json:
        with open(args.dump_json, "w", encoding="utf-8") as f:
            json.dump(dump, f, ensure_ascii=False)
    print(f"[fs-bsl] BITTI: islenen={loaded}" + (" (DRY-RUN)" if args.dry_run else ""), flush=True)


def main():
    ap = argparse.ArgumentParser(description="FlashScore BSL box-score cekici (duz HTTP)")
    ap.add_argument("--season-path", default="super-lig", help="guncel sezon: super-lig; arsiv: super-lig-2025-2026")
    ap.add_argument("--match", help="tek mac (FlashScore mac id); yas penceresi uygulanmaz")
    ap.add_argument("--all-pages", action="store_true", help="tum sezon (sayfalama beslemesiyle); yas penceresi yine uygulanir")
    ap.add_argument("--no-age-window", action="store_true", help="yas penceresini uygulama (gecmis sezon dokumu icin)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--dump-json", help="satirlari dosyaya yaz (build_fs_player_bridge.py girdisi)")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
