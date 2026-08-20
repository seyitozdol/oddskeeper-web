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

# Avrupa kupasi YABANCI rakipleri bilincli kapsam disi (karar 2026-08-19):
# eurocup view'lari team_mapping'e bagli degil (source_team_id + competition ile
# calisir), bu yuzden yabanci rakibe mapping satiri acilmaz. Yeni bir yabanci
# turnuva/kaynak eklenirse bu listede olmadigi icin check yine alarm verir.
EUROCUP_COMPS = "('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')"

# (ad, severity, sql) — sql tek sayi (gap_count) dondurur; 0 = saglikli.
CHECKS = [
    # ---- FUTBOL TAKIM ----
    ("team_unmapped_source_id", "HIGH",
     f"""select count(*) from (
          select distinct t.source_team_id from football.match_team_stats t
          where coalesce(t.competition,'') not in {EUROCUP_COMPS}
            and not exists (select 1 from ref.team_mapping tm where tm.source_team_id=t.source_team_id)
        ) z"""),
    ("team_unmapped_CURRENT_season", "HIGH",
     f"""select count(*) from (
          select distinct t.source, t.source_team_id from football.match_team_stats t
          join football.matches m on m.source=t.source and m.source_match_id=t.source_match_id
          where m.season_label in ('2025/2026','2026/2027')
            and coalesce(t.competition,'') not in {EUROCUP_COMPS}
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
    # ss->opta terfi drifti (2.6): sofascore_opta_player_map gunluk truncate+rebuild
    # oldugu icin oyuncu Opta verisi kazaninca ssX kimligi gercek opta id'ye doner;
    # ref.player_mapping ise do-nothing yazildigindan kendini onarmaz. pm hala ssX
    # tasirken harita gercek opta veriyorsa kadro linki bayat profile gider ve
    # kimse fark etmez. >0 gorulunce pm satiri(lari) gercek opta kimligine tasinmali
    # (kalici cozum A-2: uretimli pm satirlarini is_curated bayragiyla rebuild'e almak).
    ("player_mapping_ss_promoted_drift", "HIGH",
     """select count(*) from ref.player_mapping pm
        join ref.sofascore_opta_player_map som
          on som.sofascore_player_id = substring(pm.opta_player_id from 3)
        where pm.opta_player_id like 'ss%'
          and som.opta_player_id not like 'ss%'"""),
    ("player_current_info_duplicate_slug", "MED",
     """select count(*) from (
          select player_name, current_team_slug from analytics.player_current_info_bridged_v1
          where current_team_slug is not null group by 1,2 having count(*) > 1
        ) z"""),
    ("squad_profile_broken_link", "HIGH",
     """select count(*) from (
          with sq as (select player_slug, split_part(player_slug,'--',1) base
                      from analytics.team_current_squad_profile_v1),
               pr as (select player_slug, split_part(player_slug,'--',1) base
                      from analytics.player_profile_bridged_v1)
          select 1 from sq
          left join pr ps on ps.player_slug = sq.player_slug
          join pr on pr.base = sq.base and pr.player_slug <> sq.player_slug
          where ps.player_slug is null
        ) z"""),
    # PSM kimlik sozlesmesi: Oyuncu Listesi (player_current_info_v1) ile Model
    # kadrosu (team_current_squad_profile_v1) ayni oyuncuya AYNI slug'i vermeli.
    # Ayrisirsa Player List'te kaydedilen participant id'ler Model'in Ekle
    # akisinda sessizce bos gider (2026-08-19 Erzurum-GS vakasi: 53 oyuncu /
    # 40 kopuk id; kok neden 18 Agu squad-zincir degisikliginin info view'ina
    # yansitilmamasiydi). Fix: sql/2026-08-19_player_current_info_profile_slug.sql
    ("psm_info_squad_slug_divergence", "HIGH",
     """select count(*) from analytics.player_current_info_v1 i
        join analytics.team_current_squad_profile_v1 s
          on s.af_player_id = i.apifootball_player_id
        where i.apifootball_player_id is not null
          and i.player_slug is distinct from s.player_slug"""),
    # Kayitli PSM id'si '--' anahtariyla guncel kadro oyuncusuna denk gelen ama
    # slug'i birebir tutmayan satir: profil slug'inin isim kismi degismis demek.
    # Frontend fallback kullaniciyi kurtarir ama veri re-key bekliyordur.
    ("psm_player_id_stale_slug", "MED",
     """select count(*) from (
          select distinct s.player_slug
          from analytics.team_current_squad_profile_v1 s
          join analytics.pm_player_ids p
            on p.league = 'tsl'
           and split_part(p.player_slug, '--', 2) <> ''
           and split_part(p.player_slug, '--', 2) = split_part(s.player_slug, '--', 2)
          where not exists (select 1 from analytics.pm_player_ids q
                            where q.league = 'tsl' and q.player_slug = s.player_slug)
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
    # ---- GUVENLIK ----
    # Anon lockdown bekcisi (K-1, 2026-08-20): karar 2026-08-19 "anon'a sifir veri
    # yuzeyi". CI anon-guard yalniz sql diff'ini gorur; pipeline'in create/grant
    # DDL'i gibi RUNTIME yollardan acilan anon yetkisini bu sayac yakalar
    # (yasanan vaka: build_flashscore_sofa_cup_player_map.py her kosuda anon'a
    # SELECT grant ediyordu). Sistem semalari (storage/realtime/graphql/auth)
    # Supabase yonetiminde, kapsam disi.
    ("anon_grants_project_schemas", "HIGH",
     """select count(*) from (
          select table_schema s from information_schema.role_table_grants
          where grantee='anon'
          union all
          select routine_schema from information_schema.role_routine_grants
          where grantee='anon'
        ) x where x.s not in ('storage','realtime','graphql','graphql_public',
          'auth','vault','extensions','pgsodium','pgsodium_masks','net',
          'supabase_functions','pg_catalog','information_schema','cron','pgbouncer')"""),
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
