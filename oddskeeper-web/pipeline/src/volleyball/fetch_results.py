"""Voleybol mac sonuclari (skor + setler) -> volleyball.matches.

Kaynak en-live.volleyballworld.com JSON feed (schedule sayfasindaki widget'in cektigi):
  takvim : /api/v1/volley-tournament/matchdays/{year}/{utcOffset}/{tids}  -> mac gunleri
  maclar : /api/v1/live/matches/bytournaments/{tids}/{fromDate}/{toDate}   -> o gunun maclari
Mac objesi: noTeamA/noTeamB (edition id), matchPointsA/B (kazanilan set), sets[] (set-set
puan), statusLabel. Tarih objede YOK -> gun gun cekip tarihi atariz. Takim id -> kod
esleme volleyball.teams.edition_team_id uzerinden; kadin filtresi hem tournamentName
'women' hem de takim id'lerin bizim kadin kadromuzda olmasi (cift guvence).

Idempotent upsert (competition_id, match_no). Kullanim:
  python fetch_results.py --competition vnl-2024-w --dry-run
  python fetch_results.py --all
"""
import argparse
import json
import os
import time

import requests
from dotenv import load_dotenv
import psycopg2

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
LIVE = "https://en-live.volleyballworld.com/api/v1"

# turnuva -> (competition anahtari eslesmesi icin) slug/year/gender + feed tournament id'leri.
# tids: schedule sayfasindaki volleyTournamentIDs (bos ilk id atilir). year: takvim yili.
COMPS = {
    "vnl-2024-w": dict(slug="volleyball-nations-league", year=2024, gender="W", tids="1439;1440", cal_year=2024),
    "vnl-2025-w": dict(slug="volleyball-nations-league", year=2025, gender="W", tids="1542;1543", cal_year=2025),
    "vnl-2026-w": dict(slug="volleyball-nations-league", year=2026, gender="W", tids="1661;1662", cal_year=2026),
    "wch-2025-w": dict(slug="women-world-championship", year=2025, gender="W", tids="1521", cal_year=2025),
    "og-2024-w":  dict(slug="volleyball-olympic-games-paris-2024", year=2024, gender="W", tids="1443;1444", cal_year=2024),
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept": "application/json"})


def api(url, tries=3):
    for k in range(tries):
        try:
            r = SESSION.get(url, timeout=25)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if k == tries - 1:
                print(f"  ! GET fail {url}: {e}")
                return None
            time.sleep(1.5 * (k + 1))
    return None


def clean_tids(tids: str) -> str:
    return ";".join([x for x in tids.split(";") if x.strip()])


def parse_sets(sets):
    """sets[] -> gercek setleri [{a,b}] (padding no=0 / 0-0 haric)."""
    out = []
    for s in sets or []:
        a = s.get("pointsTeamA") or 0
        b = s.get("pointsTeamB") or 0
        if (s.get("no") or 0) >= 1 and (a > 0 or b > 0):
            out.append({"a": a, "b": b})
    return out


def connect():
    load_dotenv()
    return psycopg2.connect(os.environ["DATABASE_URL"].strip().strip('"'))


def run(cur, key, cfg, dry=False):
    print(f"\n=== {key} ({cfg['slug']} {cfg['year']}) ===")
    cur.execute(
        "select id from volleyball.competitions where comp_slug=%s and year=%s and gender=%s",
        (cfg["slug"], cfg["year"], cfg["gender"]),
    )
    row = cur.fetchone()
    if not row:
        print("  ! competition DB'de yok (once fetch_volleyballworld.py)")
        return
    comp_id = row[0]

    # bu turnuvanin kadin takim id'leri (edition) + kod eslemesi
    cur.execute(
        "select edition_team_id, team_code from volleyball.teams where competition_id=%s and edition_team_id is not null",
        (comp_id,),
    )
    id2code = {tid: code for tid, code in cur.fetchall()}
    women_ids = set(id2code.keys())
    print(f"  {len(women_ids)} kadin takim id (kod eslemesi)")

    tids = clean_tids(cfg["tids"])
    cal = api(f"{LIVE}/volley-tournament/matchdays/{cfg['cal_year']}/0/{tids}")
    days = (cal or {}).get("matchDays", []) if isinstance(cal, dict) else []
    print(f"  {len(days)} mac gunu")

    seen = {}   # match_no -> record (son gelen kazanir; ayni mac tekrar gelmez zaten)
    for d in days:
        matches = api(f"{LIVE}/live/matches/bytournaments/{tids}/{d}/{d}") or []
        for m in matches:
            a, b = m.get("noTeamA"), m.get("noTeamB")
            name = (m.get("tournamentName") or "").lower()
            is_women = ("women" in name) or (a in women_ids and b in women_ids)
            if not is_women:
                continue
            # kadin turnuvasinda ama takimlar bizim kadromuzda degilse yine de kaydet
            # (kod None kalir); cift guvence icin kod eslemesi id2code'dan.
            seen[m.get("no")] = dict(
                match_no=m.get("no"),
                match_date=d,
                home_team_id=a, away_team_id=b,
                home_code=id2code.get(a), away_code=id2code.get(b),
                home_sets=m.get("matchPointsA"), away_sets=m.get("matchPointsB"),
                set_scores=parse_sets(m.get("sets")),
                status=m.get("statusLabel"),
            )
        time.sleep(0.25)

    if not seen:
        print("  ! mac bulunamadi")
        return
    for r in seen.values():
        cur.execute(
            """insert into volleyball.matches
                 (competition_id, match_no, match_date, home_team_id, away_team_id,
                  home_code, away_code, home_sets, away_sets, set_scores, status)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (competition_id, match_no) do update set
                 match_date=excluded.match_date, home_team_id=excluded.home_team_id,
                 away_team_id=excluded.away_team_id, home_code=excluded.home_code,
                 away_code=excluded.away_code, home_sets=excluded.home_sets,
                 away_sets=excluded.away_sets, set_scores=excluded.set_scores,
                 status=excluded.status, updated_at=now()""",
            (comp_id, r["match_no"], r["match_date"], r["home_team_id"], r["away_team_id"],
             r["home_code"], r["away_code"], r["home_sets"], r["away_sets"],
             json.dumps(r["set_scores"]), r["status"]),
        )
    unmapped = sum(1 for r in seen.values() if r["home_code"] is None or r["away_code"] is None)
    print(f"  -> {len(seen)} mac yazildi ({unmapped} kod eslesmeyen)")
    if dry:
        cur.connection.rollback(); print("  (dry-run rollback)")
    else:
        cur.connection.commit(); print("  commit OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--competition")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    keys = list(COMPS) if args.all else ([args.competition] if args.competition else None)
    if not keys:
        ap.error("--competition veya --all gerekli")
    conn = connect(); cur = conn.cursor()
    for k in keys:
        cfg = COMPS.get(k)
        if not cfg:
            print(f"! bilinmeyen: {k}"); continue
        run(cur, k, cfg, dry=args.dry_run)
    cur.close(); conn.close(); print("\nBITTI.")


if __name__ == "__main__":
    main()
