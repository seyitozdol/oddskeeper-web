-- SofaScore mac-logu koprusu (2026-08-15) — profil koprusunun ikinci parcasi.
-- ONCE sql/2026-08-15_player_profile_sofascore_bridge.sql uygulanmali.
--
-- analytics.player_match_log_v1 tamamen Opta'ya dayali (match_player_stats_opta_points).
-- 2026/27'de Opta verisi olmadigindan oyuncu profil sayfasinin Mac Logu sekmesi, "Son
-- maclar" ve mac-basi ortalamalar bos kaliyordu (profil koprusu sonrasi bile).
-- Burada ayni kolon setini SofaScore mac verisinden ureten bir view + birlesim var.
--
-- MUKERRER KORUMASI: ayni gercek macin Opta ve SofaScore mac id'leri FARKLI. Bu yuzden
-- birlesim mac bazinda degil (oyuncu, sezon) bazinda yapilir: bir oyuncu-sezonun Opta
-- logu varsa SofaScore satirlari HIC eklenmez. Bu kural mat'in ICINE gomulu.

drop materialized view if exists analytics.player_match_log_sofascore_mat cascade;
drop view if exists analytics.player_match_log_sofascore_def_v1 cascade;
drop view if exists analytics.player_match_log_bridged_v1 cascade;

create view analytics.player_match_log_sofascore_def_v1 as
with slug_map as (
    -- slug'lar profil koprusuyle AYNI olmali (sayfa slug ile sorguluyor)
    select player_source_id, player_slug, player_name
    from analytics.player_profile_bridged_mat
    where player_source_id is not null and player_slug is not null
), opta_seasons as (
    select distinct ps.source_player_id as player_source_id, m.season_label
    from football.match_player_stats_opta_points ps
    join football.matches m on m.source_match_id = ps.source_match_id
    where m.season_label is not null
)
select
    sm.player_slug,
    pmap.opta_player_id                              as player_source_id,
    coalesce(sm.player_name, d.player_name)          as player_name,
    tm.team_slug,
    d.source_team_id                                 as team_source_id,
    d.team_name,
    m.source_match_id,
    m.competition,
    m.season_label,
    m.match_datetime,
    m.home_team_source_id = d.source_team_id         as is_home,
    m.away_team_source_id = d.source_team_id         as is_away,
    case when m.home_team_source_id = d.source_team_id then m.away_team_name
         else m.home_team_name end                   as opponent_name,
    case when m.home_team_source_id = d.source_team_id then away_map.team_slug
         else home_map.team_slug end                 as opponent_team_slug,
    case when m.home_score is null or m.away_score is null then null
         when m.home_team_source_id = d.source_team_id then concat(m.home_score, '-', m.away_score)
         else concat(m.away_score, '-', m.home_score) end as score_display,
    case when m.home_score is null or m.away_score is null then null
         when m.winner_team_source_id = d.source_team_id then 'W'
         when m.winner_team_source_id is null then 'D'
         else 'L' end                                as result_code,
    d.lineup_status,
    d.position_code,
    null::numeric                                    as points,   -- Opta'ya ozgu
    (d.raw_stats ->> 'minutesPlayed')::int           as minutes_played,
    coalesce((d.raw_stats ->> 'goals')::int, 0)      as goals,
    coalesce((d.raw_stats ->> 'goalAssist')::int, 0) as assists,
    coalesce((d.raw_stats ->> 'onTargetScoringAttempt')::int, 0) as shots_on_target,
    coalesce((d.raw_stats ->> 'shotOffTarget')::int, 0)          as shots_off_target,
    coalesce((d.raw_stats ->> 'blockedScoringAttempt')::int, 0)  as shots_blocked,
    coalesce((d.raw_stats ->> 'totalPass')::int, 0)  as passes,
    coalesce((d.raw_stats ->> 'totalCross')::int, 0) as crosses,
    coalesce((d.raw_stats ->> 'totalTackle')::int, 0)     as tackles,
    coalesce((d.raw_stats ->> 'interceptionWon')::int, 0) as interceptions,
    coalesce((d.raw_stats ->> 'wasFouled')::int, 0)  as fouls_won,
    coalesce((d.raw_stats ->> 'fouls')::int, 0)      as fouls_conceded,
    coalesce((d.raw_stats ->> 'totalOffside')::int, 0) as offsides,
    -- kart SofaScore oyuncu istatistiginde yok (FlashScore overlay'inde var); null
    null::int                                        as cards_yellow,
    null::int                                        as cards_red,
    null::int                                        as penalties_won,
    coalesce((d.raw_stats ->> 'saves')::int, 0)      as saves_total,
    (d.raw_stats ->> 'expectedGoals')::numeric       as expected_goals,
    coalesce((d.raw_stats ->> 'accuratePass')::int, 0) as accurate_pass
from football.match_player_stats_details d
join football.matches m
  on m.source = d.source and m.source_match_id = d.source_match_id
join ref.sofascore_opta_player_map pmap
  on pmap.sofascore_player_id = d.source_player_id
join slug_map sm on sm.player_source_id = pmap.opta_player_id
left join ref.team_mapping tm       on tm.source_team_id = d.source_team_id and tm.is_active = true
left join ref.team_mapping home_map on home_map.source_team_id = m.home_team_source_id and home_map.is_active = true
left join ref.team_mapping away_map on away_map.source_team_id = m.away_team_source_id and away_map.is_active = true
where d.source = 'sofascore'
  and m.competition like 'S%per Lig%'
  and m.season_label is not null
  and not exists (select 1 from opta_seasons o
                  where o.player_source_id = pmap.opta_player_id
                    and o.season_label = m.season_label);

-- MATERIALIZE: canli hesaplanirsa profil sayfasi statement timeout'a takiliyor (yasandi).
-- Tazeleme: pipeline/src/football/refresh_tsl_mats.py (mac-sonrasi job); profil mat'indan
-- SONRA tazelenmeli (slug'lari oradan okur).
create materialized view analytics.player_match_log_sofascore_mat as
  select * from analytics.player_match_log_sofascore_def_v1;
create index player_match_log_sofascore_mat_slug_idx
  on analytics.player_match_log_sofascore_mat (player_slug);

create view analytics.player_match_log_bridged_v1 as
select * from analytics.player_match_log_v1
union all
select * from analytics.player_match_log_sofascore_mat;

grant select on analytics.player_match_log_sofascore_def_v1 to anon, authenticated, service_role;
grant select on analytics.player_match_log_sofascore_mat     to anon, authenticated, service_role;
grant select on analytics.player_match_log_bridged_v1        to anon, authenticated, service_role;
