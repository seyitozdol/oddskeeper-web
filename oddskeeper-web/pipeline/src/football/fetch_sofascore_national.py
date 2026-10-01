# -*- coding: utf-8 -*-
"""Turkiye A Milli Futbol Takimi (SofaScore takim id 4700) veri akisi.

Kulup akisindan (fetch_sofascore_matches.py) farki: TURNUVA degil TAKIM bazli.
Bir takimin birden cok turnuvadaki (Uluslar Ligi, Dunya Kupasi + elemeleri,
EURO + elemeleri) resmi maclarini isler. Hazirlik maclari (ut 851) ALINMAZ:
izinli turnuvalar ref.national_competitions tablosundadir, listede olmayan
turnuvanin maci atlanir (log'a yazilir).

Model ekranlari (MSM/PSM) rakibin de verisini ister. Bu yuzden Turkiye'nin
YAKLASAN rakipleri "ilgi takimi" sayilir: onlarin resmi mac gecmisi de
(ayni izinli turnuvalar, ayni baslangic tarihi) yuklenir.

Yazilan tablolar (source='sofascore', kupa akisiyla ayni yukleyiciler):
  football.matches, match_player_stats_details (+ match_player_stats_raw),
  match_team_stats, match_player_cards, match_player_shots, fixtures
ve milli takima ozel:
  football.national_editions, national_event_meta, national_standings

SEZON ETIKETI: tarih bazli (sinir 24 Haziran, lib/season.ts ile ayni). Yaz
turnuvalari (EURO, Dunya Kupasi) ref.national_competitions.season_shift_days
kadar geri kaydirilmis tarihle etiketlenir; boylece turnuvanin tum maclari
biten sezona yazilir.

Modlar:
  --backfill            Turkiye + yaklasan rakiplerin SINCE'ten beri tum resmi maclari
                        (DB'de olanlar atlanir; --force hepsini yeniden ceker)
  --sync                mac-sonrasi tur: fikstur tablosunda baslama saati grace
                        penceresinde olan maclar (aday yoksa HTTP istegi YOK)
  --fixtures            fikstur + puan tablosu + yeni rakip gecmisi (gunde 1-2 kez)
  --list-competitions   izinli turnuva etiketlerini satir satir basar (wrapper,
                        logo/bio/foto script'lerine arguman olarak verir)
Ortak: --since 2023-01-01  --sleep 0.5  --min-age 2.5  --max-age 8

Proxy OPSIYONEL: PROXY_URL varsa kullanir (VPS), yoksa dogrudan (lokal).
Cikti satirlari (wrapper bunlari okur):  NATL_CHANGED_M: <n>   NATL_NEW_TEAMS: <n>
"""
import argparse
import importlib
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from curl_cffi import requests as cr
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]  # pipeline/
ENV = dotenv_values(ROOT / ".env")
PROXY = (ENV.get("PROXY_URL") or "").strip()
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')
API = "https://www.sofascore.com/api/v1"
HDR = {"Accept": "application/json"}

FOCUS_TEAM_ID = 4700  # Turkiye A Milli (erkek). Kadin 38104, U21 4892: KAPSAM DISI.

sys.path.insert(0, str(Path(__file__).resolve().parent))
loader = importlib.import_module("load_sofascore_1lig_player_stats")
teamload = importlib.import_module("load_sofascore_team_stats")
shotload = importlib.import_module("load_sofascore_shotmap")
scrape_hash = importlib.import_module("scrape_hash")
mpsd_raw = importlib.import_module("mpsd_raw")

STATUS_MAP = {
    "notstarted": "scheduled", "postponed": "postponed",
    "canceled": "cancelled", "cancelled": "cancelled",
    "finished": "completed", "inprogress": "live",
}

FETCH_FAIL = 0  # cekilemeyen istek sayisi (tam cokus tespiti icin)
FETCH_OK = 0


