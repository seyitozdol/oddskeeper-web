# -*- coding: utf-8 -*-
"""SofaScore Super Lig oyuncularini Opta oyuncu id'lerine esler.

FS esleyicisiyle ayni gecisler (build_flashscore_opta_player_map.py); fark: SofaScore
isimleri 'Ad Soyad' ve aksanli. Sonuc: ref.sofascore_opta_player_map.

Calistirma (TSL sofascore verisi yuklendikten sonra):
  .venv\\Scripts\\python.exe src\\football\\build_sofascore_opta_player_map.py [--dry-run]
"""
import os
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

# Opta karsiligi olmayan oyuncuya verilen sentetik player_source_id oneki.
# Gercek Opta id'leri 24-25 karakterli alnum oldugu icin cakisma yok.
SYNTH_PREFIX = "ss"


def norm(s: str) -> str:
    t = unicodedata.normalize("NFKD", s or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower().translate(CHAR_MAP)
    return "".join(ch if ch.isalnum() or ch in " ." else " " for ch in t)


def tokens(name: str) -> tuple:
    return tuple(sorted(t for t in norm(name).replace(".", " ").split() if len(t) > 1))


def team_key(s: str) -> str:
    drop = {"fk", "sk", "as", "jk", "spor", "kulubu", "sportif", "faaliyetler", "futbol", "jimnastik"}
    words = [w for w in norm(s).replace(".", " ").split() if w not in drop]
    return " ".join(words) or norm(s)


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute("""
        create table if not exists ref.sofascore_opta_player_map (
          sofascore_player_id text primary key,
          opta_player_id text not null,
          player_name text,
          match_method text,
          created_at timestamptz default now()
        )""")

    def pool(source, comp_filter="m.competition like 'S%%per Lig%%'"):
        cur.execute(f"""
            select d.source_player_id, max(d.player_name), max(d.team_name)
            from football.match_player_stats_details d
            join football.matches m on m.source=d.source and m.source_match_id=d.source_match_id
            where d.source=%s and {comp_filter}
            group by 1""", (source,))
        return {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    sofa = pool("sofascore")
    opta = pool("opta")
    cur.execute("""select opta_player_id, coalesce(nullif(trim(first_name||' '||last_name),''), full_name, player_name)
                   from analytics.player_current_info_v1 where opta_player_id is not null""")
    info_by_tokens = {}
    for oid, full in cur.fetchall():
        if full and oid in opta:
            info_by_tokens.setdefault(tokens(full), set()).add(oid)

    opta_full_by_tokens = {}
    opta_abbrev = []
    for oid, (name, team) in opta.items():
        parts = norm(name).split()
        if parts and parts[0].endswith("."):
            opta_abbrev.append((oid, parts[0][0], tuple(sorted(p for p in parts[1:] if len(p) > 1)), team_key(team)))
        else:
            opta_full_by_tokens.setdefault(tokens(name), set()).add(oid)

    # token frekanslari (shared-token gecisi icin)
    src_tok_freq = {}
    for _sid, (name, _team) in sofa.items():
        for tk in set(tokens(name)):
            src_tok_freq[tk] = src_tok_freq.get(tk, 0) + 1
    tgt_tok_freq = {}
    for tt, oids in list(opta_full_by_tokens.items()) + list(info_by_tokens.items()):
        for tk in set(tt):
            tgt_tok_freq[tk] = tgt_tok_freq.get(tk, 0) + len(oids)
    for _oid, _ini, sur, _otk in opta_abbrev:
        for tk in set(sur):
            tgt_tok_freq[tk] = tgt_tok_freq.get(tk, 0) + 1

    rows, unmatched = [], []
    for sid, (name, team) in sofa.items():
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
            cands = []
            for oid, ini, sur, otk in opta_abbrev:
                if sur and set(sur) <= set(toks):
                    rest = set(toks) - set(sur)
                    if any(t.startswith(ini) for t in rest) or not rest:
                        cands.append((oid, otk))
            same_team = [c for c in cands if set(c[1].split()) & set(tkey.split())]
            pick = same_team if same_team else cands
            if len({c[0] for c in pick}) == 1:
                hit, method = {pick[0][0]}, "abbrev-surname"
        if not hit:
            # ortak token: SADECE her iki havuzda da benzersiz tokenlar (gercek ayirt edici
            # soyadlar); 'mehmet'/'eren' gibi yaygin on adlar frekans>1 oldugundan elenir
            long_toks = {t for t in toks if len(t) >= 5
                         and src_tok_freq.get(t, 0) == 1 and tgt_tok_freq.get(t, 0) == 1}
            cands = {oid for tt, oids in list(opta_full_by_tokens.items()) + list(info_by_tokens.items())
                     for oid in oids if long_toks & set(tt)}
            cands |= {oid for oid, _i, sur, _o in opta_abbrev if long_toks & set(sur)}
            if len(cands) == 1:
                hit, method = cands, "shared-token"
        if not hit and toks:
            cands = set()
            for oid, ini, sur, otk in opta_abbrev:
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
            rows.append((sid, next(iter(hit)), name, method))
        else:
            unmatched.append((sid, name, team))

    # 1:1 zorlamasi: ayni opta id'ye birden fazla eslesme varsa en guclu yontem kazanir;
    # ayni guclukte birden fazlaysa hepsi dusurulur (yanlis birlesmeden iyidir)
    PRIORITY = {"info-fullname": 0, "opta-fullname": 1, "abbrev-surname": 2, "fuzzy-surname": 3, "shared-token": 4}
    by_opta = {}
    for r in rows:
        by_opta.setdefault(r[1], []).append(r)
    resolved = []
    for oid, group in by_opta.items():
        if len(group) == 1:
            resolved.append(group[0])
            continue
        group.sort(key=lambda r: PRIORITY[r[3]])
        best_p = PRIORITY[group[0][3]]
        tied = [r for r in group if PRIORITY[r[3]] == best_p]
        if len(tied) == 1:
            resolved.append(tied[0])
            print(f"  CAKISMA cozuldu opta={oid}: kalan={tied[0][2]}, dusen={[r[2] for r in group[1:]]}")
        else:
            print(f"  CAKISMA cozulemedi opta={oid}: hepsi dusuruldu {[r[2] for r in group]}")
    rows = resolved

    # SENTETIK KIMLIK: Opta karsiligi OLMAYAN oyuncu (yeni transfer, yukselen takim,
    # cakismada dusen) haritadan DUSURULMEZ. Tum tsl_ss view'lari bu haritaya inner
    # join yaptigi icin haritada olmayan oyuncu sitede tamamen kaybolur (2026-08-14
    # Galatasaray-Corum: Corum'un iki golcusu Opta'da olmadigi icin goller yok olmustu).
    # Deterministik 'ss<sofascore_id>' verilir; harita her kosuda sifirdan kuruldugundan
    # Opta ilerde gercek id verirse sentetik kendiliginden gercegiyle degisir.
    covered = {r[0] for r in rows}
    synthetic = [(sid, SYNTH_PREFIX + sid, name, "synthetic")
                 for sid, (name, _team) in sofa.items() if sid not in covered]
    rows.extend(synthetic)

    # KUPA (opta yok): Avrupa kupalarinda oynayip Super Lig'de OLMAYAN oyuncular
    # (kupa-only yabanci) -> sentetik ss id (tek-profil birlestirmesi icin kimlik).
    # Super Lig'de de oynayan oyuncunun sofa id'si AYNI (SofaScore global tek id) ->
    # zaten yukarida esli/sentetik. tsl_ss + Super Lig bridge competition-filtreli
    # oldugundan bu satirlar mevcut Super Lig yuzeylerini ETKILEMEZ (yalniz kupa
    # bridge'i genisleyince aktif olur).
    sofa_cup = pool("sofascore",
                    "m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')")
    covered_all = {r[0] for r in rows}
    cup_syn = [(sid, SYNTH_PREFIX + sid, name, "synthetic")
               for sid, (name, _t) in sofa_cup.items() if sid not in covered_all]
    rows.extend(cup_syn)
    print(f"kupa-only sentetik eklendi: {len(cup_syn)}")

    meth = {}
    for _s, _o, _n, m in rows:
        meth[m] = meth.get(m, 0) + 1
    print(f"Sofa TSL oyuncu: {len(sofa)}, Opta: {len(opta)}, eslesen: {len(rows)} {meth}, "
          f"opta-esi yok (sentetik): {len(synthetic)}")
    for u in unmatched[:15]:
        print("  opta esi yok:", u)
    if not rows:
        print("UYARI: hic satir uretilmedi, harita KORUNDU (yazma atlandi)")
        conn.rollback()
        return
    if not DRY:
        cur.execute("truncate ref.sofascore_opta_player_map")
        psycopg2.extras.execute_values(
            cur,
            """insert into ref.sofascore_opta_player_map (sofascore_player_id, opta_player_id, player_name, match_method)
               values %s on conflict (sofascore_player_id) do update
               set opta_player_id=excluded.opta_player_id, match_method=excluded.match_method""",
            rows,
        )
        conn.commit()
        print("COMMIT edildi")
        # Kimlik haritasi degisince bagimli tsl_ss mat'lari bayatlar; harita
        # sonradan eklenen oyuncu (or. Kerem) rankings/leaderboard'dan kaybolur.
        # Harita yazilir yazilmaz mat'lari bagimlilik sirasiyla tazele.
        # H1 (mukerrer refresh): match_scrape turunda bu builder adim 3b'de cagriliyor;
        # mat'lari orada wrapper adim 4'un orkestratoru (refresh_orchestrator.py,
        # DEFER_MATS=1) tazeler, buradaki ic refresh atlanir. DEFER_TSL_MATS eski
        # bayrak, gecis uyumu icin korunur. Bayrak yoksa (04:00 run_fs_player_map.sh,
        # elle kosu) bu ic refresh tek tazeleme oldugu icin eskisi gibi kosar.
        if os.environ.get("DEFER_MATS") or os.environ.get("DEFER_TSL_MATS"):
            print("[mat] tsl_ss refresh caller'a (orkestrator) ertelendi (DEFER_MATS/DEFER_TSL_MATS)")
        else:
            try:
                import importlib
                importlib.import_module("refresh_tsl_mats").main()
                print("[mat] tsl_ss mat'lar harita sonrasi tazelendi")
            except SystemExit as e:  # bazi mat patlasa da harita yazildi
                print(f"UYARI: bazi mat tazelenemedi: {e}")
            except Exception as e:  # noqa
                print(f"UYARI: mat refresh atlandi: {e}")
    else:
        conn.rollback()
        print("DRY RUN")


if __name__ == "__main__":
    main()
