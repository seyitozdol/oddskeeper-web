# -*- coding: utf-8 -*-
"""football.fixtures tarih/saat/durumunu tracker.upcoming_events'ten (SofaScore,
otomatik 3 saatte bir tazelenir) senkronlar.

Sorun: 1.Lig fikstürleri load_sofascore_tff1_fixtures.py ile ELLE (tarayıcı JSON)
yükleniyordu; sezon başındaki placeholder tarihler (round-varsayılan 15:00) hiç
tazelenmiyordu -> fikstür seçicisinde yanlış tarih/sıra. Gerçek kickoff'lar zaten
upcoming_events'te (event_id = sofascore fixture_id). Bu script onları eşitler.

Kapsam: upcoming_events yuvarlanan pencere (güncel + sonraki turlar) tuttuğu için
her koşuda o penceredeki fikstürler düzelir; sezon ilerledikçe hepsi güncel kalır.

READ+WRITE (yalnız football.fixtures UPDATE). Cron: run_upcoming_events.sh sonuna
eklenebilir (upcoming taze cekildikten HEMEN sonra).
Elle: .venv\\Scripts\\python.exe src\\football\\sync_fixtures_from_upcoming.py
"""

import os
import sys
import io

import psycopg2
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# SofaScore status_type -> football.fixtures.fixture_status
# (ck_fixtures_status izinli: scheduled|postponed|cancelled|completed — 'inprogress' YOK,
#  o yuzden devam eden maci 'scheduled' kabul et; bittiginde 'completed' olur.)
STATUS_SQL = """
  case u.status_type
    when 'finished' then 'completed'
    when 'notstarted' then 'scheduled'
    when 'inprogress' then 'scheduled'
    when 'postponed' then 'postponed'
    when 'canceled' then 'cancelled'
    when 'cancelled' then 'cancelled'
    else f.fixture_status
  end
"""


def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(f"""
        update football.fixtures f
        set fixture_datetime = u.start_ts,
            fixture_date = (u.start_ts at time zone 'UTC')::date,
            fixture_status = {STATUS_SQL},
            kickoff_time_known = true,
            updated_at = now()
        from tracker.upcoming_events u
        where f.source = 'sofascore'
          and u.event_id::text = f.fixture_id::text
          and u.start_ts is not null
          and (date_trunc('minute', f.fixture_datetime) is distinct from date_trunc('minute', u.start_ts)
               or f.fixture_status is distinct from ({STATUS_SQL}))
    """)
    n = cur.rowcount
    conn.commit()
    print(f"fixtures senkronlandi (upcoming_events'ten): {n} satir guncellendi")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
