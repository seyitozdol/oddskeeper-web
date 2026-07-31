-- TSL (Super Lig) SofaScore-native mac + fikstur view'lari.
-- Opta/apifootball/flashscore ayni maci football.matches'e ayri source'la
-- yazdigindan league_results_v1 Super Lig'de ~3x mukerrer donuyor. Bu view
-- yalniz source='sofascore' Super Lig satirlarini alir -> tek kaynak, temiz.
-- Takim id'leri SofaScore numeric id (tff1_team_logos_v1.team_id ile 18/18 eslesir).
-- tff1_matches_v1 / tff1_fixtures_v1 kalibinin competition='Süper Lig' kopyasi.

create or replace view analytics.tsl_ss_matches_v1 as
select
  season_label,
  source_match_id as match_id,
  competition,
  match_datetime,
  home_team_source_id as home_team_id,
  home_team_name,
  away_team_source_id as away_team_id,
  away_team_name,
  home_score,
  away_score
from football.matches
where source = 'sofascore'
  and competition = 'Süper Lig';

grant select on analytics.tsl_ss_matches_v1 to anon, authenticated, service_role;

create or replace view analytics.tsl_ss_fixtures_v1 as
select
  fixture_id,
  season_label,
  competition,
  round_number,
  fixture_date,
  fixture_datetime,
  home_team_source_id as home_team_id,
  home_team_name,
  away_team_source_id as away_team_id,
  away_team_name,
  fixture_status
from football.fixtures
where source = 'sofascore'
  and competition = 'Süper Lig';

grant select on analytics.tsl_ss_fixtures_v1 to anon, authenticated, service_role;

-- tsl_ss_* view/mat'lari onceki oturumda anon/authenticated'a grant EDILMEMISTI;
-- frontend (publishable/anon key) "permission denied" aliyordu. Hepsini grant et.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'analytics'
      and c.relname like 'tsl_ss_%'
      and c.relkind in ('r', 'v', 'm')
  loop
    execute format(
      'grant select on analytics.%I to anon, authenticated, service_role',
      r.relname
    );
  end loop;
end $$;

-- Logo view'i (tff1_team_logos_v1) yalniz authenticated'a grant'liydi; dev
-- (DEV_AUTH_BYPASS = anon rolu) logolari okuyamiyordu. Public logolar -> anon'a ac.
grant usage on schema ref to anon;
grant select on ref.sofascore_team_logos to anon;
grant select on analytics.tff1_team_logos_v1 to anon;

-- 4. sablon (resmi) oyuncu foto/link/istatistik icin okunan view'lar.
-- player_current_info/profile/market_value yalniz authenticated'ti (dev anon
-- foto goremiyordu); iki TSL player mat'inin HIC grant'i yoktu (uretimde bile
-- bos donuyordu). Hepsini anon+authenticated'a ac (public futbol istatistigi).
grant select on analytics.player_current_info_v1 to anon, authenticated;
grant select on analytics.player_profile_v1 to anon, authenticated;
grant select on analytics.player_market_value_v1 to anon, authenticated;
grant select on analytics.tsl_player_flashscore_season_mat to anon, authenticated;
grant select on analytics.tsl_player_advanced_season_mat to anon, authenticated;

-- TSL mac detay sayfasi (ve mevcut tff1 mac sayfalari) oyuncu-mac logunu okur;
-- mat'in hic grant'i yoktu.
grant select on analytics.tff1_player_match_log_mat to anon, authenticated;
