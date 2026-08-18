# -*- coding: utf-8 -*-
"""Kadro (apifootball) oyuncularini bridged football profillerine baglar.

SORUN SINIFI: takim profili Squad sekmesi ref.player_mapping (af -> opta/ss)
uzerinden link kurar; satir yoksa oyuncu bos bir apifootball-slug profiline
duser (or. 'I. Fakili' af446824 -> i-fakili--af446824, verisi ise
ilhan-fakili--ss1858278'te). DOB-dogrulamali af<->sofascore koprusu
(apifootball_sofascore_player_map) view seviyesinde zaten canli deneniyor
(sql/2026-08-18_squad_profile_af_sofa_fallback.sql); bu script o kopruye
GIRMEYEN oyunculari AD + AYNI TAKIM ile esler:

  - af adi kisaltmali ('I. Fakili'): soyad tokenlari aday tam-ad tokenlarinin
    alt kumesi + bas harf uyusan bir token varsa ve AYNI TAKIMDA TEK adaysa esle.
  - af adi tam: normalize token kumesi birebir esit + ayni takimda tek aday.

Guvenlik: yalniz TSL-baglantili (team_slug dolu) bridged profiller aday olur
(kupa-only yabancilarla ad cakismasi imkansizlasir); af id VE opta id
player_mapping'te zaten varsa dokunulmaz. Idempotent; her kadro tazelemesi
(fetch_apifootball_squads / transfer penceresi) sonrasi tekrar kosulabilir.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\bridge_squad_player_mapping.py [--dry-run]
Sonrasinda team_current_squad_profile_mat tazelenmeli (script sonda tazeler).
"""
import sys
import unicodedata
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


def tokens(name: str) -> list:
    return [t for t in norm(name).replace(".", " . ").split() if t]


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()

    # Profili kopuk kadro oyunculari (slug bridged'de yok, af koprusu de yok)
    cur.execute("""
        select t.team_slug, t.af_player_id, t.player_name
        from analytics.team_current_squad_profile_v1 t
        where t.opta_player_id is null
          and t.af_player_id is not null
          and not exists (select 1 from analytics.player_profile_bridged_v1 b
                          where b.player_slug = t.player_slug)
    """)
    broken = cur.fetchall()

    # Adaylar: TSL-baglantili bridged profiller (takim bazli gruplu)
    cur.execute("""
        select team_slug, player_source_id, player_slug, player_name
        from analytics.player_profile_bridged_v1
        where team_slug is not null
    """)
    by_team = {}
    for tslug, pid, pslug, pname in cur.fetchall():
        by_team.setdefault(tslug, []).append((pid, pslug, pname, set(tokens(pname))))

    # Zaten esli af kimlikleri (cift kayit uretme). Ayni opta'nin IKINCI bir af
    # id'ye baglanmasi SERBEST: ayni oyuncunun tm/native iki af id'si olabilir
    # (2026-08-16 bridge backfill emsali); af-uzayinda unique oldugumuz yeter.
    cur.execute("select apifootball_player_id from ref.player_mapping")
    mapped_af = {r[0] for r in cur.fetchall()}

    rows, ambiguous = [], []
    for team_slug, af_id, af_name in broken:
        if af_id in mapped_af:
            continue
        cands_pool = by_team.get(team_slug, [])
        toks = tokens(af_name)
        if not toks or not cands_pool:
            continue
        if len(toks) >= 2 and toks[1] == ".":
            initial = toks[0]
            surnames = {t for t in toks[2:] if t != "."}
        else:
            initial = None
            surnames = None
        hits = []
        for pid, pslug, pname, ptoks in cands_pool:
            if initial is not None and surnames:
                # kisaltmali: soyadlar alt kume + bas harf uyumu
                if surnames <= ptoks and any(t.startswith(initial) for t in ptoks - surnames):
                    hits.append((pid, pslug, pname))
            else:
                # tam ad: token kumesi birebir
                if set(t for t in toks if t != ".") == ptoks:
                    hits.append((pid, pslug, pname))
        uniq = {h[0] for h in hits}
        if len(uniq) == 1:
            pid, pslug, pname = hits[0]
            sofa_id = pid[2:] if pid.startswith("ss") else None
            rows.append((af_id, pid, pslug, pname, team_slug,
                         "bridge:af-abbrev-team", sofa_id))
        elif len(uniq) > 1:
            ambiguous.append((af_name, team_slug, sorted(uniq)))

    print(f"kopuk kadro oyuncusu: {len(broken)}, eslenen: {len(rows)}, "
          f"cok-adayli (atlandi): {len(ambiguous)}")
    for r in rows[:30]:
        print(f"  + {r[4]:>15} af{r[0]} -> {r[2]} ({r[3]})")
    if len(rows) > 30:
        print(f"  ... (+{len(rows)-30})")
    for a in ambiguous[:5]:
        print("  ? cok aday:", a)

    if DRY or not rows:
        conn.rollback()
        print("DRY RUN / eklenecek satir yok" if DRY else "eklenecek satir yok")
        return

    psycopg2.extras.execute_values(
        cur,
        """insert into ref.player_mapping
             (apifootball_player_id, opta_player_id, opta_player_slug, player_name,
              team_slug, match_method, sofascore_player_id)
           values %s
           on conflict (apifootball_player_id) do nothing""",
        rows,
    )
    conn.commit()
    print(f"COMMIT: {len(rows)} kopru satiri eklendi")
    cur.execute("refresh materialized view analytics.team_current_squad_profile_mat")
    conn.commit()
    print("team_current_squad_profile_mat tazelendi")
    conn.close()


if __name__ == "__main__":
    main()
