"""EuroLeague / EuroCup box-score ingestion (api-live.euroleague.net v2).

Kimlik EL person.code (oyuncu) + club.code (takim) UZERINDEN kurulur -> isim
varyasyonu sorun degil, fuzzy-match GEREKMEZ. Veri euroleague.* semasina yazilir
(BSL'den TAMAMEN AYRI, bb_* model/analytics'e GIRMEZ). Idempotent upsert
(competition, season_code, game_code, person_code/team_code) -> duplicate OLMAZ.

Kaynak ACIK API: geo/proxy/tarayici gerekmez; lokalden bile calisir (tarayici User-Agent'i sart,
urllib'in varsayilani 403 alir). Cloudflare arkasinda: kenar onbellegi ~60 sn (her istege _cb
parametresi eklenir) ve HIZ SINIRI var (yogun istekte 429 "Error 1015" + Retry-After, ~4 dk blok).
429/403 gelince o tur API'ye baska istek atilmaz (RateLimited); toplu elle yuklemede --sleep 1 kullan.
API:
  GET /v2/competitions/{E|U}/seasons/{E2025|U2025}/games         -> mac listesi (meta)
  GET /v2/competitions/{E|U}/seasons/{code}/games/{gc}           -> tek mac meta
  GET /v2/competitions/{E|U}/seasons/{code}/games/{gc}/stats     -> {local,road}: players+total

Zaman: game_date GERCEK UTC. meta 'utcDate' ('...Z') esas; yoksa meta 'date' Madrid duvar saatidir
(CET/CEST) ve UTC'ye cevrilir. (Eskiden 'date' UTC diye yaziliyordu: saatler +1/+2 kaymisti.)

OTOMATIK AKIS (--auto; VPS cron her 10 dk, deploy/run_euro_match_scrape.sh). BSL fetch_flashscore_bsl.py kalibi:
  - sezon identity.current_season_label() (sinir 1 Temmuz) -> E2026 / U2026, elle id yok
  - --sync-schedule (gunde 4 tur): API programi ile euroleague.games/teams farki; yalniz yeni/degisen
    satir yazilir, tarih degisimi stats satirlarina da yayilir, oynanmamis + statsiz bayat mac/takim silinir
  - yukleme adaylari DB'den secilir (sessiz tur = 0 HTTP): tip-off + EL_MIN_AGE_H gecmis, EL_MAX_AGE_D
    icinde, team_match_stats satiri olmayan maclar
  - duzeltme turu: tip-off + EL_SETTLE_H sonra box bir kez daha cekilir; resmi duzeltme varsa yazilir,
    yoksa yalniz updated_at dokunulur (bir daha cekilmez)
  - ag/API hatasi "[el] HATA: ...; sonraki turda tekrar denenecek" basar, rc 0 kalir (BSL gibi)

Kullanim:
  python fetch_euroleague.py --auto [--sync-schedule] [--dry-run]                                # cron
  python fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026 --dry-run --game 47
  python fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026          # tum sezon
  python fetch_euroleague.py --competition U --season-code U2025 --season-label 2025-2026          # EuroCup
  python fetch_euroleague.py --competition E --season-code E2025 --season-label 2025-2026 --schedule  # program esitle
Env (--auto): EL_MIN_AGE_H (vars. 2.5), EL_MAX_AGE_D (14), EL_SETTLE_H (20), EL_RUN_INTERVAL_MIN (10).
"""
import argparse
import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import psycopg2
from dotenv import load_dotenv

from identity import current_season_label

API = "https://api-live.euroleague.net/v2/competitions"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
MADRID = ZoneInfo("Europe/Madrid")
PACE_S = 0.15          # istekler arasi en az (sn)
WINDOW_MV = "analytics.el_player_metric_window_v1"
# gecici ag/API arizalari: --auto'da HATA satiri basilir, sonraki tur telafi eder
NET_ERRORS = (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError,
              http.client.IncompleteRead)

_last_get = 0.0


class RateLimited(Exception):
    """Cloudflare hiz siniri (429) ya da erisim engeli (403): bu tur API'ye baska istek atilmaz."""

    def __init__(self, code, retry_after):
        super().__init__(f"HTTP {code}, Retry-After {retry_after}")
        self.code, self.retry_after = code, retry_after


def api_get(url: str):
    """GET + JSON. Bos govde (204: boyle bir mac yok) -> None. 429/403 -> RateLimited."""
    global _last_get
    wait = PACE_S - (time.monotonic() - _last_get)
    if wait > 0:
        time.sleep(wait)
    url += ("&" if "?" in url else "?") + f"_cb={int(time.time())}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            raise RateLimited(e.code, e.headers.get("Retry-After") if e.headers else None) from e
        raise
    finally:
        _last_get = time.monotonic()
    return json.loads(body) if body.strip() else None


def i(x):
    return int(round(x)) if isinstance(x, (int, float)) else None


def to_date(s):
    """Takvim tarihi (dogum tarihi gibi saatsiz alanlar)."""
    return (s or "")[:19] or None


def to_utc(meta: dict):
    """Tip-off -> tz'li GERCEK UTC. utcDate ('...Z') esas; yoksa 'date' Madrid duvar saati (CET/CEST)."""
    s = meta.get("utcDate")
    if s:
        return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    s = meta.get("date")
    if s:
        return (datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
                .replace(tzinfo=MADRID).astimezone(timezone.utc))
    return None


def season_of(comp: str, today=None):
    """Guncel sezon (etiket, kod): sinir 1 Temmuz (identity.current_season_label) -> E2026 / U2026."""
    label = current_season_label(today)
    return label, f"{comp}{label[:4]}"


