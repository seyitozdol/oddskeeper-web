# -*- coding: utf-8 -*-
"""FlashScore Super Lig oyuncularini Opta oyuncu id'lerine esler.

Zorluk: Opta isimleri cogunlukla kisaltmali ('F. Pierrot'), FlashScore 'Soyad Ad' (ASCII).
Gecisler:
  1) player_current_info_v1 tam adlariyla (first+last / full_name) token-kumesi esitligi
  2) Opta tam adlariyla token-kumesi esitligi (ör. 'Marco Asensio')
  3) Kisaltmali Opta adiyla soyad + ilk harf; takim eslesirse oncelik, tekilse kabul
  4) >=4 harfli ortak token tekilse
Sonuc: ref.flashscore_player_map (sofascore_player_id NULL'lanabilir; opta_player_id kolonu).

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\build_flashscore_opta_player_map.py [--dry-run]
"""
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")
DRY = "--dry-run" in sys.argv

CHAR_MAP = str.maketrans({"đ": "d", "ð": "d", "ø": "o", "ł": "l", "þ": "th", "ı": "i"})


def norm(s: str) -> str:
    t = unicodedata.normalize("NFKD", s or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower().translate(CHAR_MAP)
    return "".join(ch if ch.isalnum() or ch in " ." else " " for ch in t)


def tokens(name: str) -> tuple:
    return tuple(sorted(t for t in norm(name).replace(".", " ").split() if len(t) > 1))


def team_key(s: str) -> str:
    drop = {"fk", "sk", "as", "spor", "kulubu", "sportif", "faaliyetler", "futbol", "jimnastik", "spor kulubu"}
    words = [w for w in norm(s).replace(".", " ").split() if w not in drop]
    return " ".join(words) or norm(s)


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute("alter table ref.flashscore_player_map alter column sofascore_player_id drop not null")
    cur.execute("alter table ref.flashscore_player_map add column if not exists opta_player_id text")

    def pool(source):
        cur.execute("""
            select d.source_player_id, max(d.player_name), max(d.team_name)
            from football.match_player_stats_details d
            join football.matches m on m.source=d.source and m.source_match_id=d.source_match_id
            where d.source=%s and m.season_label='2025/2026' and m.competition like 'S%%per Lig%%'
            group by 1""", (source,))
        return {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    fs = pool("flashscore")
    opta = pool("opta")
    cur.execute("""select opta_player_id, coalesce(nullif(trim(first_name||' '||last_name),''), full_name, player_name)
                   from analytics.player_current_info_v1 where opta_player_id is not null""")
    info_by_tokens = {}
    for oid, full in cur.fetchall():
        if full and oid in opta:
            info_by_tokens.setdefault(tokens(full), set()).add(oid)

    opta_full_by_tokens = {}
    opta_abbrev = []  # (oid, initial, surname_tokens, team_key)
    for oid, (name, team) in opta.items():
        n = norm(name)
        parts = n.split()
        if parts and parts[0].endswith("."):
            opta_abbrev.append((oid, parts[0][0], tuple(sorted(p for p in parts[1:] if len(p) > 1)), team_key(team)))
        else:
            opta_full_by_tokens.setdefault(tokens(name), set()).add(oid)

    rows, unmatched = [], []
    for fid, (name, team) in fs.items():
        toks = tokens(name)
        tkey = team_key(team)
        hit, method = None, None
        h1 = info_by_tokens.get(toks)
        if h1 and len(h1) == 1:
            hit, method = h1, "info-fullname"
        if not hit:
            h2 = opta_full_by_tokens.get(toks)
            if h2 and len(h2) == 1:
                hit, method = h2, "opta-fullname"
        if not hit:
            # kisaltmali: soyad tokenlari fs tokenlarinin alt-kumesi + kalan fs tokenlardan biri ilk harfle baslar
            cands = []
            for oid, ini, sur, otk in opta_abbrev:
                if sur and set(sur) <= set(toks):
                    rest = set(toks) - set(sur)
                    if any(t.startswith(ini) for t in rest) or not rest:
                        cands.append((oid, otk))
            same_team = [c for c in cands if c[1] == tkey]
            pick = same_team if same_team else cands
            if len({c[0] for c in pick}) == 1:
                hit, method = {pick[0][0]}, "abbrev-surname"
        if not hit:
            long_toks = {t for t in toks if len(t) >= 4}
            cands = {oid for tt, oids in list(opta_full_by_tokens.items()) + list(info_by_tokens.items())
                     for oid in oids if long_toks & {x for x in tt if len(x) >= 4}}
            cands |= {oid for oid, _ini, sur, _otk in opta_abbrev if long_toks & set(sur)}
            if len(cands) == 1:
                hit, method = cands, "shared-token"
        if not hit and toks:
            # fuzzy soyad (transliterasyon: Fayzullaev/Faizullaev) — AYNI TAKIM sarti + tekillik
            cands = set()
            for oid, ini, sur, otk in opta_abbrev:
                # takim eslesmesi: kelime kesisimi yeter (FS 'Basaksehir' vs Opta 'istanbul basaksehir')
                if not sur or not (set(otk.split()) & set(tkey.split())):
                    continue
                rest = set(toks) - set(sur)
                ini_ok = (not rest) or any(t.startswith(ini) for t in toks)
                if ini_ok and any(SequenceMatcher(None, a, b).ratio() >= 0.82
                                  for a in sur for b in toks if len(a) >= 5 and len(b) >= 5):
                    cands.add(oid)
            if len(cands) == 1:
                hit, method = cands, "fuzzy-surname"
        if hit and len(hit) == 1:
            rows.append((fid, next(iter(hit)), name, method))
        else:
            unmatched.append((fid, name, team))

    meth = {}
    for _f, _o, _n, m in rows:
        meth[m] = meth.get(m, 0) + 1
    print(f"FS TSL oyuncu: {len(fs)}, Opta oyuncu: {len(opta)}, eslesen: {len(rows)} {meth}, eslesmeyen: {len(unmatched)}")
    for u in unmatched[:20]:
        print("  eslesmedi:", u)
    if not DRY:
        psycopg2.extras.execute_values(
            cur,
            """insert into ref.flashscore_player_map (flashscore_player_id, opta_player_id, player_name, match_method)
               values %s on conflict (flashscore_player_id) do update
               set opta_player_id=excluded.opta_player_id, match_method=excluded.match_method""",
            rows,
        )
        conn.commit()
        print("COMMIT edildi")
    else:
        conn.rollback()
        print("DRY RUN")


if __name__ == "__main__":
    main()
