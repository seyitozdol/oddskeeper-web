"""excel_v38 kökenli oyuncu/takımlara tbf id backfill'i — İSİM KULLANMADAN.

Girdi: fetch_tbf_bsl.py'nin GEÇMİŞ sezon dökümü (DB'ye yazmadan):
    xvfb-run -a $VENV src/basketball/fetch_tbf_bsl.py --league-id 20728 --season-id 172 \
        --season-label 2025-2026 --dry-run --dump-json /tmp/tbf_2025-2026.json

Yöntem: TBF box-score satırı ile DB'deki excel_v38 satırı AYNI maçın AYNI oyuncusuysa
istatistik imzaları (süre + 13 sayaç) birebir aynıdır. Önce takımlar çözülür, sonra
oyuncu imzasına takım da katılır (birkaç saniyelik boş satırların çakışmasını keser).
Sezon genelinde imza → DB slug eşlemesi kurulur, her tbf_player_id için oy sayılır.
Tarih KULLANILMAZ (excel match_date'lerinde gün/ay takası var), isim KULLANILMAZ
(üç kaynakta üç farklı yazım).

Kabul: oyların ≥%90'ı tek kanonik slug'a gidiyor VE (oy ≥ 3, ya da oybirliği + oy ≥ 2,
ya da oyuncunun imzalı maçlarının tamamı). Bir slug'a iki tbf id talipse ikisi de
reddedilir (rapora düşer).

    python src/basketball/backfill_tbf_player_ids.py /tmp/tbf_2025-2026.json            # rapor
    python src/basketball/backfill_tbf_player_ids.py /tmp/tbf_2025-2026.json --apply    # yaz
"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict

import psycopg2
from dotenv import load_dotenv

# Faul kolonlari imzada YOK: excel_v38 verisinde fouls_committed <-> fouls_drawn yer degistirmis
# (2026-09-19 olcumu: diger 14 kolon 4691/4691 birebir, faul kolonlari yalniz takasla tutuyor).
P_SIG = ["seconds_played", "points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
         "assists", "turnovers", "steals", "blocks"]
T_SIG = ["points", "opp_points", "fg2m", "fg2a", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb",
         "assists", "turnovers", "steals", "blocks"]


def sig(row, cols):
    vals = tuple(None if row.get(c) is None else int(row[c]) for c in cols)
    return None if any(v is None for v in vals) else vals


def vote(pairs, min_votes=3, min_share=0.9, allow_multi=False):
    """pairs: [(source_id, slug|None)] → (accepted {id: slug}, rejected {id: neden}).

    allow_multi: bir slug'a birden çok id talip olabilir (kaynak aynı kişiye iki id vermişse)."""
    by_id = defaultdict(list)
    for sid, slug in pairs:
        by_id[sid].append(slug)
    accepted, rejected = {}, {}
    for sid, slugs in by_id.items():
        hits = Counter(s for s in slugs if s)
        if not hits:
            rejected[sid] = "imza DB'de yok"
            continue
        slug, n = hits.most_common(1)[0]
        if n / sum(hits.values()) < min_share:
            rejected[sid] = f"oy dagiliyor {dict(hits)}"
        elif n < min_votes and n < len(slugs) and not (len(hits) == 1 and n >= 2):
            rejected[sid] = f"az oy ({n}/{len(slugs)})"
        else:
            accepted[sid] = slug
    claimed = Counter(accepted.values())
    for sid, slug in list(accepted.items()):
        if claimed[slug] > 1 and not allow_multi:
            rejected[sid] = f"slug'a birden cok id talip: {slug}"
            del accepted[sid]
    return accepted, rejected


def run(args):
    sys.stdout.reconfigure(encoding="utf-8")
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    dump = json.load(open(args.dump, encoding="utf-8"))
    season = args.season_label

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("select alias_slug, canonical_slug from analytics.bb_pm_player_merges")
    canon = dict(cur.fetchall())

    cur.execute(f"""select player_slug, team_slug, {",".join(P_SIG)} from basketball.player_match_stats
                    where season_label=%s and tbf_player_id is null""", (season,))
    p_index = defaultdict(set)
    for r in cur.fetchall():
        s = sig(dict(zip(P_SIG, r[2:])), P_SIG)
        if s and s[0] > 0:                       # 0 sn oynayanların imzası ayırt etmez
            p_index[(r[1],) + s].add(canon.get(r[0], r[0]))
    cur.execute(f"""select team_slug, {",".join(T_SIG)} from basketball.team_match_stats
                    where season_label=%s and tbf_team_id is null""", (season,))
    t_index = defaultdict(set)
    for r in cur.fetchall():
        s = sig(dict(zip(T_SIG, r[1:])), T_SIG)
        if s:
            t_index[s].add(r[0])

    def lookup(index, s):
        hit = index.get(s) if s else None
        return next(iter(hit)) if hit and len(hit) == 1 else None   # çakışan imza oy vermez

    t_pairs, t_name = [], {}
    for m in dump:
        for r in m["team_rows"]:
            t_pairs.append((r["tbf_team_id"], lookup(t_index, sig(r, T_SIG))))
            t_name[r["tbf_team_id"]] = r["team_name"]
    t_ok, t_bad = vote(t_pairs)

    p_pairs, p_name = [], {}
    for m in dump:
        for r in m["player_rows"]:
            s, team = sig(r, P_SIG), t_ok.get(r.get("team_id"))
            if s and s[0] > 0 and team:
                p_pairs.append((r["tbf_player_id"], lookup(p_index, (team,) + s)))
                p_name[r["tbf_player_id"]] = r["player_name"]
    p_ok, p_bad = vote(p_pairs)
    print(f"dokum: {len(dump)} mac | oyuncu id {len(p_name)} -> kabul {len(p_ok)}, ret {len(p_bad)}")
    print(f"              takim  id {len(t_name)} -> kabul {len(t_ok)}, ret {len(t_bad)}")
    for tid, slug in sorted(t_ok.items(), key=lambda x: x[1]):
        print(f"  takim {tid:>7} '{t_name[tid]}' -> {slug}")
    for sid, why in p_bad.items():
        print(f"  RET oyuncu {sid} '{p_name.get(sid)}': {why}")
    for tid, why in t_bad.items():
        print(f"  RET takim {tid} '{t_name.get(tid)}': {why}")

    if not args.apply:
        print("\nRAPOR modu (DB yazilmadi). Yazmak icin --apply.")
        conn.close()
        return
    n_p = n_t = 0
    for sid, slug in p_ok.items():
        cur.execute("""update basketball.players set tbf_player_id=%s, updated_at=now()
                       where player_slug=%s and tbf_player_id is null""", (sid, slug))
        n_p += cur.rowcount
    for tid, slug in t_ok.items():
        cur.execute("""update basketball.teams set tbf_team_id=%s, updated_at=now()
                       where team_slug=%s and tbf_team_id is null""", (tid, slug))
        n_t += cur.rowcount
    conn.commit()
    conn.close()
    print(f"\nYAZILDI: {n_p} oyuncu, {n_t} takim tbf id aldi.")


def main():
    ap = argparse.ArgumentParser(description="tbf id backfill (istatistik imzasi ile, isimsiz)")
    ap.add_argument("dump", help="fetch_tbf_bsl.py --dump-json ciktisi")
    ap.add_argument("--season-label", default="2025-2026")
    ap.add_argument("--apply", action="store_true")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
