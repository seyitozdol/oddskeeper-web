"""TBF (tbf.org.tr) BSL basketbol maç + oyuncu box-score scraper'ı.

Kimlik TBF numerik id'leri ÜZERİNDEN kurulur (playerId / teamId / matchId):
isim varyasyonu ("Vincent Poirier" vs "Vincent Yann Poirier") sorun OLMAZ,
fuzzy-match GEREKMEZ. Veri basketball.player_match_stats + team_match_stats'a
(source='tbf_api') yazılır; oyuncu/takım boyutları tbf id'ye göre upsert edilir.

ERİŞİM (yalnız VPS'te çalışır):
  - Site TR-geo kısıtlı  → DataImpulse TR proxy (PROXY_ODDS_TR ya da PROXY_URL+__cr.tr).
  - Cloudflare JS challenge → curl_cffi YETMEZ; GERÇEK tarayıcı şart:
    xvfb-run + playwright headful chromium. Sayfa bir kez açılıp CF geçilir,
    sonra tüm API çağrıları sayfa-içi fetch() ile yapılır (CF cookie'siyle).

API (leagueId/ActivityId + seasonId sezona göre):
  GET /api/League/get-league-weeks?leagueId=&seasonId=
  GET /api/Match/get-all-matches-for-filter?ActivityId=&Page=1&PageSize=-1&WeekFilter=
  GET /api/Match/mac-header?matchId=
  GET /api/Match/mac-istatistik?matchId=    (homeTopFive/awayTopFive/bench/teamTotal)

Kullanım (VPS):
  xvfb-run -a /opt/oddskeeper/venv/bin/python src/basketball/fetch_tbf_bsl.py \
    --league-id 20728 --season-id 172 --season-label 2025-2026 --dry-run --match 303912
  # tüm sezon yükle:
  xvfb-run -a ... fetch_tbf_bsl.py --league-id 20728 --season-id 172 --season-label 2025-2026
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

BASE = "https://www.tbf.org.tr"
SOURCE = "tbf_api"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


# ----------------------------- yardımcılar -----------------------------
def slugify(name: str) -> str:
    """Türkçe → ascii, küçük harf, tireli. Futbol/basketbol slug konvansiyonu."""
    s = name or ""
    for a, b in [("İ", "i"), ("I", "i"), ("ı", "i"), ("Ş", "s"), ("ş", "s"),
                 ("Ğ", "g"), ("ğ", "g"), ("Ç", "c"), ("ç", "c"),
                 ("Ö", "o"), ("ö", "o"), ("Ü", "u"), ("ü", "u")]:
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def to_seconds(mmss: str):
    if not mmss:
        return None
    m = re.match(r"(\d+):(\d+)", mmss.strip())
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def parse_week(week_text: str):
    if not week_text:
        return None
    m = re.search(r"(\d+)", str(week_text))
    return int(m.group(1)) if m else None


def num(v):
    """'', None → None; sayıya çevrilebilirse int/float."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (ValueError, TypeError):
        return None


def build_proxy(env: dict):
    base = env.get("PROXY_ODDS_TR") or env.get("PROXY_URL")
    if not base:
        raise SystemExit("PROXY_ODDS_TR / PROXY_URL yok (.env). TBF TR-geo + CF için proxy şart.")
    m = re.match(r"http://([^:]+):([^@]+)@(.+)", base)
    if not m:
        raise SystemExit(f"Proxy formatı beklenmedik: {base[:30]}...")
    user, pw, host = m.groups()
    if "__cr.tr" not in user and "dataimpulse" in host:
        user = f"{user}__cr.tr;session-tbf{int(time.time())}"
    return {"server": f"http://{host}", "username": user, "password": pw}


