# -*- coding: utf-8 -*-
"""Mac-sonrasi tutarlilik denetimi: skor <-> oyuncu verisi <-> kimlik haritasi.

2026-08-14 Galatasaray-Corum'da mac 2-2 bitti ama sitede yalniz Osimhen'in 2 golu
gorundu: Corum'un iki golcusunun Opta karsiligi olmadigi icin kimlik haritasindan
dusmuslerdi ve tum tsl_ss view'lari haritaya inner join yaptigindan yok oldular.
Bu script ayni sinif arizayi ERKEN yakalar. Uc kontrol (son GUN_SAYISI gun):
  1) ham oyuncu verisi hic gelmis mi (kadro sayisi makul mu)
  2) ham gol toplami mac skoruna esit mi (kendi golu haric tutulamaz -> tolerans)
  3) kimlik haritasindan gecen gol toplami ham gol toplamina esit mi  <-- asil kapi

Cikti: sorun yoksa 'OK', varsa satir satir UYARI ve exit 1 (cron logunda gorunur).

Calistirma:
  .venv\\Scripts\\python.exe src\\football\\check_match_coverage.py [--days 3]
"""
import sys
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")

DAYS = 3
if "--days" in sys.argv:
    DAYS = int(sys.argv[sys.argv.index("--days") + 1])

SQL = """
with recent as (
    select m.id, m.source, m.source_match_id, m.competition, m.match_datetime,
           m.home_team_name, m.away_team_name,
           coalesce(m.home_score, 0) + coalesce(m.away_score, 0) as total_goals
    from football.matches m
    where m.source = 'sofascore'
      and m.match_datetime >= now() - make_interval(days => %s)
      and m.match_datetime < now()
      and m.home_score is not null
), agg as (
    select r.*,
           count(d.id) as player_rows,
           coalesce(sum((d.raw_stats ->> 'goals')::int), 0) as raw_goals,
           coalesce(sum((d.raw_stats ->> 'goals')::int)
                    filter (where pmap.opta_player_id is not null), 0) as mapped_goals
    from recent r
    left join football.match_player_stats_details d
           on d.source = r.source and d.source_match_id = r.source_match_id
    left join ref.sofascore_opta_player_map pmap
           on pmap.sofascore_player_id = d.source_player_id
    group by r.id, r.source, r.source_match_id, r.competition, r.match_datetime,
             r.home_team_name, r.away_team_name, r.total_goals
)
select * from agg order by match_datetime
"""


def main():
    conn = psycopg2.connect(ENV["DATABASE_URL"].strip().strip('"'))
    cur = conn.cursor()
    cur.execute(SQL, (DAYS,))
    rows = cur.fetchall()
    conn.close()

    problems = []
    for (_id, _src, smid, comp, dt, home, away, total_goals,
         player_rows, raw_goals, mapped_goals) in rows:
        label = f"{dt:%Y-%m-%d %H:%M} {comp} {home}-{away} (sofascore {smid})"
        if player_rows < 20:
            problems.append(f"UYARI oyuncu verisi eksik ({player_rows} satir): {label}")
            continue
        # Kendi kalesine gol oyuncuya 'goals' olarak yazilmaz -> ham toplam skordan
        # AZ olabilir; FAZLA olmasi ya da hic gol olmamasi anormal.
        if raw_goals > total_goals or (total_goals > 0 and raw_goals == 0):
            problems.append(
                f"UYARI ham gol {raw_goals} != skor {total_goals}: {label}")
        # 3. kontrol yalniz Super Lig icin: tsl_ss zinciri oyuncuyu opta id'sine gore
        # toplar (ref.sofascore_opta_player_map'e inner join). 1. Lig zinciri (tff1_*)
        # dogrudan sofascore id kullanir, harita devrede degil.
        if comp.startswith("Süper Lig") and mapped_goals != raw_goals:
            problems.append(
                f"UYARI kimlik haritasi gol dusuruyor (haritali {mapped_goals} / ham "
                f"{raw_goals}): {label} -> build_sofascore_opta_player_map.py kos")

    print(f"denetlenen mac: {len(rows)} (son {DAYS} gun)")
    for p in problems:
        print(" ", p)
    if problems:
        raise SystemExit(1)
    print("OK")


if __name__ == "__main__":
    main()
