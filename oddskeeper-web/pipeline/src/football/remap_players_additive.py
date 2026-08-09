# -*- coding: utf-8 -*-
"""ref.player_mapping'i EKLEMELI yeniden koşar (apifootball squad -> opta slug).

Mevcut eslesmelere DOKUNMAZ; yalnizca team_squad_current'ta olup player_mapping'de
olmayan apifootball oyuncularini opta tarafina (analytics.team_squad_v1, 2025/2026)
uc gecisle baglar:
  1. team+name           : ayni team_slug + ayni normalize ad (iki tarafta benzersiz)
  2. unique-name         : lig geneli benzersiz normalize ad (takim degistirenler)
  3. team+surname+initial: ayni team_slug, soyad + ilk harf (iki tarafta benzersiz)

Isim formati iki tarafta da kisaltmali ("T. Çetin") — normalize sonrasi uyumlu.
Yeni transferlerden Opta 2025/2026'da hic oynamamislar dogal olarak baglanmaz.

Dry-run (varsayilan): sadece ne eklenecegini yazar. APPLY=1 ile gercekten yazar.
Elle: APPLY=1 .venv\\Scripts\\python.exe src\\football\\remap_players_additive.py
"""
import os
import re
import sys
import unicodedata
from collections import defaultdict

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

SEASON = os.environ.get("OPTA_SEASON", "2025/2026")
APPLY = os.environ.get("APPLY") == "1"


def norm(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().replace("ı", "i").replace("ø", "o").replace("ß", "ss").replace("đ", "d")
    return re.sub(r"[^a-z0-9 ]", " ", text).strip()


def surname_initial(n):
    toks = norm(n).split()
    if not toks:
        return None
    return (toks[-1], toks[0][0]) if len(toks) >= 2 else (toks[-1], "")


def main():
    load_dotenv()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # aktif TSL team_slug kumesi (squad'daki apifootball takim id'lerinden)
    cur.execute("""
        select distinct tm.team_slug
        from football.team_squad_current s
        join ref.team_mapping tm on tm.source_team_id = s.source_team_id and tm.is_active
        where s.source = 'apifootball'
    """)
    tsl_slugs = {r[0] for r in cur.fetchall()}

    # opta taraf: team_squad_v1 (2025/2026), sadece TSL takimlari
    cur.execute("""
        select team_slug, player_name, player_slug, player_source_id
        from analytics.team_squad_v1
        where season_label = %s
    """, (SEASON,))
    opta = [r for r in cur.fetchall() if r[0] in tsl_slugs]

    # apif taraf: henuz eslesmemis squad oyunculari
    cur.execute("""
        select tm.team_slug, s.player_name, s.source_player_id
        from football.team_squad_current s
        join ref.team_mapping tm on tm.source_team_id = s.source_team_id and tm.is_active
        where s.source = 'apifootball'
          and not exists (select 1 from ref.player_mapping pm
                          where pm.apifootball_player_id = s.source_player_id)
    """)
    apif = cur.fetchall()

    # opta indexleri
    opta_by_team_name = defaultdict(list)
    opta_by_name = defaultdict(list)
    opta_by_team_si = defaultdict(list)
    for team_slug, pname, pslug, pid in opta:
        opta_by_team_name[(team_slug, norm(pname))].append((pslug, pid, pname))
        opta_by_name[norm(pname)].append((team_slug, pslug, pid, pname))
        si = surname_initial(pname)
        if si:
            opta_by_team_si[(team_slug, si)].append((pslug, pid, pname))

    # apif tarafinda benzersizlik kontrolu icin sayaclar
    apif_name_count = defaultdict(int)
    apif_team_name_count = defaultdict(int)
    apif_team_si_count = defaultdict(int)
    for team_slug, pname, pid in apif:
        apif_name_count[norm(pname)] += 1
        apif_team_name_count[(team_slug, norm(pname))] += 1
        si = surname_initial(pname)
        if si:
            apif_team_si_count[(team_slug, si)] += 1

    used_opta = set()
    to_insert = []  # (apif_id, opta_id, opta_slug, name, team_slug, method)
    stats = defaultdict(int)

    def try_map(apif_id, name, team_slug):
        n = norm(name)
        # 1) team+name
        cands = opta_by_team_name.get((team_slug, n), [])
        if len(cands) == 1 and apif_team_name_count[(team_slug, n)] == 1:
            pslug, pid, oname = cands[0]
            if pid not in used_opta:
                return pslug, pid, oname, "team+name"
        # 2) unique-name (lig geneli)
        cands = opta_by_name.get(n, [])
        if len(cands) == 1 and apif_name_count[n] == 1:
            _ts, pslug, pid, oname = cands[0]
            if pid not in used_opta:
                return pslug, pid, oname, "unique-name"
        # 3) team+surname+initial
        si = surname_initial(name)
        if si:
            cands = opta_by_team_si.get((team_slug, si), [])
            if len(cands) == 1 and apif_team_si_count[(team_slug, si)] == 1:
                pslug, pid, oname = cands[0]
                if pid not in used_opta:
                    return pslug, pid, oname, "team+surname+initial"
        return None

    for team_slug, pname, pid in apif:
        res = try_map(pid, pname, team_slug)
        if res:
            pslug, opta_id, oname, method = res
            used_opta.add(opta_id)
            to_insert.append((pid, opta_id, pslug, pname, team_slug, method))
            stats[method] += 1

    print(f"opta taraf (TSL 2025/2026): {len(opta)} | eslesmemis apif squad: {len(apif)}")
    print(f"YENI eslesme: {len(to_insert)}")
    for m, c in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"   {m}: {c}")
    print("--- ornekler ---")
    for pid, oid, pslug, pname, team_slug, method in to_insert[:25]:
        print(f"   [{method:22}] {pname:<22} ({team_slug}) apif={pid} -> opta={pslug}")

    if not APPLY:
        print("\n(DRY-RUN — yazmadi. APPLY=1 ile calistir.)")
        return

    psycopg2.extras.execute_values(
        cur,
        """insert into ref.player_mapping
             (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method)
           values %s
           on conflict (apifootball_player_id) do nothing""",
        [(pid, oid, pslug, pname, team_slug, method)
         for pid, oid, pslug, pname, team_slug, method in to_insert],
    )
    conn.commit()
    print(f"\nYAZILDI: {len(to_insert)} yeni mapping eklendi.")


if __name__ == "__main__":
    sys.exit(main())