# ----------------------------- TBF oturumu -----------------------------
class TbfSession:
    """Playwright headful + TR proxy; API çağrıları sayfa-içi fetch ile (CF cookie)."""

    def __init__(self, proxy, bootstrap_url):
        self.proxy = proxy
        self.bootstrap_url = bootstrap_url

    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self.br = self._pw.chromium.launch(
            headless=False, proxy=self.proxy,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        self.ctx = self.br.new_context(locale="tr-TR", timezone_id="Europe/Istanbul", user_agent=UA)
        self.pg = self.ctx.new_page()
        # GB tasarrufu: görsel/font/media indirme
        self.pg.route("**/*", lambda r: r.abort()
                      if r.request.resource_type in ("image", "font", "media") else r.continue_())
        self.pg.goto(self.bootstrap_url, wait_until="domcontentloaded", timeout=90000)
        # Cloudflare challenge geçene kadar bekle
        for _ in range(25):
            if "just a moment" not in (self.pg.title() or "").lower():
                break
            time.sleep(1.5)
        time.sleep(2)
        title = self.pg.title() or ""
        if "just a moment" in title.lower():
            raise SystemExit("Cloudflare geçilemedi (title hâlâ challenge). Proxy/UA kontrol et.")
        return self

    def __exit__(self, *a):
        try:
            self.br.close()
        finally:
            self._pw.stop()

    def api(self, path: str):
        js = """async (u) => {
            const r = await fetch(u, {headers:{accept:'application/json'}});
            let body=null; try{ body=await r.json(); }catch(e){ body=null; }
            return {status:r.status, body};
        }"""
        res = self.pg.evaluate(js, BASE + path)
        if res["status"] != 200 or not res["body"]:
            return None
        return res["body"].get("data")


# ----------------------------- normalizasyon -----------------------------
STAT_MAP = {
    # box-score alanı -> (db kolonu)
    "points": "points",
    "twoPointShots": "fg2m", "twoPointShotAttempts": "fg2a",
    "threePointShots": "fg3m", "threePointShotAttempts": "fg3a",
    "freeThrows": "ftm", "freeThrowAttempts": "fta",
    "offensiveRebounds": "oreb", "defensiveRebounds": "dreb", "totalRebounds": "treb",
    "assists": "assists", "turnovers": "turnovers", "steals": "steals",
    "blocks": "blocks", "blocksReceived": "blocks_against",
    "rivalFoul": "fouls_drawn", "fouls": "fouls_committed",
}


def _pct(make, att):
    if make is None or att in (None, 0):
        return None
    return round(make / att * 100, 1)


def _stat_cols(obj: dict) -> dict:
    out = {db: num(obj.get(src)) for src, db in STAT_MAP.items()}
    out["fg2_pct"] = _pct(out["fg2m"], out["fg2a"])
    out["fg3_pct"] = _pct(out["fg3m"], out["fg3a"])
    out["ft_pct"] = _pct(out["ftm"], out["fta"])
    secs = to_seconds(obj.get("minutesPlayed"))
    out["seconds_played"] = secs
    out["minutes"] = round(secs / 60, 2) if secs is not None else None
    return out


def normalize_match(header: dict, box: dict, meta: dict):
    """(team_rows, player_rows) döndürür — hepsi tbf id anahtarlı."""
    ht, at = header["homeTeam"], header["awayTeam"]
    home = {"id": ht["teamId"], "name": ht["teamName"], "logo": ht.get("logo")}
    away = {"id": at["teamId"], "name": at["teamName"], "logo": at.get("logo")}
    match_id = meta["match_id"]
    match_key = f"{home['name']} - {away['name']}"
    match_date = (header.get("matchDateTime") or meta.get("match_date") or "")[:10] or None
    week = parse_week(meta.get("week"))
    comp = meta.get("competition") or header.get("faaliyetAdi")
    hs, as_ = num(header.get("homeTeamScore")), num(header.get("awayTeamScore"))

    def team_row(side, team, opp, total, pts, opp_pts):
        base = {
            "source": SOURCE, "season_label": meta["season_label"], "competition": comp,
            "match_key": match_key, "match_date": match_date, "week": week,
            "team_slug": slugify(team["name"]), "team_name": team["name"],
            "home_away": side, "opponent_slug": slugify(opp["name"]), "opponent_name": opp["name"],
            "points": pts, "opp_points": opp_pts,
            "tbf_team_id": team["id"], "tbf_match_id": match_id,
        }
        base.update(_stat_cols(total or {}))
        base.pop("minutes", None); base.pop("seconds_played", None)  # takımda yok
        return base

    team_rows = [
        team_row("Home", home, away, box.get("homeTeamTotal"), hs, as_),
        team_row("Away", away, home, box.get("awayTeamTotal"), as_, hs),
    ]

    player_rows = []
    for key, team, opp, is_home in [
        ("homeTopFive", home, away, True), ("homeBenchPlayers", home, away, True),
        ("awayTopFive", away, home, False), ("awayBenchPlayers", away, home, False),
    ]:
        for pl in box.get(key) or []:
            pid = pl.get("playerId")
            if not pid:
                continue
            row = {
                "source": SOURCE, "season_label": meta["season_label"], "competition": comp,
                "match_key": match_key, "match_date": match_date, "week": week,
                "tbf_player_id": pid, "player_name": pl.get("playerName"),
                "team_id": team["id"], "team_name": team["name"], "team_slug": slugify(team["name"]),
                "jersey_no": str(pl.get("jerseyNumber") or "") or None,
                "tbf_match_id": match_id,
            }
            row.update(_stat_cols(pl))
            player_rows.append(row)
    return team_rows, player_rows


# ----------------------------- yükleme (psycopg2) -----------------------------
PMS_COLS = ["source", "season_label", "competition", "match_key", "match_date", "week",
            "player_slug", "player_name", "team_slug", "team_name", "jersey_no",
            "seconds_played", "minutes", "points", "fg2m", "fg2a", "fg2_pct",
            "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct", "oreb", "dreb", "treb",
            "assists", "turnovers", "steals", "blocks", "blocks_against",
            "fouls_drawn", "fouls_committed", "tbf_player_id", "tbf_match_id"]

TMS_COLS = ["source", "season_label", "competition", "match_key", "match_date", "week",
            "team_slug", "team_name", "home_away", "opponent_slug", "opponent_name",
            "points", "opp_points", "fg2m", "fg2a", "fg2_pct", "fg3m", "fg3a", "fg3_pct",
            "ftm", "fta", "ft_pct", "oreb", "dreb", "treb", "assists", "turnovers",
            "steals", "blocks", "blocks_against", "fouls_drawn", "fouls_committed",
            "tbf_team_id", "tbf_match_id"]


def resolve_player_slugs(cur, player_rows, season_label):
    """tbf_player_id → player_slug. Yeni oyuncuya isimden slug (çakışırsa id ekle), boyutu upsert."""
    ids = {r["tbf_player_id"] for r in player_rows}
    cur.execute("select tbf_player_id, player_slug from basketball.players where tbf_player_id = any(%s)",
                (list(ids),))
    id2slug = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("select player_slug from basketball.players")
    used = {r[0] for r in cur.fetchall()}
    # her tbf id için son görülen isim/takım
    latest = {}
    for r in player_rows:
        latest[r["tbf_player_id"]] = r
    for pid, r in latest.items():
        if pid in id2slug:
            slug = id2slug[pid]
        else:
            slug = slugify(r["player_name"]) or f"tbf-{pid}"
            if slug in used:
                slug = f"{slug}-{pid}"
            used.add(slug)
            id2slug[pid] = slug
        cur.execute("""
            insert into basketball.players (player_slug, player_name, team_slug, team_name,
                                            jersey_no, season_label, tbf_player_id)
            values (%s,%s,%s,%s,%s,%s,%s)
            on conflict (player_slug) do update set
                player_name=excluded.player_name, team_slug=excluded.team_slug,
                team_name=excluded.team_name, jersey_no=excluded.jersey_no,
                tbf_player_id=excluded.tbf_player_id, updated_at=now()
        """, (slug, r["player_name"], r["team_slug"], r["team_name"],
              r["jersey_no"], season_label, pid))
    return id2slug


def upsert_teams(cur, team_rows, season_label, logos):
    for tr in team_rows:
        cur.execute("""
            insert into basketball.teams (team_slug, team_name, season_label, tbf_team_id, logo_url)
            values (%s,%s,%s,%s,%s)
            on conflict (team_slug) do update set
                team_name=excluded.team_name, tbf_team_id=excluded.tbf_team_id,
                logo_url=coalesce(excluded.logo_url, basketball.teams.logo_url), updated_at=now()
        """, (tr["team_slug"], tr["team_name"], season_label, tr["tbf_team_id"],
              logos.get(tr["tbf_team_id"])))


def write_match(cur, team_rows, player_rows, season_label, logos):
    """Tek cursor üzerinde tüm yazımlar (commit YOK — çağıran yönetir)."""
    upsert_teams(cur, team_rows, season_label, logos)
    id2slug = resolve_player_slugs(cur, player_rows, season_label)
    for r in player_rows:
        r = dict(r); r["player_slug"] = id2slug[r["tbf_player_id"]]
        vals = [r.get(c) for c in PMS_COLS]
        setexpr = ", ".join(f"{c}=excluded.{c}" for c in PMS_COLS if c not in ("tbf_match_id", "tbf_player_id"))
        cur.execute(f"""insert into basketball.player_match_stats ({",".join(PMS_COLS)})
            values ({",".join(["%s"]*len(PMS_COLS))})
            on conflict (tbf_match_id, tbf_player_id)
                where tbf_match_id is not null and tbf_player_id is not null
            do update set {setexpr}, updated_at=now()""", vals)
    for r in team_rows:
        vals = [r.get(c) for c in TMS_COLS]
        setexpr = ", ".join(f"{c}=excluded.{c}" for c in TMS_COLS if c not in ("tbf_match_id", "tbf_team_id"))
        cur.execute(f"""insert into basketball.team_match_stats ({",".join(TMS_COLS)})
            values ({",".join(["%s"]*len(TMS_COLS))})
            on conflict (tbf_match_id, tbf_team_id)
                where tbf_match_id is not null and tbf_team_id is not null
            do update set {setexpr}, updated_at=now()""", vals)


def load_match(conn, team_rows, player_rows, season_label, logos):
    with conn.cursor() as cur:
        write_match(cur, team_rows, player_rows, season_label, logos)
    conn.commit()


# ----------------------------- orkestrasyon -----------------------------
def run(args):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    env = dict(os.environ)
    proxy = build_proxy(env)
    bootstrap = f"{BASE}/ligler/bsl-{args.season_label}"
    print(f"[tbf] league={args.league_id} season={args.season_id} label={args.season_label} "
          f"dry_run={args.dry_run}", flush=True)

    conn = None
    if not args.dry_run:
        conn = psycopg2.connect(env["DATABASE_URL"])

    n_matches = n_players = 0
    logos = {}
    with TbfSession(proxy, bootstrap) as ses:
        print("[tbf] Cloudflare geçildi:", ses.pg.title(), flush=True)

        # hedef maç id'leri
        if args.match:
            match_metas = [{"match_id": int(args.match), "week": None, "match_date": None,
                            "competition": None, "season_label": args.season_label}]
        else:
            weeks = ses.api(f"/api/League/get-league-weeks?leagueId={args.league_id}&seasonId={args.season_id}") or []
            wnums = [w.get("sezon_Hafta") for w in weeks]
            if args.week:
                wnums = [str(args.week)]
            print(f"[tbf] {len(wnums)} hafta taranacak", flush=True)
            match_metas = []
            for w in wnums:
                ml = ses.api(f"/api/Match/get-all-matches-for-filter?ActivityId={args.league_id}"
                             f"&Page=1&PageSize=-1&WeekFilter={w}") or []
                for m in ml:
                    hs = num((m.get("homeTeam") or {}).get("score"))
                    as_ = num((m.get("awayTeam") or {}).get("score"))
                    if hs is None or as_ is None:
                        continue  # oynanmamış maç → atla
                    match_metas.append({
                        "match_id": m["matchId"], "week": m.get("week"),
                        "match_date": m.get("matchDate"),
                        "competition": m.get("activityName"),
                        "season_label": args.season_label,
                    })
                time.sleep(0.4)
            print(f"[tbf] {len(match_metas)} oynanmış maç bulundu", flush=True)

        for meta in match_metas:
            mid = meta["match_id"]
            header = ses.api(f"/api/Match/mac-header?matchId={mid}")
            box = ses.api(f"/api/Match/mac-istatistik?matchId={mid}")
            if not header or not box or not box.get("homeTopFive"):
                print(f"[tbf]  maç {mid}: veri yok/oynanmamış, atlandı", flush=True)
                continue
            team_rows, player_rows = normalize_match(header, box, meta)
            for t in (header["homeTeam"], header["awayTeam"]):
                if t.get("logo"):
                    logos[t["teamId"]] = t["logo"]
            n_matches += 1
            n_players += len(player_rows)
            if args.dry_run:
                print(f"\n=== maç {mid}: {team_rows[0]['match_key']} "
                      f"({team_rows[0]['points']}-{team_rows[1]['points']}) "
                      f"hafta={team_rows[0]['week']} tarih={team_rows[0]['match_date']} ===", flush=True)
                print(f"  oyuncu sayısı: {len(player_rows)}", flush=True)
                for pr in player_rows[:3]:
                    print(f"    [{pr['tbf_player_id']}] {pr['player_name']} ({pr['team_name']}) "
                          f"dk={pr['minutes']} sayı={pr['points']} rib={pr['treb']} "
                          f"as={pr['assists']} 3s={pr['fg3m']}/{pr['fg3a']} slug={slugify(pr['player_name'])}", flush=True)
            else:
                load_match(conn, team_rows, player_rows, args.season_label, logos)
                print(f"[tbf]  maç {mid} yüklendi ({len(player_rows)} oyuncu)", flush=True)
            time.sleep(0.5)

    # Oyuncu box-score yazildiysa tools window MATVIEW'i bayat kalir -> tazele.
    # (analytics.bb_player_metric_window_v1 2026-08-20'de matview'a cevrildi, P-2:
    #  eskiden PostgREST sayfalamasinda her sayfa ~640-1000 ms yeniden hesapliyordu.
    #  Refresh EDILMEZSE BSL Match-Player Tools eski/eksik veriyle calisir.
    #  el_player_metric_window_v1'deki kalibin aynisi, bkz fetch_euroleague.py.)
    if conn and n_players > 0:
        try:
            with conn.cursor() as cur:
                cur.execute("refresh materialized view analytics.bb_player_metric_window_v1")
            conn.commit()
            print("[tbf] tools window matview tazelendi (bb_player_metric_window_v1)", flush=True)
        except Exception as e:
            print(f"[tbf] UYARI: window matview refresh hatasi {e!r} — ELLE tazele: "
                  f"refresh materialized view analytics.bb_player_metric_window_v1", flush=True)
    if conn:
        conn.close()
    print(f"\n[tbf] BİTTİ: {n_matches} maç, {n_players} oyuncu-satırı "
          f"({'DRY-RUN, DB yazılmadı' if args.dry_run else 'DB yazıldı'}).", flush=True)


def main():
    ap = argparse.ArgumentParser(description="TBF BSL basketbol scraper (id-anchored)")
    ap.add_argument("--league-id", type=int, required=True, help="ActivityId (BSL 2025-26 = 20728)")
    ap.add_argument("--season-id", type=int, required=True, help="seasonId (2025-26 = 172)")
    ap.add_argument("--season-label", required=True, help="ör. 2025-2026")
    ap.add_argument("--week", type=int, help="tek hafta (WeekFilter)")
    ap.add_argument("--match", type=int, help="tek maç (matchId) — test için")
    ap.add_argument("--dry-run", action="store_true", help="DB yazma, sadece normalize edip yazdır")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