def get(path, tries=4):
    """200 -> json, 404 -> None (uc yok), diger -> tekrar dene, sonunda None."""
    global FETCH_FAIL, FETCH_OK
    last = None
    for i in range(tries):
        try:
            r = cr.get(API + path, headers=HDR, proxies=PROXIES, impersonate="safari17_0", timeout=40)
            if r.status_code == 200:
                FETCH_OK += 1
                return r.json()
            if r.status_code == 404:
                FETCH_OK += 1
                return None
            last = f"HTTP {r.status_code}: {r.text[:100]}"
        except Exception as e:  # noqa
            last = repr(e)[:120]
        time.sleep(1.5 * (i + 1))
    FETCH_FAIL += 1
    print(f"  CEKILEMEDI {path} -> {last}", flush=True)
    return None


def season_label_for(ts: int, shift_days: int = 0) -> str:
    """Tarih bazli sezon (sinir 24 Haziran); frontend lib/season.ts ile ayni kural."""
    d = datetime.fromtimestamp(ts, tz=timezone.utc) - timedelta(days=shift_days)
    new_season = d.month > 6 or (d.month == 6 and d.day >= 24)
    y = d.year
    return f"{y}/{y + 1}" if new_season else f"{y - 1}/{y}"


def connect():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    return conn


def load_comps(cur) -> dict:
    cur.execute("select unique_tournament_id, competition, season_shift_days from ref.national_competitions")
    return {r[0]: {"competition": r[1], "shift": r[2]} for r in cur.fetchall()}


def ut_of(ev: dict):
    return ((ev.get("tournament") or {}).get("uniqueTournament") or {}).get("id")


def is_men_national(ev: dict) -> bool:
    """Iki taraf da erkek A milli takim mi (genc/kadin takimlar ayri id + ayri turnuva;
    yine de emniyet: national=True ve gender M/bos)."""
    for side in ("homeTeam", "awayTeam"):
        t = ev.get(side) or {}
        if t.get("national") is False:
            return False
        if (t.get("gender") or "M") != "M":
            return False
    return True


def team_events(team_id: int, kind: str, since_ts: float = 0.0) -> list:
    """kind='last': since_ts'e kadar geriye sayfala; kind='next': tum sayfalar."""
    out, page = [], 0
    while page < 12:
        d = get(f"/team/{team_id}/events/{kind}/{page}")
        evs = (d or {}).get("events") or []
        if not evs:
            break
        out.extend(evs)
        if kind == "last":
            oldest = min(e.get("startTimestamp") or 0 for e in evs)
            if oldest < since_ts:
                break
        if not (d or {}).get("hasNextPage"):
            break
        page += 1
        time.sleep(0.3)
    return out


def allowed(ev: dict, comps: dict) -> bool:
    return ut_of(ev) in comps and is_men_national(ev)


# ---------------------------------------------------------------- meta / fikstur

def upsert_meta(cur, events: list, comps: dict) -> None:
    """Baski (ut+sezon) ve event -> baski eslemesi. Fikstur ve mac ayni event id'yi tasir."""
    editions, metas = {}, []
    for ev in events:
        ut = ut_of(ev)
        season = ev.get("season") or {}
        sid = season.get("id")
        if ut not in comps or not sid:
            continue
        editions[(ut, sid)] = (ut, sid, comps[ut]["competition"], season.get("name"), season.get("year"))
        t = ev.get("tournament") or {}
        metas.append((str(ev["id"]), ut, sid, t.get("id"), t.get("name")))
    if editions:
        psycopg2.extras.execute_values(
            cur,
            """insert into football.national_editions
                 (unique_tournament_id, season_id, competition, season_name, year_text)
               values %s
               on conflict (unique_tournament_id, season_id) do update set
                 competition = excluded.competition, season_name = excluded.season_name,
                 year_text = excluded.year_text, updated_at = now()""",
            list(editions.values()),
        )
    if metas:
        dedup = {m[0]: m for m in metas}
        psycopg2.extras.execute_values(
            cur,
            """insert into football.national_event_meta
                 (event_id, unique_tournament_id, season_id, tournament_id, tournament_name)
               values %s
               on conflict (event_id) do update set
                 unique_tournament_id = excluded.unique_tournament_id, season_id = excluded.season_id,
                 tournament_id = excluded.tournament_id, tournament_name = excluded.tournament_name,
                 updated_at = now()""",
            list(dedup.values()),
        )