# stats alt-objesi -> db kolonlari
def stat_cols(s: dict) -> dict:
    sec = s.get("timePlayed")
    return {
        "seconds_played": i(sec),
        "minutes": round(sec / 60, 2) if isinstance(sec, (int, float)) else None,
        "points": i(s.get("points")),
        "fg2m": i(s.get("fieldGoalsMade2")), "fg2a": i(s.get("fieldGoalsAttempted2")),
        "fg3m": i(s.get("fieldGoalsMade3")), "fg3a": i(s.get("fieldGoalsAttempted3")),
        "ftm": i(s.get("freeThrowsMade")), "fta": i(s.get("freeThrowsAttempted")),
        "oreb": i(s.get("offensiveRebounds")), "dreb": i(s.get("defensiveRebounds")),
        "treb": i(s.get("totalRebounds")),
        "assists": i(s.get("assistances")), "steals": i(s.get("steals")),
        "turnovers": i(s.get("turnovers")),
        "blocks": i(s.get("blocksFavour")), "blocks_against": i(s.get("blocksAgainst")),
        "fouls_committed": i(s.get("foulsCommited")), "fouls_drawn": i(s.get("foulsReceived")),
        "valuation": i(s.get("valuation")), "plus_minus": i(s.get("plusMinus")),
    }


def team_stat_cols(t: dict) -> dict:
    c = stat_cols(t)
    for k in ("seconds_played", "minutes", "plus_minus"):
        c.pop(k, None)
    return c


def _team_dim(club, comp, scode, slabel):
    return {"competition": comp, "season_code": scode, "season_label": slabel,
            "team_code": club["code"], "team_name": club.get("name"),
            "abbr_name": club.get("abbreviatedName"), "editorial_name": club.get("editorialName"),
            "crest_url": (club.get("images") or {}).get("crest")}


def schedule_rows(meta: dict, comp: str, scode: str, slabel: str):
    """Program (fikstur) satiri: meta'dan game_row + team_dims (stats CAGRISI YOK).

    Oynanmamis maclarda skor NULL; oynanmislarda meta'daki score kullanilir.
    """
    home = meta["local"]["club"]
    away = meta["road"]["club"]
    played = bool(meta.get("played"))

    def score(side):
        return i(meta.get(side, {}).get("score")) if played else None

    game_row = {
        "competition": comp, "season_code": scode, "season_label": slabel,
        "game_code": meta["gameCode"], "identifier": meta.get("identifier"),
        "round": meta.get("round"), "phase_code": (meta.get("phaseType") or {}).get("code"),
        "phase_name": (meta.get("phaseType") or {}).get("name"),
        "game_date": to_utc(meta), "played": played,
        "home_team_code": home["code"], "home_team_name": home.get("name"),
        "away_team_code": away["code"], "away_team_name": away.get("name"),
        "home_score": score("local"), "away_score": score("road"),
    }
    return game_row, [_team_dim(home, comp, scode, slabel), _team_dim(away, comp, scode, slabel)]


def normalize(meta: dict, stats: dict, comp: str, scode: str, slabel: str):
    gc = meta["gameCode"]
    home = meta["local"]["club"]
    away = meta["road"]["club"]
    rnd = meta.get("round")
    phase = (meta.get("phaseType") or {}).get("code")
    gdate = to_utc(meta)
    hs = i((stats["local"]["total"] or {}).get("points"))
    as_ = i((stats["road"]["total"] or {}).get("points"))

    def crest(club):
        return (club.get("images") or {}).get("crest")

    team_dims = [
        {"competition": comp, "season_code": scode, "season_label": slabel,
         "team_code": home["code"], "team_name": home.get("name"), "abbr_name": home.get("abbreviatedName"),
         "editorial_name": home.get("editorialName"), "crest_url": crest(home)},
        {"competition": comp, "season_code": scode, "season_label": slabel,
         "team_code": away["code"], "team_name": away.get("name"), "abbr_name": away.get("abbreviatedName"),
         "editorial_name": away.get("editorialName"), "crest_url": crest(away)},
    ]
    game_row = {
        "competition": comp, "season_code": scode, "season_label": slabel, "game_code": gc,
        "identifier": meta.get("identifier"), "round": rnd,
        "phase_code": phase, "phase_name": (meta.get("phaseType") or {}).get("name"),
        "game_date": gdate, "played": meta.get("played"),
        "home_team_code": home["code"], "home_team_name": home.get("name"),
        "away_team_code": away["code"], "away_team_name": away.get("name"),
        "home_score": hs, "away_score": as_,
    }

    def base(team, opp, ha):
        return {"competition": comp, "season_code": scode, "season_label": slabel, "game_code": gc,
                "round": rnd, "phase_code": phase, "game_date": gdate,
                "team_code": team["code"], "team_name": team.get("name"), "home_away": ha,
                "opponent_code": opp["code"], "opponent_name": opp.get("name")}

    team_rows = []
    for side, team, opp, ha, tot, pts, opp_pts in [
        ("local", home, away, "Home", stats["local"]["total"], hs, as_),
        ("road", away, home, "Away", stats["road"]["total"], as_, hs),
    ]:
        r = base(team, opp, ha)
        r.update({"points": pts, "opp_points": opp_pts})
        r.update(team_stat_cols(tot or {}))
        team_rows.append(r)

    player_rows, player_dims = [], []
    for side, team, opp, ha in [("local", home, away, "Home"), ("road", away, home, "Away")]:
        for pl in stats[side]["players"] or []:
            s = pl.get("stats")
            if not s or not s.get("timePlayed"):
                continue  # oynamadi (DNP) -> atla
            per = pl["player"]["person"]
            pcode = per.get("code")
            if not pcode:
                continue
            pdim = {
                "competition": comp, "season_code": scode, "season_label": slabel, "person_code": pcode,
                "name": per.get("name"), "passport_name": per.get("passportName"),
                "passport_surname": per.get("passportSurname"),
                "country_code": (per.get("country") or {}).get("code"),
                "birth_date": to_date(per.get("birthDate")), "height": per.get("height"),
                "position_name": pl["player"].get("positionName"),
                "team_code": team["code"], "team_name": team.get("name"),
                "dorsal": str(pl["player"].get("dorsal") or "") or None,
                "image_url": (pl["player"].get("images") or {}).get("headshot"),
                "external_id": pl["player"].get("externalId"),
            }
            player_dims.append(pdim)
            row = base(team, opp, ha)
            row.update({
                "person_code": pcode, "player_name": per.get("name"),
                "identifier": meta.get("identifier"),
                "dorsal": pdim["dorsal"], "is_starter": bool(s.get("startFive")),
            })
            row.update(stat_cols(s))
            player_rows.append(row)
    return game_row, team_dims, team_rows, player_dims, player_rows


