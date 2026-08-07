# -*- coding: utf-8 -*-
"""FlashScore oyuncu id'lerini SofaScore oyuncu id'lerine esler (TFF 1. Lig).

Isim formatlari: FlashScore 'Soyad Ad' (ASCII), SofaScore 'Ad Soyad' (aksanli).
Eslesme: ayni sezon havuzunda normalize edilmis token-kumesi esitligi;
ikinci gecis: token alt-kumesi tekilse. Sonuc ref.flashscore_player_map'e yazilir.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\build_flashscore_sofa_player_map.py [--dry-run]
"""
import os
import sys
import unicodedata

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DRY = "--dry-run" in sys.argv
# Eslesme yapilacak sezon (canli job guncel sezona bakar). Env ile ezilir.
SEASON = (os.environ.get("FS_MAP_SEASON") or "2026/2027").strip()


CHAR_MAP = str.maketrans({"đ": "d", "ð": "d", "ø": "o", "ł": "l", "þ": "th", "ı": "i"})


def norm_tokens(name: str) -> tuple:
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().translate(CHAR_MAP)
    s = "".join(ch if ch.isalnum() or ch == " " else " " for ch in s)
    return tuple(sorted(t for t in s.split() if len(t) > 1))


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute("""
        create table if not exists ref.flashscore_player_map (
          flashscore_player_id text primary key,
          sofascore_player_id  text not null,
          player_name          text,
          match_method         text,
          created_at           timestamptz default now()
        )""")

    def players(source: str) -> dict:
        cur.execute("""
            select d.source_player_id, max(d.player_name), max(d.team_name)
            from football.match_player_stats_details d
            join football.matches m on m.source=d.source and m.source_match_id=d.source_match_id
            where d.source=%s and m.competition like 'Trendyol 1. Lig%%' and m.season_label=%s
            group by 1""", (source, SEASON))
        return {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    fs = players("flashscore")
    sofa = players("sofascore")
    sofa_by_tokens = {}
    for sid, (name, _team) in sofa.items():
        sofa_by_tokens.setdefault(norm_tokens(name), []).append(sid)

    rows, unmatched = [], []
    used_sofa = set()
    for fid, (name, _team) in fs.items():
        toks = norm_tokens(name)
        hit = sofa_by_tokens.get(toks)
        method = "token-exact"
        if not hit:
            # alt-kume: fs tokenlari sofa isminin alt-kumesi (veya tersi), tekilse
            cands = [sid for t, sids in sofa_by_tokens.items()
                     for sid in sids
                     if toks and t and (set(toks) <= set(t) or set(t) <= set(toks))]
            if len(set(cands)) == 1:
                hit, method = list(set(cands)), "token-subset"
        if not hit:
            # gevsek gecis: >=4 harfli ortak token (tipik soyad) tekilse
            long_toks = {t for t in toks if len(t) >= 4}
            cands = {sid for t, sids in sofa_by_tokens.items()
                     for sid in sids if long_toks & {x for x in t if len(x) >= 4}}
            if len(cands) == 1:
                hit, method = list(cands), "shared-token"
        if hit and len(hit) == 1:
            rows.append((fid, hit[0], name, method))
            used_sofa.add(hit[0])
        else:
            unmatched.append((fid, name, len(hit or [])))

    n_exact = sum(1 for r in rows if r[3] == "token-exact")
    print(f"[{SEASON}] FS oyuncu: {len(fs)}, Sofa oyuncu: {len(sofa)}, eslesen: {len(rows)} (exact {n_exact}, subset {len(rows)-n_exact}), eslesmeyen: {len(unmatched)}")
    for u in unmatched[:15]:
        print("  eslesmedi:", u)
    if not DRY:
        psycopg2.extras.execute_values(
            cur,
            """insert into ref.flashscore_player_map (flashscore_player_id, sofascore_player_id, player_name, match_method)
               values %s on conflict (flashscore_player_id) do update
               set sofascore_player_id=excluded.sofascore_player_id, match_method=excluded.match_method""",
            rows,
        )
        conn.commit()
        print("COMMIT edildi")
    else:
        conn.rollback()
        print("DRY RUN")


if __name__ == "__main__":
    main()
