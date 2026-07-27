# -*- coding: utf-8 -*-
"""SofaScore takim/oyuncu kimliklerini ref.team_mapping / ref.player_mapping'e baglar.

Takim: events_*.json'lardaki takimlar mevcut sluglarla isim benzerligiyle eslestirilir;
  eslesen sluga sofascore source_team_id satiri eklenir, eslesmeyene sofascore slug'u ile
  yeni slug acilir (on conflict do nothing).
Oyuncu: ref.player_mapping'e sofascore_player_id kolonu eklenir (yoksa); lineup_*.json'lardaki
  oyuncular player_bio (apifootball, isim+dogum tarihi) uzerinden mevcut mapping satirlarina
  baglanir.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\build_sofascore_mappings.py [--dry-run]
  (veri klasorleri: pipeline/data/sofascore/*/)
"""
import json
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

from datetime import timedelta

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
SLUG_ALIAS = {"van-spor-futbol-kulubu": "vanspor-fk", "serik-belediyespor": "serikspor"}

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DATA_DIRS = sorted((ROOT / "data" / "sofascore").glob("*/"))
DRY = "--dry-run" in sys.argv


def norm(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("ı", "i")
    return " ".join("".join(ch if ch.isalnum() or ch == " " else " " for ch in s).split())


def team_key(s: str) -> str:
    """Takim adi karsilastirma anahtari: ek/sozcuk gurultusunu at."""
    words = [w for w in norm(s).split() if w not in {"fk", "sk", "as", "spor", "kulubu", "sportif", "faaliyetler", "futbol", "1907", "1966", "1926"}]
    return " ".join(words) or norm(s)


def load_sofa_teams():
    teams = {}
    for d in DATA_DIRS:
        for f in d.glob("events_*.json"):
            for ev in json.loads(f.read_text(encoding="utf-8")):
                for side in ("homeTeam", "awayTeam"):
                    t = ev.get(side) or {}
                    if t.get("id"):
                        teams[t["id"]] = {"name": t.get("name"), "slug": t.get("slug"), "short": t.get("shortName")}
    return teams


def load_sofa_players():
    players = {}
    for d in DATA_DIRS:
        for f in d.glob("lineup_*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            for side in ("home", "away"):
                for p in (data.get(side) or {}).get("players") or []:
                    info = p.get("player") or {}
                    pid = info.get("id")
                    if not pid:
                        continue
                    dob = info.get("dateOfBirthTimestamp")
                    players[pid] = {
                        "name": info.get("name"),
                        "slug": info.get("slug"),
                        "dob": (EPOCH + timedelta(seconds=dob)).date() if dob is not None else None,
                    }
    return players


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    conn.autocommit = False
    cur = conn.cursor()

    # ---------- TAKIM ----------
    sofa_teams = load_sofa_teams()
    cur.execute("select team_slug, display_name, canonical_team_name, source_team_id from ref.team_mapping")
    existing = cur.fetchall()
    by_key = {}
    for slug, disp, canon, _sid in existing:
        for cand in (slug, disp, canon):
            if cand:
                by_key.setdefault(team_key(cand), slug)
    existing_pairs = {(r[0], r[3]) for r in existing}

    team_rows = []
    for tid, t in sorted(sofa_teams.items()):
        key = team_key(t["name"]) or team_key(t["slug"] or "")
        slug = by_key.get(key) or by_key.get(team_key(t["slug"] or ""))
        is_new = slug is None
        if is_new:
            slug = t["slug"] or key.replace(" ", "-")
            slug = SLUG_ALIAS.get(slug, slug)
        if (slug, str(tid)) in existing_pairs:
            continue
        team_rows.append((slug, t["name"], t["name"], str(tid), is_new))

    print(f"Sofa takim: {len(sofa_teams)}, eklenecek satir: {len(team_rows)}")
    for slug, name, _c, sid, is_new in team_rows:
        tag = "YENI-SLUG" if is_new else "mevcut"
        print(f"  [{tag}] {slug} <- {name} (sofa {sid})")
    if not DRY:
        psycopg2.extras.execute_values(
            cur,
            """insert into ref.team_mapping (team_slug, display_name, canonical_team_name, source_team_id, is_active)
               values %s on conflict (team_slug, source_team_id) do nothing""",
            [(r[0], r[1], r[2], r[3], True) for r in team_rows],
        )

    # ---------- OYUNCU ----------
    # dry-run'da da calisir; transaction sonunda rollback edilir
    cur.execute("alter table ref.player_mapping add column if not exists sofascore_player_id text")

    sofa_players = load_sofa_players()
    cur.execute("""select pb.source_player_id, pb.first_name, pb.last_name, pb.full_name, pb.birth_date
                   from football.player_bio pb where pb.source='apifootball'""")
    bio = cur.fetchall()
    cur.execute("select id, apifootball_player_id, player_name, coalesce(sofascore_player_id,'') from ref.player_mapping")
    pm_rows = cur.fetchall()
    pm_by_af = {}
    for rid, af_id, pname, sofa_id in pm_rows:
        if af_id:
            pm_by_af.setdefault(af_id, []).append((rid, pname, sofa_id))

    # bio indexleri
    by_dob_name = {}
    by_dob_last = {}
    for af_id, first, last, full, dob in bio:
        if af_id not in pm_by_af:
            continue  # mapping satiri olmayan bio ilgisiz
        fl = norm(f"{first or ''} {last or ''}")
        if dob and fl:
            by_dob_name.setdefault((dob, fl), set()).add(af_id)
        if dob and last:
            by_dob_last.setdefault((dob, norm(last)), set()).add(af_id)

    updates = {}  # af_id -> (sofa_pid, method, sofa_name)
    for pid, p in sofa_players.items():
        if not p["dob"] or not p["name"]:
            continue
        n = norm(p["name"])
        hits = by_dob_name.get((p["dob"], n))
        method = "dob+fullname"
        if not hits:
            # soyad + dogum tarihi (tam ad kapsiyorsa)
            last_tokens = n.split()
            if last_tokens:
                cand = by_dob_last.get((p["dob"], last_tokens[-1]))
                if cand and len(cand) == 1:
                    hits, method = cand, "dob+lastname"
        if hits and len(hits) == 1:
            af_id = next(iter(hits))
            if af_id in updates and updates[af_id][0] != str(pid):
                print(f"  UYARI cakisan eslesme af={af_id}: {updates[af_id]} vs {pid} {p['name']}")
                continue
            updates[af_id] = (str(pid), method, p["name"])

    print(f"Sofa oyuncu: {len(sofa_players)}, mapping satirina baglanan: {len(updates)}")
    n_meth = {}
    for _af, (_pid, m, _n) in updates.items():
        n_meth[m] = n_meth.get(m, 0) + 1
    print("  yontem dagilimi:", n_meth)
    if not DRY:
        for af_id, (sofa_pid, method, _name) in updates.items():
            cur.execute(
                "update ref.player_mapping set sofascore_player_id=%s where apifootball_player_id=%s and (sofascore_player_id is null or sofascore_player_id=%s)",
                (sofa_pid, af_id, sofa_pid),
            )
        conn.commit()
        print("COMMIT edildi")
    else:
        conn.rollback()
        print("DRY RUN, degisiklik yazilmadi")


if __name__ == "__main__":
    main()