def box_ready(stats):
    """(hazir mi, sure almis oyuncu sayisi). Hazir = iki tarafin toplami var + en az 10 oyuncu."""
    if not isinstance(stats, dict):
        return False, 0
    n, totals = 0, True
    for side in ("local", "road"):
        s = stats.get(side) or {}
        totals = totals and bool(s.get("total"))
        n += sum(1 for p in s.get("players") or []
                 if (p.get("stats") or {}).get("timePlayed")
                 and ((p.get("player") or {}).get("person") or {}).get("code"))
    return totals and n >= 10, n


def game_label(gr):
    return (f"R{gr['round']} {gr['home_team_name']} {gr['home_score']}-{gr['away_score']} "
            f"{gr['away_team_name']}")


# ---------------- upsert ----------------
def _upsert(cur, table, cols, rows, conflict, updatable):
    if not rows:
        return
    setexpr = ", ".join(f"{c}=excluded.{c}" for c in updatable)
    ph = ",".join(["%s"] * len(cols))
    sql = (f"insert into {table} ({','.join(cols)}) values ({ph}) "
           f"on conflict ({conflict}) do update set {setexpr}, updated_at=now()")
    for r in rows:
        cur.execute(sql, [r.get(c) for c in cols])


TEAM_DIM_COLS = ["competition", "season_code", "season_label", "team_code", "team_name",
                 "abbr_name", "editorial_name", "crest_url"]
PLAYER_DIM_COLS = ["competition", "season_code", "season_label", "person_code", "name",
                   "passport_name", "passport_surname", "country_code", "birth_date", "height",
                   "position_name", "team_code", "team_name", "dorsal", "image_url", "external_id"]
GAME_COLS = ["competition", "season_code", "season_label", "game_code", "identifier", "round",
             "phase_code", "phase_name", "game_date", "played", "home_team_code", "home_team_name",
             "away_team_code", "away_team_name", "home_score", "away_score"]
TMS_COLS = ["competition", "season_code", "season_label", "game_code", "round", "phase_code",
            "game_date", "team_code", "team_name", "home_away", "opponent_code", "opponent_name",
            "points", "opp_points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
            "treb", "assists", "steals", "turnovers", "blocks", "blocks_against",
            "fouls_committed", "fouls_drawn", "valuation"]
PMS_COLS = ["competition", "season_code", "season_label", "game_code", "identifier", "round",
            "phase_code", "game_date", "person_code", "player_name", "team_code", "team_name",
            "home_away", "opponent_code", "opponent_name", "dorsal", "is_starter",
            "seconds_played", "minutes", "points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta",
            "oreb", "dreb", "treb", "assists", "steals", "turnovers", "blocks", "blocks_against",
            "fouls_committed", "fouls_drawn", "valuation", "plus_minus"]


def upsert_teams(cur, rows):
    _upsert(cur, "euroleague.teams", TEAM_DIM_COLS, rows, "competition,season_code,team_code",
            [c for c in TEAM_DIM_COLS if c not in ("competition", "season_code", "team_code")])


def upsert_games(cur, rows):
    _upsert(cur, "euroleague.games", GAME_COLS, rows, "competition,season_code,game_code",
            [c for c in GAME_COLS if c not in ("competition", "season_code", "game_code")])


def write_game(cur, gr, tdims, trows, pdims, prows):
    upsert_teams(cur, tdims)
    _upsert(cur, "euroleague.players", PLAYER_DIM_COLS, pdims, "competition,season_code,person_code",
            [c for c in PLAYER_DIM_COLS if c not in ("competition", "season_code", "person_code")])
    upsert_games(cur, [gr])
    _upsert(cur, "euroleague.team_match_stats", TMS_COLS, trows,
            "competition,season_code,game_code,team_code",
            [c for c in TMS_COLS if c not in ("competition", "season_code", "game_code", "team_code")])
    _upsert(cur, "euroleague.player_match_stats", PMS_COLS, prows,
            "competition,season_code,game_code,person_code",
            [c for c in PMS_COLS if c not in ("competition", "season_code", "game_code", "person_code")])


def propagate_date(cur, comp, scode, gc, game_date):
    """Mac saati degisti: stats satirlarinin game_date'i de izlesin. updated_at'e DOKUNMAZ
    (duzeltme turu team_match_stats.updated_at'i 'son box cekimi' olarak kullanir)."""
    for table in ("euroleague.player_match_stats", "euroleague.team_match_stats"):
        cur.execute(f"update {table} set game_date=%s where competition=%s and season_code=%s "
                    f"and game_code=%s and game_date is distinct from %s",
                    (game_date, comp, scode, gc, game_date))


