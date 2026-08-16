# -*- coding: utf-8 -*-
"""Mapping/identity SAGLIK DENETIMI — tum branslarda 'veri sessizce dusuyor mu?'

Her hafta (cron) kosar; kimlik/mapping bosluklarini sayar. Bir HIGH bosluk > 0 ise
exit code 1 doner (alarm). Amac: goz ile hata ayiklamayi bitirmek — yeni bir
yukselen takim / transfer / kaynak-id eslenmeden dusmeye baslarsa burada yakalanir.

READ-ONLY: yalnizca SELECT. Elle: .venv\\Scripts\\python.exe src\\common\\mapping_health_check.py
"""

import os
import sys
import io
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# (ad, severity, sql) — sql tek sayi (gap_count) dondurur; 0 = saglikli.
CHECKS = [
    # ---- FUTBOL TAKIM ----
    ("team_unmapped_source_id", "HIGH",
     """select count(*) from (
          select distinct t.source_team_id from football.match_team_stats t
          where not exists (select 1 from ref.team_mapping tm where tm.source_team_id=t.source_team_id)
        ) z"""),
    ("team_unmapped_CURRENT_season", "HIGH",
     """select count(*) from (
          select distinct t.source, t.source_team_id from football.match_team_stats t
          join football.matches m on m.source=t.source and m.source_match_id=t.source_match_id
          where m.season_label in ('2025/2026','2026/2027')
            and not exists (select 1 from ref.team_mapping tm where tm.source_team_id=t.source_team_id)
        ) z"""),
    ("cup_mackolik_current_team_null_slug", "MED",
     """select count(*) from ref.mackolik_team_map mm
        where mm.team_slug is null and exists (
          select 1 from ref.team_mapping tm
          where lower(translate(tm.display_name,'ÇĞİÖŞÜçğıöşü','CGIOSUcgiosu'))
              = lower(translate(mm.team_name,'ÇĞİÖŞÜçğıöşü','CGIOSUcgiosu')))"""),
    # ---- FUTBOL OYUNCU ----
    ("player_mapping_opta_missing_af_link", "HIGH",
     """select count(*) from ref.player_mapping
        where opta_player_id is not null and apifootball_player_id is null"""),
    ("player_current_info_duplicate_slug", "MED",
     """select count(*) from (
          select player_name, current_team_slug from analytics.player_current_info_bridged_v1
          where current_team_slug is not null group by 1,2 having count(*) > 1
        ) z"""),
    # ---- BASKETBOL ----
    ("bsl_highmin_no_sofascore_position", "MED",
     """select count(*) from (
          select s.player_slug from basketball.player_match_stats s
          join basketball.players p on p.player_slug = s.player_slug
          where p.sofascore_player_id is null
          group by s.player_slug having coalesce(sum(s.minutes),0) > 50
        ) z"""),
    # ---- VOLEYBOL ----
    ("volleyball_stats_player_no_name", "MED",
     """select count(*) from (
          select distinct s.fivb_id from volleyball.player_competition_stats s
          join volleyball.players p on p.fivb_id = s.fivb_id
          where p.full_name is null
        ) z"""),
    # ---- ODDS / FIKSTUR ----
    ("odds_orphan_availability", "LOW",
     """select count(*) from tracker.event_odds_availability a
        where not exists (select 1 from tracker.upcoming_events u where u.event_id=a.event_id)"""),
]


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    print(f"=== MAPPING HEALTH CHECK @ {datetime.now(timezone.utc).isoformat()}Z ===")
    high_gap = 0
    rows = []
    for name, sev, sql in CHECKS:
        try:
            cur.execute(sql)
            n = cur.fetchone()[0]
        except Exception as e:  # bir check kirilirsa digerleri kosmaya devam etsin
            conn.rollback()
            rows.append((sev, name, "ERR", str(e).splitlines()[0][:60]))
            continue
        status = "OK" if n == 0 else "GAP"
        rows.append((sev, name, n, status))
        if sev == "HIGH" and isinstance(n, int) and n > 0:
            high_gap += n
    w = max(len(r[1]) for r in rows)
    for sev, name, n, status in rows:
        print(f"  [{sev:4}] {name:<{w}}  {str(n):>6}  {status}")
    print(f"=== {'FAIL' if high_gap else 'PASS'}: HIGH gaps = {high_gap} ===")
    cur.close()
    conn.close()
    return 1 if high_gap else 0


if __name__ == "__main__":
    sys.exit(main())