def upsert_fixtures(cur, events: list, comps: dict) -> int:
    n = 0
    for ev in events:
        ts = ev.get("startTimestamp")
        ut = ut_of(ev)
        if not ts or ut not in comps:
            continue
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        h, a = ev["homeTeam"], ev["awayTeam"]
        status = STATUS_MAP.get((ev.get("status") or {}).get("type"), "scheduled")
        cur.execute(
            """insert into football.fixtures (
                 fixture_id, competition, season_label, round_number,
                 fixture_date, fixture_datetime, kickoff_time_known,
                 home_team_slug, away_team_slug,
                 home_team_source_id, away_team_source_id,
                 home_team_name, away_team_name,
                 fixture_status, source, source_fixture_id, created_at, updated_at
               ) values (%s,%s,%s,%s,%s,%s,true,%s,%s,%s,%s,%s,%s,%s,'sofascore',%s,now(),now())
               on conflict (fixture_id) do update set
                 competition = excluded.competition,
                 season_label = excluded.season_label,
                 round_number = excluded.round_number,
                 fixture_date = excluded.fixture_date,
                 fixture_datetime = excluded.fixture_datetime,
                 home_team_name = excluded.home_team_name,
                 away_team_name = excluded.away_team_name,
                 fixture_status = excluded.fixture_status,
                 updated_at = now()""",
            (ev["id"], comps[ut]["competition"], season_label_for(ts, comps[ut]["shift"]),
             (ev.get("roundInfo") or {}).get("round") or 0, dt.date(), dt,
             str(h.get("slug") or h["id"]), str(a.get("slug") or a["id"]),
             str(h["id"]), str(a["id"]), h.get("name"), a.get("name"),
             status, str(ev["id"])),
        )
        n += 1
    return n


def sync_standings(cur, focus_events: list, comps: dict, only_recent_days: int = 0) -> int:
    """Turkiye'nin oynadigi her baskinin, Turkiye'yi iceren grup tablosu."""
    editions = {}
    cutoff = time.time() - only_recent_days * 86400 if only_recent_days else 0
    for ev in focus_events:
        ut, sid = ut_of(ev), (ev.get("season") or {}).get("id")
        if ut in comps and sid and (ev.get("startTimestamp") or 0) >= cutoff:
            editions[(ut, sid)] = True
    total = 0
    for ut, sid in editions:
        d = get(f"/unique-tournament/{ut}/season/{sid}/standings/total")
        for st in (d or {}).get("standings") or []:
            rows = st.get("rows") or []
            if not any((r.get("team") or {}).get("id") == FOCUS_TEAM_ID for r in rows):
                continue
            t = st.get("tournament") or {}
            tid = t.get("id")
            if not tid:
                continue
            payload = [(
                ut, sid, tid, st.get("name") or t.get("name"), r.get("position"),
                str(r["team"]["id"]), r["team"].get("name"),
                r.get("matches"), r.get("wins"), r.get("draws"), r.get("losses"),
                r.get("scoresFor"), r.get("scoresAgainst"), r.get("points"),
                (r.get("promotion") or {}).get("text"),
            ) for r in rows]
            cur.execute("delete from football.national_standings where season_id=%s and tournament_id=%s", (sid, tid))
            psycopg2.extras.execute_values(
                cur,
                """insert into football.national_standings
                     (unique_tournament_id, season_id, tournament_id, group_name, position,
                      team_source_id, team_name, played, wins, draws, losses,
                      goals_for, goals_against, points, note)
                   values %s""",
                payload,
            )
            total += len(payload)
        time.sleep(0.3)
    return total


# ---------------------------------------------------------------- mac yukleme