def propagate_team_name(cur, comp, scode, team_code, name):
    """Kulup-sezon adi degisti (ULK -> 'Fenerbahce Tarfin Istanbul'): stats satirlarindaki takim/rakip
    adi da izlesin; yoksa ada gore gruplayan view'lar (el_team_metric_form_v1) takimi ikiye boler.
    updated_at'e DOKUNMAZ (propagate_date ile ayni sebep)."""
    for table in ("euroleague.player_match_stats", "euroleague.team_match_stats"):
        for code_col, name_col in (("team_code", "team_name"), ("opponent_code", "opponent_name")):
            cur.execute(f"update {table} set {name_col}=%s where competition=%s and season_code=%s "
                        f"and {code_col}=%s and {name_col} is distinct from %s",
                        (name, comp, scode, team_code, name))


def _select(cur, table, cols, comp, scode, extra="", params=()):
    cur.execute(f"select {','.join(cols)} from {table} where competition=%s and season_code=%s{extra}",
                (comp, scode, *params))
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# ---------------- karsilastirma / secim (saf) ----------------
def _norm(v):
    """DB (Decimal, tz'li datetime) ile API satirini (float, UTC datetime) karsilastirilabilir yap."""
    if isinstance(v, Decimal):
        v = float(v)
    if isinstance(v, float):
        return round(v, 2)
    if isinstance(v, datetime) and v.tzinfo:
        return v.astimezone(timezone.utc)
    return v


def changed_cols(new: dict, old: dict, cols):
    return [c for c in cols if _norm(new.get(c)) != _norm(old.get(c))]


def schedule_diff(api_games, db_games, api_teams, db_teams, stat_games, stat_teams):
    """API programi ile DB farki. api_/db_games: {game_code: satir}, api_/db_teams: {team_code: satir},
    stat_games: stats satiri olan game_code'lar, stat_teams: team_match_stats'i olan team_code'lar.

    Silinir: API'de olmayan, oynanmamis ve stats satiri olmayan mac; hic bir API macinda gecmeyen
    ve team_match_stats'i olmayan takim. moved: stats'i olan ve saati degisen maclar (yayilacak)."""
    new = [gc for gc in api_games if gc not in db_games]
    changed = [gc for gc in api_games
               if gc in db_games and changed_cols(api_games[gc], db_games[gc], GAME_COLS)]
    moved = {gc: api_games[gc]["game_date"] for gc in changed
             if gc in stat_games
             and _norm(api_games[gc]["game_date"]) != _norm(db_games[gc]["game_date"])}
    delete = [gc for gc, g in db_games.items()
              if gc not in api_games and not g.get("played") and gc not in stat_games]
    team_new = [tc for tc in api_teams if tc not in db_teams]
    team_changed = [tc for tc in api_teams
                    if tc in db_teams and changed_cols(api_teams[tc], db_teams[tc], TEAM_DIM_COLS)]
    team_delete = [tc for tc in db_teams if tc not in api_teams and tc not in stat_teams]
    return {"new": new, "changed": changed, "moved": moved, "delete": delete,
            "team_new": team_new, "team_changed": team_changed, "team_delete": team_delete}


def select_due(rows, now, min_age_h, max_age_d):
    """Yuklenecek maclar: tip-off + min_age gecmis, max_age'den yeni, henuz team_match_stats'i yok.
    rows: [{game_code, game_date, stats_updated_at}] (stats_updated_at None = yuklu degil)."""
    lo, hi = now - timedelta(days=max_age_d), now - timedelta(hours=min_age_h)
    return sorted((r for r in rows if r["stats_updated_at"] is None and r["game_date"]
                   and lo <= r["game_date"] <= hi), key=lambda r: r["game_date"])


def select_settle(rows, now, max_age_d, settle_h):
    """Duzeltme turu adaylari: yuklu, tip-off + settle_h gecmis, max_age icinde ve son box yazimi
    tip-off + settle_h'den ONCE (yani duzeltme kontrolu henuz yapilmamis)."""
    lo, hi = now - timedelta(days=max_age_d), now - timedelta(hours=settle_h)
    settle = timedelta(hours=settle_h)
    return sorted((r for r in rows if r["stats_updated_at"] is not None and r["game_date"]
                   and lo <= r["game_date"] <= hi and r["stats_updated_at"] < r["game_date"] + settle),
                  key=lambda r: r["game_date"])


def stats_diff(db_players, db_teams, new_players, new_teams):
    """Resmi duzeltme karsilastirmasi. Oyuncu satirlari person_code, takim satirlari team_code
    anahtarli, tum PMS/TMS kolonlari. Donus: (degisen satir sayisi, box'tan dusen person_code'lar)."""
    old_p = {r["person_code"]: r for r in db_players}
    old_t = {r["team_code"]: r for r in db_teams}
    new_p = {r["person_code"]: r for r in new_players}
    n = sum(1 for pc, r in new_p.items() if pc not in old_p or changed_cols(r, old_p[pc], PMS_COLS))
    n += sum(1 for r in new_teams
             if r["team_code"] not in old_t or changed_cols(r, old_t[r["team_code"]], TMS_COLS))
    removed = sorted(pc for pc in old_p if pc not in new_p)
    return n + len(removed), removed


def once_at(age, hours, interval_min):
    """Tip-off + `hours`'u iceren TEK cron turunda True (turlar interval_min arayla): ayni durum
    her 10 dk'da loglanmasin, yine de bir kez gorunsun."""
    at = timedelta(hours=hours)
    return at <= age < at + timedelta(minutes=interval_min)


