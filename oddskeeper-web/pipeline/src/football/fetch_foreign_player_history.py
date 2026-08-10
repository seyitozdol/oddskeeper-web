# -*- coding: utf-8 -*-
"""Yeni transferlerin YURT DISI gecmis sezon verilerini SofaScore'dan ceker.

Hedef oyuncular (otomatik secilir):
  a) team_squad_current source='synthetic-tm' (TM sentetikleri; Salah vb)
  b) source='apifootball' + piyasa degeri >= 1m EUR + bizim kaynaklarda
     2025/2026 oyuncu-mac verisi HIC olmayanlar (Greenwood vb)

Akis (oyuncu basina):
  1. /search/all?q=<ad> -> sofascore oyuncu id (dogrulama: takim adi ve/veya
     dogum tarihi; belirsizse UYARI ile atlanir)
  2. /player/{id}/statistics/seasons -> 25/26 ve 24/25 sezonlari (tum turnuvalar)
  3. her turnuva icin /statistics/overall -> metrik toplamlari
  4. football.player_foreign_season_stats'a upsert (turnuva basina satir)

analytics.player_foreign_season_v1 sezon bazinda toplayip mac-basi ortalama
doner; PSM LY Avg fallback'i oradan okur.

Kullanim: python fetch_foreign_player_history.py [--only "ad,ad2"] [--dry-run]
"""
from __future__ import annotations

import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone

import psycopg2
from curl_cffi import requests as cr
from dotenv import load_dotenv

API = "https://api.sofascore.com/api/v1"
SLEEP = 0.6

# SofaScore sezon adi -> bizim season_label
SEASON_MAP = {"25/26": "2025/2026", "24/25": "2024/2025"}

# SofaScore istatistik alani -> tablo kolonu
STAT_MAP = {
    "goals": "goals", "assists": "assists",
    "totalShots": "shots_total", "shotsOnTarget": "shots_on_target",
    "shotsOffTarget": "shots_off_target", "blockedShots": "shots_blocked",
    "shotsFromInsideTheBox": "attempts_ibox", "shotsFromOutsideTheBox": "attempts_obox",
    "expectedGoals": "expected_goals",
    "totalPasses": "passes", "accuratePasses": "accurate_pass",
    "tackles": "tackles", "fouls": "fouls_conceded", "wasFouled": "fouls_won",
    "offsides": "offsides", "yellowCards": "cards_yellow",
    "saves": "saves_total", "minutesPlayed": "minutes_played",
}


def fold(s: str) -> str:
    s = (s or "").replace("ı", "i").replace("İ", "i").replace("ş", "s").replace("Ş", "s")
    s = s.replace("ğ", "g").replace("Ğ", "g").replace("ç", "c").replace("Ç", "c")
    s = s.replace("ö", "o").replace("Ö", "o").replace("ü", "u").replace("Ü", "u")
    s = s.replace("ł", "l").replace("ń", "n").replace("ø", "o")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).strip()


def get(path: str, tries: int = 3):
    last = None
    for i in range(tries):
        try:
            r = cr.get(API + path, impersonate="chrome", timeout=30)
            if r.status_code == 200:
                time.sleep(SLEEP)
                return r.json()
            if r.status_code == 404:
                time.sleep(SLEEP)
                return None
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa
            last = repr(e)[:80]
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"{path} -> {last}")


def name_keys(name: str) -> set[str]:
    t = fold(name).split()
    keys = {" ".join(t)}
    if len(t) >= 2:
        keys.add(f"{t[0][0]} {t[-1]}")
        keys.add(f"{t[-1]} {t[0][0]}")
        keys.add(" ".join(reversed(t)))
    return keys


def pick_targets(cur, only: set[str] | None):
    """Hedef oyuncular: (apif_id, ad, takim_display, dogum) listesi."""
    # a) sentetikler (dogum squad_synthetic_players'ta)
    cur.execute("""
        select s.source_player_id, s.player_name, s.team_name, sp.birth_date
        from football.team_squad_current s
        left join football.squad_synthetic_players sp on 'tm' || sp.tm_player_id = s.source_player_id
        where s.source = 'synthetic-tm'
    """)
    targets = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    # b) gercek id + deger >= 1m + 25/26 verisi yok
    cur.execute("""
        select s.source_player_id, coalesce(nullif(b.full_name,''), s.player_name),
               s.team_name, b.birth_date
        from football.team_squad_current s
        join football.player_market_values v on v.apifootball_player_id = s.source_player_id
        left join football.player_bio b on b.source='apifootball' and b.source_player_id = s.source_player_id
        where s.source = 'apifootball' and v.market_value_eur >= 1000000
    """)
    real = cur.fetchall()
    cur.execute("""
        select distinct d.player_name
        from football.match_player_stats_details d
        join football.matches m on m.source_match_id = d.source_match_id
          and (m.source = d.source or d.source = 'opta')
        where m.season_label = '2025/2026'
    """)
    last_season = set()
    for (nm,) in cur.fetchall():
        last_season |= name_keys(nm)
    for pid, nm, team, birth in real:
        if not (name_keys(nm) & last_season):
            targets[pid] = (nm, team, birth)

    if only:
        targets = {k: v for k, v in targets.items() if fold(v[0]) in only}
    return targets