def process_events(events: list, comps: dict, sleep: float) -> int:
    """Bitmis event listesini yukler; payload'i degisen (ya da yeni) mac sayisini doner."""
    events = sorted({e["id"]: e for e in events}.values(), key=lambda e: e.get("startTimestamp") or 0)
    m_rows, p_rows, t_rows, c_rows, s_rows, hashes = [], [], [], [], [], []
    changed = 0

    def flush():
        nonlocal m_rows, p_rows, t_rows, c_rows, s_rows, hashes, changed
        if m_rows:
            loader.upsert("matches", m_rows, "source,source_match_id")
        if t_rows:
            teamload.upsert(t_rows)
        if c_rows:
            teamload.upsert_cards(c_rows)
        if s_rows:
            shotload.upsert(s_rows)
        if p_rows:
            dedup = {(r["source_match_id"], r["source_player_id"]): r for r in p_rows}
            hot, raw = mpsd_raw.split(list(dedup.values()))
            loader.upsert("match_player_stats_details", hot, "source,source_match_id,source_player_id")
            loader.upsert(mpsd_raw.TABLE, raw, mpsd_raw.CONFLICT)
        if hashes:
            changed += scrape_hash.check_and_store(loader.SOURCE, hashes)["changed"]
        if m_rows:
            print(f"    [flush] {len(m_rows)} mac, {len(p_rows)} oyuncu, {len(t_rows)} takim-stat, "
                  f"{len(c_rows)} kart, {len(s_rows)} sut", flush=True)
        m_rows, p_rows, t_rows, c_rows, s_rows, hashes = [], [], [], [], [], []

    done = 0
    for ev in events:
        eid, ut, ts = ev["id"], ut_of(ev), ev.get("startTimestamp")
        if (ev.get("status") or {}).get("type") != "finished" or not ts:
            continue
        lineup = get(f"/event/{eid}/lineups")
        if lineup is None:
            print(f"  ATLANDI event {eid}: lineup yok", flush=True)
            continue
        comp = comps[ut]["competition"]
        # match_row modul global'lerini okur: her mac kendi turnuva + sezon etiketiyle.
        loader.COMPETITION = comp
        loader.SEASON_LABEL = season_label_for(ts, comps[ut]["shift"])
        if not ev.get("referee"):
            det = get(f"/event/{eid}")
            if det and (det.get("event") or {}).get("referee"):
                ev["referee"] = det["event"]["referee"]
        m_one = loader.match_row(ev, playoff=False)
        p_ev = loader.player_rows(ev, lineup)
        t_ev, c_ev, s_ev = [], [], []
        try:
            stats = get(f"/event/{eid}/statistics")
            inc = get(f"/event/{eid}/incidents")
            t_ev = teamload.build_team_rows(ev, stats, inc, comp, lineup)
            c_ev = teamload.build_card_rows(ev, inc, lineup)
        except Exception as e:  # noqa
            print(f"  takim-stat atlandi {eid}: {repr(e)[:80]}", flush=True)
        try:
            sm = get(f"/event/{eid}/shotmap")
            if sm:
                s_ev = shotload.build_shot_rows(eid, sm.get("shotmap", []))
        except Exception as e:  # noqa
            print(f"  shotmap atlandi {eid}: {repr(e)[:80]}", flush=True)
        m_rows.append(m_one); p_rows.extend(p_ev); t_rows.extend(t_ev)
        c_rows.extend(c_ev); s_rows.extend(s_ev)
        try:
            hashes.append((str(eid), scrape_hash.event_payload_hash(m_one, p_ev, t_ev, c_ev, s_ev)))
        except Exception as e:  # noqa
            print(f"  hash hata {eid}: {repr(e)[:80]}", flush=True)
        done += 1
        hs = (ev.get("homeScore") or {}).get("current")
        as_ = (ev.get("awayScore") or {}).get("current")
        print(f"  + [{comp} {loader.SEASON_LABEL}] {ev['homeTeam']['name']} {hs}-{as_} "
              f"{ev['awayTeam']['name']} (event {eid})", flush=True)
        time.sleep(sleep)
        if done % 20 == 0:
            flush()
    flush()
    return changed


def known_match_ids(cur) -> set:
    cur.execute(
        """select m.source_match_id from football.matches m
           where m.source='sofascore'
             and m.competition in (select competition from ref.national_competitions)""")
    return {r[0] for r in cur.fetchall()}