def waiting_log_due(age, interval_min):
    """'API hala oynanmadi' satiri tip-off + 6 saatte TEK tur basilsin (her 10 dk'da degil)."""
    return once_at(age, 6, interval_min)


STUCK_H = 24   # tip-off'tan bu kadar sonra hala yuklenemeyen mac TEK kez HATA satiri basar (digest gorur)


# ---------------- program senkronu ----------------
def sync_schedule(conn, comp, scode, slabel, games, dry_run):
    """API mac listesi -> euroleague.games/teams. Yalniz yeni/degisen satir yazilir; saati degisen
    macin stats satirlari da guncellenir; bayat (oynanmamis + statsiz) mac/takim silinir.
    Bir sey degistiyse tek ozet satiri basar. Donus: schedule_diff sozlugu + api_games."""
    api_games, api_teams = {}, {}
    for meta in games:
        gr, tdims = schedule_rows(meta, comp, scode, slabel)
        api_games[gr["game_code"]] = gr
        for t in tdims:
            api_teams[t["team_code"]] = t
    with conn.cursor() as cur:
        db_games = {r["game_code"]: r for r in _select(cur, "euroleague.games", GAME_COLS, comp, scode)}
        db_teams = {r["team_code"]: r for r in _select(cur, "euroleague.teams", TEAM_DIM_COLS, comp, scode)}
        cur.execute("select game_code from euroleague.team_match_stats where competition=%s and season_code=%s "
                    "union select game_code from euroleague.player_match_stats "
                    "where competition=%s and season_code=%s", (comp, scode, comp, scode))
        stat_games = {r[0] for r in cur.fetchall()}
        cur.execute("select distinct team_code from euroleague.team_match_stats "
                    "where competition=%s and season_code=%s", (comp, scode))
        stat_teams = {r[0] for r in cur.fetchall()}
    if not api_games:  # bos liste: asla toplu silme yapma
        return {"new": [], "changed": [], "moved": {}, "delete": [], "team_new": [],
                "team_changed": [], "team_delete": [], "api_games": api_games}
    d = schedule_diff(api_games, db_games, api_teams, db_teams, stat_games, stat_teams)

    if not dry_run:
        with conn.cursor() as cur:
            upsert_teams(cur, [api_teams[tc] for tc in d["team_new"] + d["team_changed"]])
            for tc in d["team_changed"]:
                if _norm(api_teams[tc]["team_name"]) != _norm(db_teams[tc]["team_name"]):
                    propagate_team_name(cur, comp, scode, tc, api_teams[tc]["team_name"])
            upsert_games(cur, [api_games[gc] for gc in d["new"] + d["changed"]])
            for gc, gdate in d["moved"].items():
                propagate_date(cur, comp, scode, gc, gdate)
            if d["delete"]:
                cur.execute("""delete from euroleague.games g
                    where g.competition=%s and g.season_code=%s and g.game_code = any(%s)
                      and not coalesce(g.played, false)
                      and not exists (select 1 from euroleague.team_match_stats t where t.competition=g.competition
                                      and t.season_code=g.season_code and t.game_code=g.game_code)
                      and not exists (select 1 from euroleague.player_match_stats p where p.competition=g.competition
                                      and p.season_code=g.season_code and p.game_code=g.game_code)""",
                            (comp, scode, d["delete"]))
            if d["team_delete"]:
                cur.execute("""delete from euroleague.teams tm
                    where tm.competition=%s and tm.season_code=%s and tm.team_code = any(%s)
                      and not exists (select 1 from euroleague.team_match_stats t where t.competition=tm.competition
                                      and t.season_code=tm.season_code and t.team_code=tm.team_code)""",
                            (comp, scode, d["team_delete"]))
        conn.commit()

    teams = " ".join(f"{k}={','.join(sorted(d[key]))}" for k, key in
                     (("degisen", "team_changed"), ("yeni", "team_new"), ("silinen", "team_delete")) if d[key])
    if d["changed"] or d["new"] or d["delete"] or teams:
        print(f"[el] {scode} program guncellendi: degisen={len(d['changed'])} yeni={len(d['new'])} "
              f"silinen={len(d['delete'])}" + (f" (takim: {teams})" if teams else "")
              + (" (DRY-RUN)" if dry_run else ""), flush=True)
        if dry_run:
            cols = Counter(c for gc in d["changed"] for c in changed_cols(api_games[gc], db_games[gc], GAME_COLS))
            print(f"[el]  {scode} kolon farklari: {dict(cols)}; saati degisen statli mac={len(d['moved'])}"
                  + (f"; silinecek mac={sorted(d['delete'])}" if d["delete"] else ""), flush=True)
    d["api_games"] = api_games
    return d


# ---------------- otomatik akis (--auto) ----------------
def game_state_rows(conn, comp, scode):
    """Sezonun maclari + son box yazimi (team_match_stats.updated_at maks; None = yuklu degil)."""
    with conn.cursor() as cur:
        cur.execute("""
            select g.game_code, g.game_date, t.last_upd
            from euroleague.games g
            left join (select game_code, max(updated_at) as last_upd from euroleague.team_match_stats
                       where competition=%s and season_code=%s group by game_code) t using (game_code)
            where g.competition=%s and g.season_code=%s""", (comp, scode, comp, scode))
        return [{"game_code": gc, "game_date": gd, "stats_updated_at": lu} for gc, gd, lu in cur.fetchall()]


