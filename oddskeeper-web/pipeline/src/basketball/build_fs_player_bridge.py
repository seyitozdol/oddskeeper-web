"""Geçmiş sezon oyuncu/takımlarına FlashScore id köprüsü — İSİM KULLANMADAN.

fetch_flashscore_bsl.py yeni sezonda oyuncuyu fs_player_id ile tanır. Dönen oyuncuların fs id'si
DB'de yoksa kimlik katmanı isme düşerdi; oysa aynı maçın aynı oyuncusunun FlashScore ve DB
(TBF/excel kökenli) stat satırı aynıdır. Bu script geçmiş sezon dökümünü DB satırlarıyla
istatistik imzası üzerinden eşleyip players.fs_player_id + team_source_ids'i doldurur.

Girdi (DB'ye yazmadan çekilir, düz HTTP):
    python src/basketball/fetch_flashscore_bsl.py --dry-run --all-pages --no-age-window \
        --season-path super-lig-2025-2026 --dump-json data/basketball/fs_2025-2026.json

İmza = takım + süre + sayı + 2/3 sayılık isabet + serbest atış isabet/deneme + asist + toplam
ribaund. FlashScore sağlayıcısı resmi veriden tek tük hücrede sapabildiğinden (2026-09-19: bir maçta
2PA 2≠3, boş OR hücresi) imza en güvenilir kolonlarla dar tutulur; karar oylamayla verilir
(backfill_tbf_player_ids.vote: oyların ≥%90'ı tek slug).

    python src/basketball/build_fs_player_bridge.py data/basketball/fs_2025-2026.json            # rapor
    python src/basketball/build_fs_player_bridge.py data/basketball/fs_2025-2026.json --apply
"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher

import psycopg2
from dotenv import load_dotenv

from backfill_tbf_player_ids import vote
from identity import fuzzy_tier, match_team_slug, name_tokens

SIG = ["seconds_played", "points", "fg2m", "fg3m", "ftm", "fta", "assists", "treb"]
CHECK = ["fg2a", "fg3a", "oreb", "dreb", "turnovers", "steals", "blocks", "fouls_committed"]


def sig(row, team):
    vals = tuple(None if row.get(c) is None else int(row[c]) for c in SIG)
    return None if any(v is None for v in vals) or vals[0] <= 0 else (team,) + vals


def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    dump = json.load(open(args.dump, encoding="utf-8"))
    season = args.season_label

    # takımlar: FlashScore adı → slug (anahtar kelime; DB yazımı yok)
    fs_team = {}
    for m in dump:
        for t in m["team_rows"]:
            fs_team[t["source_team_id"]] = (t["team_name"], match_team_slug(t["team_name"]))
    unmapped = {k: v for k, v in fs_team.items() if not v[1]}
    print(f"FlashScore takim {len(fs_team)} | slug'a baglanan {len(fs_team) - len(unmapped)} | baglanamayan: {unmapped}")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges")
    canon = dict(cur.fetchall())
    cur.execute("select player_slug, player_name, fs_player_id from basketball.players")
    players = {r[0]: {"name": r[1], "fs": r[2]} for r in cur.fetchall()}
    cols = SIG + CHECK
    cur.execute(f"""select player_slug, team_slug, {",".join(cols)} from basketball.player_match_stats
                    where season_label=%s and source <> 'flashscore'""", (season,))
    index, db_row = defaultdict(set), {}
    for r in cur.fetchall():
        row = dict(zip(cols, r[2:]))
        s = sig(row, r[1])
        if s:
            index[s].add(canon.get(r[0], r[0]))
            db_row[s] = row

    pairs, fs_names = [], defaultdict(set)
    agree, n_cmp = Counter(), 0
    for m in dump:
        for r in m["player_rows"]:
            team = fs_team.get(r["source_team_id"], (None, None))[1]
            s = sig(r, team) if team else None
            if not s:
                continue
            hit = index.get(s)
            slug = next(iter(hit)) if hit and len(hit) == 1 else None
            pairs.append((r["fs_player_id"], slug))
            fs_names[r["fs_player_id"]].add(r["player_name"])
            if slug:                                  # veri kalitesi: imza dışı kolonlar da tutuyor mu
                n_cmp += 1
                for c in CHECK:
                    agree[c] += int((r.get(c) or 0) == (db_row[s].get(c) or 0))
    ok, bad = vote(pairs, allow_multi=True)
    n_votes = Counter(fid for fid, slug in pairs if slug and ok.get(fid) == slug)

    # bağımsız sağlama: isimsiz eşleşen çiftin isimleri benziyor mu
    exact = similar = 0
    odd = []
    for fid, slug in ok.items():
        best = None
        for fn in fs_names[fid]:
            for dn in [players[slug]["name"]] + [players[a]["name"] for a, c in canon.items() if c == slug and a in players]:
                a, b = name_tokens(fn), name_tokens(dn)
                if set(a) == set(b):
                    best = "exact"
                    break
                # gevşek benzerlik: ortak token ("Cruz Francisco" ~ "Pako Cruz") ya da yazım farkı
                # ("Koprivnica" ~ "Koprivica", "Mayers" ~ "Myers"). Karar oylamada; bu yalnız sağlama.
                near = any(len(x) >= 4 and len(y) >= 4 and SequenceMatcher(None, x, y).ratio() >= 0.8
                           for x in a for y in b)
                if fuzzy_tier(a, b) or set(a) & set(b) or near:
                    best = best or "similar"
        exact += best == "exact"
        similar += best == "similar"
        if not best:
            odd.append((fid, sorted(fs_names[fid]), slug))
    print(f"oyuncu fs id {len(fs_names)} -> kabul {len(ok)}, ret {len(bad)}")
    print(f"  isim saglamasi: TAM {exact} | benzer {similar} | HIC BENZEMEYEN {len(odd)} {odd[:8]}")
    print(f"  veri kalitesi (imza disi kolonlar, {n_cmp} satir): " + ", ".join(f"{c} %{100 * agree[c] / max(n_cmp, 1):.1f}" for c in CHECK))
    for fid, why in list(bad.items())[:25]:
        print(f"  RET {fid} {sorted(fs_names[fid])}: {why}")

    if not args.apply:
        print("\nRAPOR modu (DB yazilmadi). Yazmak icin --apply.")
        conn.close()
        return
    n = n_extra = 0
    skip = {o[0] for o in odd}                          # ismi hiç benzemeyen eşleşme yazılmaz
    for fid, slug in sorted(ok.items(), key=lambda kv: -n_votes[kv[0]]):     # çok oylu id birincil olur
        if fid in skip:
            continue
        cur.execute("""update basketball.players set fs_player_id=%s, updated_at=now()
                       where player_slug=%s and fs_player_id is null""", (fid, slug))
        if cur.rowcount:
            n += 1
            continue
        cur.execute("select fs_player_id from basketball.players where player_slug=%s", (slug,))
        if cur.fetchone()[0] != fid:                    # kaynağın aynı kişiye verdiği İKİNCİ id
            cur.execute("""insert into basketball.player_source_ids (source, source_player_id, player_slug, source_name)
                           values ('flashscore', %s, %s, %s) on conflict (source, source_player_id) do nothing""",
                        (fid, slug, sorted(fs_names[fid])[0]))
            n_extra += cur.rowcount
    for tid, (name, slug) in fs_team.items():
        if slug:
            cur.execute("""insert into basketball.team_source_ids (source, source_team_id, team_slug, season_label, source_name)
                           values ('flashscore', %s, %s, %s, %s) on conflict (source, source_team_id) do nothing""",
                        (tid, slug, season, name))
    conn.commit()
    conn.close()
    print(f"\nYAZILDI: {n} oyuncu fs id aldi (+{n_extra} ek id), "
          f"{sum(1 for v in fs_team.values() if v[1])} takim id kaydedildi.")


def main():
    ap = argparse.ArgumentParser(description="FlashScore oyuncu id koprusu (istatistik imzasi ile, isimsiz)")
    ap.add_argument("dump")
    ap.add_argument("--season-label", default="2025-2026")
    ap.add_argument("--apply", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
