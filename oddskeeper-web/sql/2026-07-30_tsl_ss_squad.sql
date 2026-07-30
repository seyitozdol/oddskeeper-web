-- 2026-07-30: TSL SofaScore-native kadro view'i (profil/kadro katmani).
-- SofaScore mac loguna dayali: her Süper Lig oyuncusu EN SON oynadigi SL takimi altinda.
-- Bio (football.sofascore_player_info) + logo (ref.sofascore_team_logos) bagli.
-- Sezon basi (26/27 maci yokken) 25/26 takimlarini proxy gosterir; 26/27 maclari
-- geldikce oyuncu bazinda kendini gunceller (o oyuncu 26/27 takimina gecer).
-- NOT: tam pre-season kadrosu icin Transfermarkt 26/27 kadro cekimi + sofascore
-- eslemesi gerekir (opsiyonel ek is; TFF1'deki tff1_player_market_values kalibi).

create or replace view analytics.tsl_ss_squad_v1 as
with sl as (
  select
    season_label, player_id,
    max(player_name)                                       as player_name,
    (array_agg(team_id   order by match_datetime desc))[1] as team_id,
    (array_agg(team_name order by match_datetime desc))[1] as team_name,
    mode() within group (order by position_code)           as position_code,
    count(*) filter (where minutes > 0)                     as appearances,
    count(*) filter (where lineup_status = 'starter')       as starts,
    sum(minutes)                                            as minutes,
    max(match_datetime) filter (where minutes > 0)          as last_match
  from analytics.tff1_player_match_log_v1
  where competition = 'Süper Lig'
  group by season_label, player_id
),
latest as (select max(season_label) as ms from sl),
cur as (  -- SADECE en son SL sezonunun kadrosu (sisme onlenir); oyuncu transferse son takimi
  select distinct on (player_id) *
  from sl
  where season_label = (select ms from latest)
  order by player_id, last_match desc nulls last
)
select
  cur.team_id,
  cur.team_name,
  cur.player_id,
  coalesce(i.player_name, cur.player_name)                 as player_name,
  coalesce(i.position, cur.position_code)                  as position,
  i.photo_url,
  i.birth_date,
  i.country,
  i.height_cm,
  cur.season_label                                         as last_season,
  cur.appearances,
  cur.starts,
  cur.minutes,
  case when cur.appearances > 0
       then round(100.0 * cur.starts / cur.appearances, 1) end as starter_rate_pct,
  cur.last_match,
  l.logo_url                                               as team_logo
from cur
left join football.sofascore_player_info i on i.sofascore_player_id = cur.player_id
left join ref.sofascore_team_logos l on l.sofascore_team_id = cur.team_id;

grant select on analytics.tsl_ss_squad_v1 to anon, authenticated, service_role;

drop materialized view if exists analytics.tsl_ss_squad_mat;
create materialized view analytics.tsl_ss_squad_mat as
  select * from analytics.tsl_ss_squad_v1;
create unique index uq_tsl_ss_squad_mat on analytics.tsl_ss_squad_mat (team_id, player_id);
grant select on analytics.tsl_ss_squad_mat to anon, authenticated, service_role;
