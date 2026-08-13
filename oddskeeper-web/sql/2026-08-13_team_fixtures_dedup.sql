-- 2026-08-13: Takim sayfasi Fixture sekmesi mukerrer/yanlis-tarih duzeltmesi.
--
-- football.fixtures ayni Super Lig macini iki kaynaktan tutuyor: apifootball
-- (nominal/yanlis gun, or. FB-Genclerbirligi 16 Agu 17:00) + sofascore
-- (gercek gun, 15 Agu 18:30). team_fixtures_v1 kaynak filtrelemedigi icin
-- maclar cift ve iki farkli tarihle gorunuyordu. Slug bazli eslestirme
-- kaynaklar arasi ad varyantlarina (besiktas vs besiktas-jk) takildigi icin
-- SEZON bazli kural kullanilir: o sezonun Super Lig fiksturu sofascore'da
-- varsa apifootball Super Lig satirlari tamamen elenir (sofascore tek dogru
-- kaynak; kupa/Avrupa maclari zaten yalniz sofascore'dan gelir).

-- Sofascore fikstur satirlarinin takim slug'lari ad-varyantli (besiktas-jk,
-- gaziantep-fk); takim sayfasi eq(team_slug) eslesmesi icin ref.team_mapping'e
-- 13 eksik TSL sofascore id'si eklenir (yukselen 5 takimda zaten vardi) ve
-- view slug'lari mapping uzerinden kanonik football slug'ina cevirir.
insert into ref.team_mapping
  (team_slug, display_name, canonical_team_name, logo_path, is_active, source_team_id, created_at, updated_at)
select v.team_slug, tm.display_name, tm.canonical_team_name, tm.logo_path, true, v.sid, now(), now()
from (values
  ('fenerbahce', '3052'), ('besiktas', '3050'), ('galatasaray', '3061'),
  ('gaziantep', '5138'), ('eyupspor', '7040'), ('kasimpasa', '6063'),
  ('goztepe', '3054'), ('trabzonspor', '3051'), ('rizespor', '3064'),
  ('basaksehir', '3086'), ('samsunspor', '3053'), ('konyaspor', '3085'),
  ('alanyaspor', '6362')
) v(team_slug, sid)
join lateral (
  select t.display_name, t.canonical_team_name, t.logo_path
  from ref.team_mapping t
  where t.team_slug = v.team_slug and t.is_active
  order by t.team_mapping_id limit 1
) tm on true
where not exists (select 1 from ref.team_mapping x where x.source_team_id = v.sid);

create or replace view analytics.team_fixtures_v1 as
with open_fixtures as (
  select f.fixture_id, f.competition, f.season_label, f.round_number,
         f.fixture_date, f.fixture_datetime, f.kickoff_time_known,
         f.kickoff_time_text, f.fixture_status, f.venue,
         coalesce(hm.team_slug, f.home_team_slug) as home_team_slug,
         f.home_team_source_id, f.home_team_name,
         coalesce(am.team_slug, f.away_team_slug) as away_team_slug,
         f.away_team_source_id, f.away_team_name
  from football.fixtures f
  left join ref.team_mapping hm
         on hm.source_team_id = f.home_team_source_id and hm.is_active
  left join ref.team_mapping am
         on am.source_team_id = f.away_team_source_id and am.is_active
  where coalesce(lower(f.fixture_status), 'scheduled')
        in ('scheduled', 'postponed', 'cancelled')
    and not (
      f.source = 'apifootball' and f.competition = 'Süper Lig'
      and exists (
        select 1 from football.fixtures s
        where s.source = 'sofascore' and s.competition = 'Süper Lig'
          and s.season_label = f.season_label
      )
    )
    and not exists (
      select 1 from football.matches m
      where m.home_team_source_id = f.home_team_source_id
        and m.away_team_source_id = f.away_team_source_id
        and m.match_datetime is not null
        and m.match_datetime::date = f.fixture_date
    )
)
select f.fixture_id, f.competition, f.season_label, f.round_number,
       f.fixture_date, f.fixture_datetime, f.kickoff_time_known,
       f.kickoff_time_text, f.fixture_status, f.venue,
       f.home_team_slug  as team_slug,
       f.home_team_source_id as team_source_id,
       f.home_team_name  as team_name,
       true  as is_home, false as is_away,
       f.away_team_slug  as opponent_team_slug,
       f.away_team_source_id as opponent_team_source_id,
       f.away_team_name  as opponent_name
from open_fixtures f
union all
select f.fixture_id, f.competition, f.season_label, f.round_number,
       f.fixture_date, f.fixture_datetime, f.kickoff_time_known,
       f.kickoff_time_text, f.fixture_status, f.venue,
       f.away_team_slug, f.away_team_source_id, f.away_team_name,
       false, true,
       f.home_team_slug, f.home_team_source_id, f.home_team_name
from open_fixtures f;

grant select on analytics.team_fixtures_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