def load_due(conn, comp, scode, slabel, row, now, min_age_h, interval_min, dry_run):
    """Vadesi gelmis mac: tek-mac meta -> oynandiysa box-score -> yaz. Donus 1 = yuklendi.

    Bekleme durumlari her turda degil TEK kez loglanir (once_at); tip-off + STUCK_H'de hala
    yuklenemeyen mac bir kez "[el] HATA:" basar (gunluk digest'e duser, sessizce pencereden cikmaz)."""
    gc = row["game_code"]
    meta = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}")
    if not meta:
        return 0  # API'de artik yok (204): program senkronu temizler
    tip = to_utc(meta)
    age = now - tip if tip else None
    home, away = meta["local"]["club"].get("name"), meta["road"]["club"].get("name")
    if not meta.get("played"):
        if tip and _norm(tip) != _norm(row["game_date"]) and not dry_run:
            gr, _ = schedule_rows(meta, comp, scode, slabel)  # ertelenmis/saati degismis: sessizce duzelt
            with conn.cursor() as cur:
                upsert_games(cur, [gr])
                propagate_date(cur, comp, scode, gc, gr["game_date"])
            conn.commit()
        if age is not None and waiting_log_due(age, interval_min):
            print(f"[el]  {scode} gc {gc} {home}-{away}: API hala oynanmadi diyor, beklemede", flush=True)
        if age is not None and once_at(age, STUCK_H, interval_min):
            print(f"[el] HATA: {scode} gc {gc} {home}-{away}: tip-off'tan {STUCK_H} saat sonra API hala "
                  f"oynanmadi diyor (elle kontrol et)", flush=True)
        return 0
    stats = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}/stats")
    ok, n = box_ready(stats)
    if not ok:
        gr, _ = schedule_rows(meta, comp, scode, slabel)
        if age is not None and once_at(age, min_age_h, interval_min):
            print(f"[el]  {scode} gc {gc} {game_label(gr)}: box-score eksik ({n}), beklemede", flush=True)
        if age is not None and once_at(age, STUCK_H, interval_min):
            print(f"[el] HATA: {scode} gc {gc} {game_label(gr)}: tip-off'tan {STUCK_H} saat sonra box-score "
                  f"hala eksik ({n} oyuncu; elle kontrol et)", flush=True)
        return 0
    gr, tdims, trows, pdims, prows = normalize(meta, stats, comp, scode, slabel)
    if dry_run:
        print(f"[el]  {scode} gc {gc} {game_label(gr)} yuklenecek ({len(prows)} oyuncu, "
              f"tip-off {gr['game_date']:%Y-%m-%d %H:%M} UTC)", flush=True)
        return 1
    with conn.cursor() as cur:
        write_game(cur, gr, tdims, trows, pdims, prows)
    conn.commit()
    print(f"[el]  {scode} gc {gc} {game_label(gr)} yuklendi ({len(prows)} oyuncu)", flush=True)
    return 1


def settle_game(conn, comp, scode, slabel, row, dry_run):
    """Duzeltme turu: box-score'u yeniden cek. Farkliysa yaz (+box'tan duseni sil), ayniysa yalniz
    team_match_stats.updated_at'i dokun (bir daha cekilmez). Donus 1 = duzeltildi."""
    gc = row["game_code"]
    meta = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}")
    if not meta:
        return 0
    stats = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}/stats")
    if not box_ready(stats)[0]:
        return 0  # box gecici bos/eksik: dokunma, sonraki tur yeniden dener
    gr, tdims, trows, pdims, prows = normalize(meta, stats, comp, scode, slabel)
    with conn.cursor() as cur:
        db_p = _select(cur, "euroleague.player_match_stats", PMS_COLS, comp, scode, " and game_code=%s", (gc,))
        db_t = _select(cur, "euroleague.team_match_stats", TMS_COLS, comp, scode, " and game_code=%s", (gc,))
    k, removed = stats_diff(db_p, db_t, prows, trows)
    if dry_run:
        if k:
            print(f"[el]  {scode} gc {gc} {game_label(gr)} duzeltilecek ({k} satir degisecek)", flush=True)
        return 1 if k else 0
    with conn.cursor() as cur:
        if k:
            write_game(cur, gr, tdims, trows, pdims, prows)
            if removed:
                cur.execute("delete from euroleague.player_match_stats where competition=%s and season_code=%s "
                            "and game_code=%s and person_code = any(%s)", (comp, scode, gc, removed))
        else:
            cur.execute("update euroleague.team_match_stats set updated_at=now() "
                        "where competition=%s and season_code=%s and game_code=%s", (comp, scode, gc))
    conn.commit()
    if k:
        print(f"[el]  {scode} gc {gc} {game_label(gr)} duzeltildi ({k} satir degisti)", flush=True)
    return 1 if k else 0


def refresh_window(conn):
    """Tools window matview'i (EL/EC Match-Player Tools) tazele. CONCURRENTLY: okuyucu kilitlenmez
    (unique index ux_el_player_window var). PG belgesi CONCURRENTLY refresh icin transaction yasagi
    koymuyor (CREATE INDEX CONCURRENTLY'nin aksine); yine de repo kalibi (refresh_orchestrator) gibi
    autocommit'te kosar.

    Donus True = tazelendi. Basarisizsa "[el] HATA: ... refresh basarisiz" basar ve False doner:
    cagiran rc=2 ile cikar (wrapper anlik ntfy atar); log_triage bu satiri KRITIK sayar."""
    try:
        if conn.closed:
            raise psycopg2.InterfaceError("baglanti kapali")
        conn.rollback()   # yarim kalmis islem varsa (yukleme sirasinda hata) temizle
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(f"refresh materialized view concurrently {WINDOW_MV}")
        print(f"[el] tools window matview tazelendi ({WINDOW_MV})", flush=True)
        return True
    except psycopg2.Error:
        # baglanti kopmus olabilir: taze baglantiyla bir kez daha dene
        try:
            with psycopg2.connect(os.environ["DATABASE_URL"]) as c2:
                c2.autocommit = True
                with c2.cursor() as cur:
                    cur.execute(f"refresh materialized view concurrently {WINDOW_MV}")
            print(f"[el] tools window matview tazelendi ({WINDOW_MV}, yeni baglanti)", flush=True)
            return True
        except psycopg2.Error as e:
            print(f"[el] HATA: el_player_metric_window_v1 refresh basarisiz ({e!r}); elle: "
                  f"refresh materialized view concurrently {WINDOW_MV}", flush=True)
            return False
    finally:
        if not conn.closed:
            conn.autocommit = False