def teams_with_history(cur) -> set:
    """Gecmisi yuklenmis sayilan takimlar: en az 4 maci olanlar (yalniz Turkiye'ye
    karsi oynadigi maclarla gorunen eski rakip 'gecmisi var' sayilmaz)."""
    cur.execute(
        """select tid from (
             select home_team_source_id tid from football.matches
               where source='sofascore' and competition in (select competition from ref.national_competitions)
             union all
             select away_team_source_id from football.matches
               where source='sofascore' and competition in (select competition from ref.national_competitions)
           ) x group by tid having count(*) >= 4""")
    return {r[0] for r in cur.fetchall()}


def upcoming_opponents(next_events: list, comps: dict) -> dict:
    out = {}
    for ev in next_events:
        if not allowed(ev, comps):
            continue
        for side in ("homeTeam", "awayTeam"):
            t = ev[side]
            if t["id"] != FOCUS_TEAM_ID:
                out[t["id"]] = t.get("name")
    return out


def history_for(team_id: int, since_ts: float, comps: dict, skip_ids: set) -> list:
    evs = team_events(team_id, "last", since_ts)
    out, skipped_ut = [], {}
    for ev in evs:
        if (ev.get("startTimestamp") or 0) < since_ts:
            continue
        if (ev.get("status") or {}).get("type") != "finished":
            continue
        if not allowed(ev, comps):
            ut = ut_of(ev)
            name = ((ev.get("tournament") or {}).get("uniqueTournament") or {}).get("name")
            if ut != 851 and is_men_national(ev):
                skipped_ut[ut] = name
            continue
        if str(ev["id"]) in skip_ids:
            continue
        out.append(ev)
    for ut, name in skipped_ut.items():
        print(f"  NOT: takim {team_id} izinli olmayan turnuva atlandi: ut={ut} {name}", flush=True)
    return out


# ---------------------------------------------------------------- modlar

def mode_backfill(cur, comps, since_ts, sleep, force):
    skip = set() if force else known_match_ids(cur)
    nxt = team_events(FOCUS_TEAM_ID, "next")
    last = team_events(FOCUS_TEAM_ID, "last", since_ts)
    focus_all = [e for e in last + nxt if allowed(e, comps) and (e.get("startTimestamp") or 0) >= since_ts]
    upsert_meta(cur, focus_all, comps)
    print(f"fikstur upsert: {upsert_fixtures(cur, focus_all, comps)}", flush=True)
    print(f"puan tablosu satiri: {sync_standings(cur, focus_all, comps)}", flush=True)

    todo = history_for(FOCUS_TEAM_ID, since_ts, comps, skip)
    print(f"[Turkiye] yuklenecek mac: {len(todo)}", flush=True)
    changed = process_events(todo, comps, sleep)
    skip |= {str(e["id"]) for e in todo}

    opps = upcoming_opponents(nxt, comps)
    for tid, name in opps.items():
        evs = history_for(tid, since_ts, comps, skip)
        print(f"[rakip {name} {tid}] yuklenecek mac: {len(evs)}", flush=True)
        upsert_meta(cur, evs, comps)
        changed += process_events(evs, comps, sleep)
        skip |= {str(e["id"]) for e in evs}
    return changed, len(opps)


def mode_fixtures(cur, comps, since_ts, sleep):
    """Fikstur + puan tablosu + yeni rakip gecmisi + son 72 saatin duzeltme gecisi."""
    nxt = team_events(FOCUS_TEAM_ID, "next")
    last = team_events(FOCUS_TEAM_ID, "last", time.time() - 120 * 86400)
    focus = [e for e in last + nxt if allowed(e, comps)]
    if not focus and FETCH_FAIL:
        return 0, 0
    upsert_meta(cur, focus, comps)
    print(f"fikstur upsert (Turkiye): {upsert_fixtures(cur, focus, comps)}", flush=True)
    print(f"puan tablosu satiri: {sync_standings(cur, focus, comps, only_recent_days=200)}", flush=True)

    known = known_match_ids(cur)
    have = teams_with_history(cur)
    changed, new_teams = 0, 0
    opps = upcoming_opponents(nxt, comps)
    for tid, name in opps.items():
        # rakibin yaklasan fiksturleri de yazilir: --sync adaylarini DB'den bulur.
        o_next = [e for e in team_events(tid, "next") if allowed(e, comps)]
        upsert_meta(cur, o_next, comps)
        upsert_fixtures(cur, o_next, comps)
        if str(tid) not in have:
            evs = history_for(tid, since_ts, comps, known)
            print(f"[YENI rakip {name} {tid}] gecmis yukleniyor: {len(evs)} mac", flush=True)
            upsert_meta(cur, evs, comps)
            changed += process_events(evs, comps, sleep)
            known |= {str(e["id"]) for e in evs}
            new_teams += 1
        else:
            # son 72 saatte biten ama kacmis / duzeltilmis maclar
            recent = [e for e in team_events(tid, "last", time.time() - 3 * 86400)
                      if allowed(e, comps) and (e.get("startTimestamp") or 0) >= time.time() - 3 * 86400]
            upsert_meta(cur, recent, comps)
            changed += process_events(recent, comps, sleep)
    recent_focus = [e for e in last if allowed(e, comps)
                    and (e.get("startTimestamp") or 0) >= time.time() - 3 * 86400]
    changed += process_events(recent_focus, comps, sleep)
    return changed, new_teams