def resolve_player(name: str, team: str, birth) -> tuple[int, str] | None:
    """SofaScore oyuncu id cozumu. Dogrulama: dogum tarihi VEYA takim adi."""
    from urllib.parse import quote
    data = get(f"/search/all?q={quote(name)}")
    if not data:
        return None
    cands = [r["entity"] for r in data.get("results", []) if r.get("type") == "player"]
    tteam = fold(team)
    nk = name_keys(name)
    scored = []
    for e in cands[:8]:
        if not (name_keys(e.get("name", "")) & nk):
            continue
        score = 0
        ts = e.get("dateOfBirthTimestamp")
        if birth and ts:
            d = datetime.fromtimestamp(ts, tz=timezone.utc).date()
            if d == birth:
                score += 2
            else:
                continue  # dogum tutmuyorsa kesin farkli oyuncu
        et = fold((e.get("team") or {}).get("name", ""))
        if et and tteam and (et in tteam or tteam in et or
                             len(set(et.split()) & set(tteam.split())) >= 1):
            score += 1
        scored.append((score, e))
    if not scored:
        return None
    scored.sort(key=lambda t: -t[0])
    best = scored[0]
    if best[0] == 0 and len(scored) > 1:
        return None  # belirsiz
    return int(best[1]["id"]), best[1]["name"]


def main() -> None:
    dry = "--dry-run" in sys.argv
    only = None
    for i, a in enumerate(sys.argv):
        if a == "--only" and i + 1 < len(sys.argv):
            only = {fold(x.strip()) for x in sys.argv[i + 1].split(",")}

    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    targets = pick_targets(cur, only)
    print(f"hedef oyuncu: {len(targets)}", flush=True)

    ok = skipped = rows_written = 0
    for apif_id, (name, team, birth) in sorted(targets.items(), key=lambda t: t[1][0]):
        try:
            res = resolve_player(name, team, birth)
        except Exception as e:  # noqa
            print(f"  HATA arama {name}: {repr(e)[:80]}", flush=True)
            skipped += 1
            continue
        if not res:
            print(f"  ATLANDI (id cozulemedi): {name} ({team})", flush=True)
            skipped += 1
            continue
        sid, sname = res

        try:
            seasons = get(f"/player/{sid}/statistics/seasons")
        except Exception as e:  # noqa
            print(f"  HATA sezonlar {name}: {repr(e)[:80]}", flush=True)
            skipped += 1
            continue
        wrote = 0
        for ts in (seasons or {}).get("uniqueTournamentSeasons", []):
            ut = ts["uniqueTournament"]
            for s in ts.get("seasons", []):
                label = next((v for k, v in SEASON_MAP.items() if k in (s.get("name") or "")), None)
                if not label:
                    continue
                try:
                    st = get(f"/player/{sid}/unique-tournament/{ut['id']}/season/{s['id']}/statistics/overall")
                except Exception:
                    continue
                stats = (st or {}).get("statistics") or {}
                apps = int(stats.get("appearances") or 0)
                if apps <= 0:
                    continue
                red = float(stats.get("directRedCards") or 0) + float(stats.get("yellowRedCards") or 0)
                cols = {v: stats.get(k) for k, v in STAT_MAP.items()}
                cols["cards_red"] = red
                if dry:
                    print(f"  [dry] {name}: {ut['name']} {s['name']} apps={apps}")
                    wrote += 1
                    continue
                fields = ", ".join(cols.keys())
                ph = ", ".join(["%s"] * len(cols))
                upd = ", ".join(f"{c}=excluded.{c}" for c in cols)
                cur.execute(
                    f"""insert into football.player_foreign_season_stats
                        (sofascore_player_id, apifootball_player_id, player_name,
                         season_label, tournament_id, tournament_name, appearances, {fields}, fetched_at)
                        values (%s,%s,%s,%s,%s,%s,%s,{ph}, now())
                        on conflict (sofascore_player_id, tournament_id, season_label) do update set
                          apifootball_player_id=excluded.apifootball_player_id,
                          appearances=excluded.appearances, {upd}, fetched_at=now()""",
                    (str(sid), apif_id, sname, label, ut["id"], ut["name"], apps, *cols.values()),
                )
                wrote += 1
        if wrote:
            conn.commit()
            ok += 1
            rows_written += wrote
            print(f"  + {name} (sofa {sid}): {wrote} sezon-turnuva satiri", flush=True)
        else:
            print(f"  VERISIZ: {name} (sofa {sid}) - 24/25-25/26 kaydi yok", flush=True)
            skipped += 1

    print(f"\nBITTI: {ok} oyuncu yuklendi ({rows_written} satir), {skipped} atlandi/verisiz", flush=True)
    conn.close()


if __name__ == "__main__":
    main()