def refresh_owed(conn, slabel, hours=26):
    """Son `hours` saatte bu sezonun oyuncu satirlari degistiyse True. Senkron turlarinda (6 saatte
    bir) matview'i telafi amacli tazelemek icin: onceki bir refresh basarisiz olduysa ya da yukleme
    sonrasi tur coktuyse Tools en gec 6 saat bayat kalir."""
    with conn.cursor() as cur:
        cur.execute("select exists (select 1 from euroleague.player_match_stats "
                    "where season_label=%s and updated_at > now() - make_interval(hours => %s))",
                    (slabel, hours))
        owed = cur.fetchone()[0]
    conn.rollback()
    return owed


def run_auto(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    min_age_h = float(os.environ.get("EL_MIN_AGE_H", "2.5"))
    max_age_d = float(os.environ.get("EL_MAX_AGE_D", "14"))
    settle_h = float(os.environ.get("EL_SETTLE_H", "20"))
    interval_min = float(os.environ.get("EL_RUN_INTERVAL_MIN", "10"))
    now = datetime.now(timezone.utc)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])  # dry-run'da da okunur (yazilmaz)
    if args.dry_run:
        conn.set_session(readonly=True)  # guvenlik: dry-run hicbir sey yazamaz
    loaded = corrected = 0
    owed = False
    rc = 0
    try:
        for comp in [c.strip().upper() for c in args.competitions.split(",") if c.strip()]:
            slabel, scode = season_of(comp)
            sync = None
            if args.sync_schedule:
                try:
                    games = api_get(f"{API}/{comp}/seasons/{scode}/games")
                except urllib.error.HTTPError as e:
                    if e.code != 404:
                        print(f"[el] HATA: {scode} program cekilemedi ({e!r}); sonraki turda tekrar denenecek",
                              flush=True)
                        continue
                    games = None
                except NET_ERRORS as e:
                    print(f"[el] HATA: {scode} program cekilemedi ({e!r}); sonraki turda tekrar denenecek",
                          flush=True)
                    continue
                data = (games or {}).get("data") or []
                if not data:  # yeni sezon henuz yayinlanmadi (Temmuz devri): hata degil
                    print(f"[el] {scode}: sezon programi henuz yayinlanmadi", flush=True)
                    continue
                sync = sync_schedule(conn, comp, scode, slabel, data, args.dry_run)
                owed = owed or (not args.dry_run and refresh_owed(conn, slabel))

            rows = game_state_rows(conn, comp, scode)
            if args.dry_run and sync:
                # dry-run programi DB'ye yazmadi: secim, fark uygulanmis gibi yapilsin
                api = sync["api_games"]
                known = {r["game_code"] for r in rows}
                rows = [dict(r, game_date=api[r["game_code"]]["game_date"]) if r["game_code"] in api else r
                        for r in rows if r["game_code"] not in sync["delete"]]
                rows += [{"game_code": gc, "game_date": g["game_date"], "stats_updated_at": None}
                         for gc, g in api.items() if gc not in known]
            due = select_due(rows, now, min_age_h, max_age_d)
            settle = select_settle(rows, now, max_age_d, settle_h)
            if due or settle:
                print(f"[el] {scode}: aday yukleme={len(due)} duzeltme={len(settle)}", flush=True)
            for r in due:
                try:
                    loaded += load_due(conn, comp, scode, slabel, r, now, min_age_h, interval_min, args.dry_run)
                except NET_ERRORS as e:
                    print(f"[el] HATA: {scode} gc {r['game_code']} cekilemedi ({e!r}); "
                          f"sonraki turda tekrar denenecek", flush=True)
            for r in settle:
                try:
                    corrected += settle_game(conn, comp, scode, slabel, r, args.dry_run)
                except NET_ERRORS as e:
                    print(f"[el] HATA: {scode} gc {r['game_code']} duzeltme kontrolu cekilemedi ({e!r}); "
                          f"sonraki turda tekrar denenecek", flush=True)
    except RateLimited as e:
        # Cloudflare blogu: bu tur API'ye baska istek atma (her mac icin ayri HATA basmasin)
        print(f"[el] HATA: API hiz siniri/engel ({e}); bu tur durduruldu, sonraki turda tekrar denenecek",
              flush=True)
    finally:
        # yuklenen mac varsa (tur sonradan coktuyse bile) Tools matview'i tazelenir; ayrica senkron
        # turunda son 26 saatte veri degistiyse telafi tazelemesi (onceki refresh basarisiz olduysa)
        if (loaded or corrected or owed) and not args.dry_run:
            if not refresh_window(conn):
                rc = 2
        if not conn.closed:
            conn.close()
    print(f"[el] BITTI: yuklenen={loaded} duzeltilen={corrected}" + (" (DRY-RUN)" if args.dry_run else ""),
          flush=True)
    return rc


