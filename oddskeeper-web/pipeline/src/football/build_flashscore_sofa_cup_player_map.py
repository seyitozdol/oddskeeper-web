# -*- coding: utf-8 -*-
"""FlashScore -> SofaScore kupa OYUNCU id haritasi.

Avrupa kupalarinda SofaScore 2026/2027'de xG (ve bazi metrikleri) vermiyor;
FlashScore veriyor (fetch_flashscore_cup_matches yaziyor, source='flashscore').
Kupa sezon view'lari sofascore-keyed oldugundan FS xG'yi SofaScore oyuncu id'sine
baglamak gerek. Bu script ref.flashscore_sofa_match_map'teki her eslesmis mac icin
FS oyuncularini SofaScore oyuncularina AD ile (mac ici, token bazli) esler ->
ref.flashscore_sofa_cup_player_map (flashscore_player_id -> sofascore_player_id).

tff1'deki build_flashscore_sofa_player_map deseninin kupa surumu; ama sezon-geneli
yerine MAC-ICI hizalama (kucuk kadro, daha guvenilir). Bir FS oyuncusu birden cok
macta -> en cok oy alan sofascore id'ye atanir.

Idempotent. Calistirma: python src/football/build_flashscore_sofa_cup_player_map.py [--dry]
"""
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DSN = (ENV.get("DATABASE_URL") or "").strip().strip('"')
DRY = "--dry" in sys.argv

DDL = """
create table if not exists ref.flashscore_sofa_cup_player_map (
  flashscore_player_id text primary key,
  sofascore_player_id  text not null,
  player_name          text,
  match_method         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
grant select on ref.flashscore_sofa_cup_player_map to anon, authenticated, service_role;
"""


def toks(name):
    s = (name or "")
    for a, b in (("ı", "i"), ("İ", "i"), ("ø", "o"), ("Ø", "o"), ("ł", "l"),
                 ("đ", "d"), ("Đ", "d")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return set(t for t in re.split(r"[^a-z0-9]+", s) if len(t) > 1)


def score(fa, sa):
    """Iki token seti arasi benzerlik 0..1 + uzun (soyad) ortak token sarti."""
    if not fa or not sa:
        return 0.0
    inter = fa & sa
    if not inter:
        return 0.0
    if not any(len(t) >= 3 for t in inter):  # en az bir soyad-benzeri ortak token
        return 0.0
    return len(inter) / max(len(fa), len(sa))


def align_match(sofa_players, fs_players):
    """Mac ici: FS oyuncu -> SofaScore oyuncu (greedy, en yuksek skor once, teklik).
    sofa_players/fs_players: [(id, name)]. Doner {fs_id: (sofa_id, name, score)}."""
    pairs = []
    for fid, fname in fs_players:
        ft = toks(fname)
        for sid, sname in sofa_players:
            sc = score(ft, toks(sname))
            if sc >= 0.5:
                pairs.append((sc, fid, sid, sname))
    pairs.sort(reverse=True, key=lambda x: x[0])
    used_f, used_s, out = set(), set(), {}
    for sc, fid, sid, sname in pairs:
        if fid in used_f or sid in used_s:
            continue
        used_f.add(fid); used_s.add(sid)
        out[fid] = (sid, sname, sc)
    return out


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(DDL)

    cur.execute("select sofascore_match_id, flashscore_match_id from ref.flashscore_sofa_match_map")
    match_map = cur.fetchall()
    print(f"eslesmis mac: {len(match_map)}", flush=True)

    # Her FS oyuncusu -> aday sofascore id'leri (oy + en iyi skor + ad).
    votes = defaultdict(Counter)
    best = {}  # fs_id -> (sofa_id, name, score)
    for sofa_id, fs_id in match_map:
        cur.execute("""select source_player_id, player_name from football.match_player_stats_details
                       where source='sofascore' and source_match_id=%s""", (sofa_id,))
        sofa_players = cur.fetchall()
        cur.execute("""select source_player_id, player_name from football.match_player_stats_details
                       where source='flashscore' and source_match_id=%s""", (fs_id,))
        fs_players = cur.fetchall()
        if not sofa_players or not fs_players:
            continue
        for fid, (sid, sname, sc) in align_match(sofa_players, fs_players).items():
            votes[fid][sid] += 1
            if fid not in best or sc > best[fid][2]:
                best[fid] = (sid, sname, sc)

    rows = []
    for fid, ctr in votes.items():
        sid = ctr.most_common(1)[0][0]  # en cok oy alan sofascore id
        name = best[fid][1] if best[fid][0] == sid else None
        rows.append((fid, sid, name, "match-name-align"))
    print(f"eslesme (fs oyuncu): {len(rows)}", flush=True)
    if DRY:
        for r in rows[:10]:
            print("  ", r)
        print("[dry] yazilmadi")
        return
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        args = ",".join(cur.mogrify("(%s,%s,%s,%s,now())", r).decode() for r in chunk)
        cur.execute(f"""insert into ref.flashscore_sofa_cup_player_map
            (flashscore_player_id, sofascore_player_id, player_name, match_method, updated_at)
            values {args}
            on conflict (flashscore_player_id) do update set
              sofascore_player_id=excluded.sofascore_player_id,
              player_name=excluded.player_name,
              match_method=excluded.match_method,
              updated_at=now()""")
    print(f"upsert edildi: {len(rows)}", flush=True)


if __name__ == "__main__":
    main()
