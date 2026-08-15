# -*- coding: utf-8 -*-
"""apifootball oyuncu id'lerini SofaScore oyuncu id'lerine isim+dogum tarihiyle baglar.

Neden: PSM (Player Market) guncel kadroyu apifootball uzayindan alir; opta karsiligi
olmayan yeni transferler `af-<id>` kimligiyle gelir. 2026/27 istatistigi ise SofaScore
zincirindedir (opta ya da sentetik ss-<sofaid>). Bu harita af_player_id -> sofascore_id
koprusunu kurar; ustune sofascore_opta_map ile tsl_ss player_source_id'sine ulasilir.

Kaynaklar (DB, lokal JSON YOK):
  - football.player_bio (source='apifootball'): source_player_id + isim + birth_date
  - football.sofascore_player_info: sofascore_player_id + player_name + birth_date

Eslesme: (birth_date + tam-ad-normalize) once; tutmazsa (birth_date + soyad) TEK ise.
1:1 zorlanir; cakisan/coklu eslesme dusurulur. Idempotent: truncate + rebuild -> Opta/yeni
kaynak geldiginde kendiliginden guncellenir.

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\build_apifootball_sofascore_player_map.py [--dry-run]
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


def norm(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("ı", "i").replace("ł", "l").replace("đ", "d").replace("ø", "o")
    return " ".join("".join(ch if ch.isalnum() or ch == " " else " " for ch in s).split())


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(
        """create table if not exists ref.apifootball_sofascore_player_map (
             apifootball_player_id text primary key,
             sofascore_player_id   text not null,
             player_name           text,
             match_method          text,
             created_at            timestamptz not null default now()
           )"""
    )

    # apifootball bio: yalniz DOB'lu satirlar eslesebilir
    cur.execute(
        """select source_player_id, first_name, last_name, full_name, birth_date
           from football.player_bio where source='apifootball' and birth_date is not null"""
    )
    bio = cur.fetchall()

    # SofaScore oyuncu bilgisi (guncel; DB)
    cur.execute(
        """select sofascore_player_id, player_name, birth_date
           from football.sofascore_player_info where birth_date is not null"""
    )
    sofa = cur.fetchall()

    # SofaScore indeksleri
    sofa_by_dob_name = {}
    sofa_by_dob_last = {}
    for sid, name, dob in sofa:
        n = norm(name)
        if not n:
            continue
        sofa_by_dob_name.setdefault((dob, n), set()).add(str(sid))
        toks = n.split()
        if toks:
            sofa_by_dob_last.setdefault((dob, toks[-1]), set()).add(str(sid))

    updates = {}   # af_id -> (sofa_id, method, name)
    used_sofa = {}  # sofa_id -> af_id (1:1 zorlamasi)
    for af_id, first, last, full, dob in bio:
        fl = norm(f"{first or ''} {last or ''}") or norm(full or "")
        if not fl:
            continue
        method = "dob+fullname"
        hits = sofa_by_dob_name.get((dob, fl))
        if not hits:
            toks = fl.split()
            if toks:
                cand = sofa_by_dob_last.get((dob, toks[-1]))
                if cand and len(cand) == 1:
                    hits, method = cand, "dob+lastname"
        if not hits or len(hits) != 1:
            continue
        sofa_id = next(iter(hits))
        # 1:1: ayni sofa id iki af_id'ye baglanmasin -> ikisini de dusur
        if sofa_id in used_sofa and used_sofa[sofa_id] != af_id:
            updates.pop(used_sofa[sofa_id], None)
            continue
        used_sofa[sofa_id] = af_id
        updates[af_id] = (sofa_id, method, full or fl)

    n_meth = {}
    for _af, (_sid, m, _n) in updates.items():
        n_meth[m] = n_meth.get(m, 0) + 1
    print(f"apifootball bio(DOB'lu): {len(bio)}, sofa oyuncu(DOB'lu): {len(sofa)}")
    print(f"eslesme: {len(updates)}  yontem: {n_meth}")

    if DRY:
        conn.rollback()
        print("DRY RUN, yazilmadi")
        return

    cur.execute("truncate ref.apifootball_sofascore_player_map")
    psycopg2.extras.execute_values(
        cur,
        """insert into ref.apifootball_sofascore_player_map
             (apifootball_player_id, sofascore_player_id, player_name, match_method) values %s
           on conflict (apifootball_player_id) do nothing""",
        [(af, sid, nm, m) for af, (sid, m, nm) in updates.items()],
    )
    conn.commit()
    print(f"COMMIT: {len(updates)} satir yazildi")


if __name__ == "__main__":
    main()