# ---------------- elle modlar ----------------
def run(args):
    here = os.path.dirname(__file__)
    load_dotenv(os.path.join(here, "..", "..", ".env"))
    comp, scode, slabel = args.competition, args.season_code, args.season_label
    print(f"[el] competition={comp} season={scode} label={slabel} dry_run={args.dry_run}", flush=True)

    games = api_get(f"{API}/{comp}/seasons/{scode}/games")["data"]

    if args.schedule:
        # --auto ile AYNI senkron: yalniz yeni/degisen yazilir, saat duzeltmesi stats satirlarina yayilir.
        # Gecmis sezonun (E2025/U2025) eski Madrid saatleri bununla UTC'ye duzelir.
        print(f"[el] SCHEDULE modu: API'de {len(games)} mac (oynanmamis dahil)", flush=True)
        conn = psycopg2.connect(os.environ["DATABASE_URL"])  # dry-run'da yalniz okunur (fark hesabi)
        if args.dry_run:
            conn.set_session(readonly=True)
        d = sync_schedule(conn, comp, scode, slabel, games, args.dry_run)
        conn.close()
        print(f"[el] SCHEDULE BITTI: degisen={len(d['changed'])} yeni={len(d['new'])} "
              f"silinen={len(d['delete'])} ({'DRY-RUN' if args.dry_run else 'DB'}).", flush=True)
        return

    if args.game:
        metas = [g for g in games if g.get("gameCode") == args.game]
    else:
        metas = [g for g in games if g.get("played")]
        if args.phase:
            metas = [g for g in metas if (g.get("phaseType") or {}).get("code") == args.phase]
        if args.limit:
            metas = metas[:args.limit]
    print(f"[el] {len(metas)} mac islenecek", flush=True)

    conn = None if args.dry_run else psycopg2.connect(os.environ["DATABASE_URL"])
    n_games = n_players = 0
    for k, meta in enumerate(metas, 1):
        gc = meta["gameCode"]
        try:
            try:
                stats = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}/stats")
            except RateLimited as e:
                # toplu yuklemede Cloudflare blogu: Retry-After kadar bekle, bir kez daha dene
                wait = int(e.retry_after or 60) + 5
                print(f"[el]  mac {gc}: API hiz siniri ({e}), {wait} sn bekleniyor", flush=True)
                time.sleep(wait)
                stats = api_get(f"{API}/{comp}/seasons/{scode}/games/{gc}/stats")
        except Exception as e:
            print(f"[el]  mac {gc}: stats hata {e!r}, atlandi", flush=True)
            continue
        if not stats or "local" not in stats or not stats["local"].get("players"):
            print(f"[el]  mac {gc}: box yok, atlandi", flush=True)
            continue
        gr, tdims, trows, pdims, prows = normalize(meta, stats, comp, scode, slabel)
        n_games += 1
        n_players += len(prows)
        if args.dry_run:
            print(f"\n=== mac {gc} ({gr['identifier']}) R{gr['round']} {gr['phase_code']} "
                  f"{gr['home_team_name']} {gr['home_score']}-{gr['away_score']} {gr['away_team_name']} "
                  f"{gr['game_date']} ===", flush=True)
            print(f"  oyuncu: {len(prows)}", flush=True)
            for pr in prows[:3]:
                print(f"    [{pr['person_code']}] {pr['player_name']} ({pr['team_code']}) "
                      f"dk={pr['minutes']} sayi={pr['points']} rib={pr['treb']} as={pr['assists']} "
                      f"3s={pr['fg3m']}/{pr['fg3a']} val={pr['valuation']}", flush=True)
        else:
            with conn.cursor() as cur:
                write_game(cur, gr, tdims, trows, pdims, prows)
            conn.commit()
            if k % 20 == 0 or k == len(metas):
                print(f"[el]  {k}/{len(metas)} yuklendi", flush=True)
        time.sleep(args.sleep)
    # Oyuncu box-score yazildiysa tools window MATVIEW'i bayat kalir -> tazele.
    # (analytics.el_player_metric_window_v1 = matview; refresh EDILMEZSE EL/EC
    #  Match-Player Tools eski/eksik veriyle calisir. Bkz sql/2026-08-01_euroleague_window_matview.sql)
    if conn and n_players > 0:
        refresh_window(conn)
    if conn:
        conn.close()
    print(f"\n[el] BITTI: {n_games} mac, {n_players} oyuncu-satiri "
          f"({'DRY-RUN, DB yazilmadi' if args.dry_run else 'DB yazildi'}).", flush=True)


def main():
    ap = argparse.ArgumentParser(description="EuroLeague/EuroCup box-score ingestion")
    ap.add_argument("--auto", action="store_true",
                    help="cron modu: guncel sezon, vadesi gelen maclar + duzeltme turu (sezon argumani gerekmez)")
    ap.add_argument("--competitions", default="E,U", help="--auto: yarismalar (vars. E,U)")
    ap.add_argument("--sync-schedule", action="store_true",
                    help="--auto: once API programiyla euroleague.games/teams'i esitle")
    ap.add_argument("--competition", choices=["E", "U"], help="E=EuroLeague, U=EuroCup")
    ap.add_argument("--season-code", help="E2025 | U2025")
    ap.add_argument("--season-label", help="2025-2026")
    ap.add_argument("--phase", help="yalniz bu faz (RS/PO/FF)")
    ap.add_argument("--game", type=int, help="tek mac (gameCode) - test")
    ap.add_argument("--limit", type=int, help="ilk N mac - test")
    ap.add_argument("--schedule", action="store_true",
                    help="programi (oynanmamis dahil) API ile esitle: game_row+team, stats CEKME")
    ap.add_argument("--sleep", type=float, default=0.15, help="istekler arasi sn")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.auto:
        sys.exit(run_auto(args))
    elif not (args.competition and args.season_code and args.season_label):
        ap.error("--competition, --season-code ve --season-label gerekli (ya da --auto)")
    else:
        run(args)


if __name__ == "__main__":
    main()