def mode_sync(cur, comps, min_age_h, max_age_h, sleep):
    """Mac-sonrasi: baslama saati grace penceresindeki ilgi maclari (aday yoksa HTTP yok)."""
    cur.execute(
        """select f.fixture_id from football.fixtures f
           where f.source='sofascore'
             and f.competition in (select competition from ref.national_competitions)
             and f.fixture_datetime between now() - make_interval(hours => %s) and now() - make_interval(mins => %s)
           order by f.fixture_datetime""",
        (int(max_age_h), int(min_age_h * 60)),
    )
    ids = [r[0] for r in cur.fetchall()]
    if not ids:
        return 0
    events = []
    for fid in ids:
        d = get(f"/event/{fid}")
        ev = (d or {}).get("event")
        if ev and allowed(ev, comps):
            events.append(ev)
    upsert_meta(cur, events, comps)
    upsert_fixtures(cur, events, comps)
    changed = process_events(events, comps, sleep)
    if changed:
        focus = [e for e in events if FOCUS_TEAM_ID in (e["homeTeam"]["id"], e["awayTeam"]["id"])]
        # grup tablosu, gruptaki herhangi bir mac bitince degisir
        sync_standings(cur, focus or events, comps)
    return changed


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--backfill", action="store_true")
    g.add_argument("--sync", action="store_true")
    g.add_argument("--fixtures", action="store_true")
    g.add_argument("--list-competitions", action="store_true")
    ap.add_argument("--since", default="2023-01-01")
    ap.add_argument("--sleep", type=float, default=0.5)
    ap.add_argument("--min-age", type=float, default=2.5)
    ap.add_argument("--max-age", type=float, default=8)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.list_competitions:
        conn = connect()
        cur = conn.cursor()
        for c in sorted(v["competition"] for v in load_comps(cur).values()):
            print(c)
        conn.close()
        return
    if not (loader.SUPABASE_URL and loader.SUPABASE_KEY and DSN):
        raise SystemExit("Eksik env: SUPABASE_URL / SUPABASE_SECRET_KEY / DATABASE_URL")
    since_ts = datetime.strptime(args.since, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
    conn = connect()
    cur = conn.cursor()
    comps = load_comps(cur)
    if not comps:
        raise SystemExit("ref.national_competitions bos")

    changed, new_teams = 0, 0
    if args.backfill:
        changed, new_teams = mode_backfill(cur, comps, since_ts, args.sleep, args.force)
    elif args.fixtures:
        changed, new_teams = mode_fixtures(cur, comps, since_ts, args.sleep)
    else:
        changed = mode_sync(cur, comps, args.min_age, args.max_age, args.sleep)
    conn.close()

    print(f"NATL_CHANGED_M: {changed}", flush=True)
    print(f"NATL_NEW_TEAMS: {new_teams}", flush=True)
    # Isteklerin yarisi ve fazlasi cekilemediyse (SofaScore/proxy cokusu) sessiz kalma.
    if FETCH_FAIL and FETCH_FAIL >= FETCH_OK:
        raise SystemExit(f"FETCH FAILED: {FETCH_FAIL} istek cekilemedi, {FETCH_OK} basarili")


if __name__ == "__main__":
    main()
