-- BSL oyuncularına pozisyon (+ boy) verisi: kaynak SofaScore (geçmiş maç lineup'ları).
-- TBF pozisyon YAYINLAMIYOR (bkz. tbf-scraping notu) → SofaScore lineups player.position.
-- Pozisyon ham 5'li sakla: G / GF / F / FC / C  (istenirse UI'da Türkçe etiket türetilir).
-- Additive: mevcut basketball.* verisi etkilenmez.

-- ============================================================
-- 1) Boyut kolonları
-- ============================================================
alter table basketball.players add column if not exists position            text;   -- G|GF|F|FC|C (SofaScore ham)
alter table basketball.players add column if not exists height_cm           integer;
alter table basketball.players add column if not exists sofascore_player_id  bigint; -- stabil kimlik (tekrar yüklemede eşleşme)
alter table basketball.players add column if not exists position_source      text;   -- 'sofascore'

create index if not exists ix_bb_players_sofa on basketball.players(sofascore_player_id)
  where sofascore_player_id is not null;

-- ============================================================
-- 2) Sezon istatistik view'ına pozisyon + boy ekle (oyuncu-boyutundan join)
--    OR REPLACE ile kolonlar SONA eklenir → mevcut sıralama korunur.
-- ============================================================
create or replace view analytics.bb_player_season_stats_v1 as
with agg as (
  select
    e.season_label, e.competition, e.player_slug,
    max(e.player_name)                          as player_name,
    (array_agg(e.team_name order by e.match_date desc))[1] as team_name,
    (array_agg(e.team_slug order by e.match_date desc))[1] as team_slug,
    (array_agg(e.jersey_no order by e.match_date desc))[1] as jersey_no,
    count(*)                                    as games,
    sum(coalesce(e.minutes,0))                  as tot_minutes,
    sum(coalesce(e.points,0))                   as tot_points,
    sum(coalesce(e.fgm,0))                       as tot_fgm,
    sum(coalesce(e.fga,0))                       as tot_fga,
    sum(coalesce(e.fg2m,0))                      as tot_fg2m,
    sum(coalesce(e.fg2a,0))                      as tot_fg2a,
    sum(coalesce(e.fg3m,0))                      as tot_fg3m,
    sum(coalesce(e.fg3a,0))                      as tot_fg3a,
    sum(coalesce(e.ftm,0))                       as tot_ftm,
    sum(coalesce(e.fta,0))                       as tot_fta,
    sum(coalesce(e.oreb,0))                      as tot_oreb,
    sum(coalesce(e.dreb,0))                      as tot_dreb,
    sum(coalesce(e.treb,0))                      as tot_treb,
    sum(coalesce(e.assists,0))                   as tot_assists,
    sum(coalesce(e.turnovers,0))                 as tot_turnovers,
    sum(coalesce(e.steals,0))                    as tot_steals,
    sum(coalesce(e.blocks,0))                    as tot_blocks,
    sum(coalesce(e.blocks_against,0))            as tot_blocks_against,
    sum(coalesce(e.fouls_drawn,0))               as tot_fouls_drawn,
    sum(coalesce(e.fouls_committed,0))           as tot_fouls_committed,
    -- usage payda bileşenleri (oyuncunun oynadığı maçlardaki takım toplamları)
    sum(coalesce(e.team_fga,0))                  as tm_fga,
    sum(coalesce(e.team_fta,0))                  as tm_fta,
    sum(coalesce(e.team_tov,0))                  as tm_tov,
    sum(coalesce(e.team_minutes,0))              as tm_minutes
  from analytics.bb_player_game_enriched_v1 e
  group by e.season_label, e.competition, e.player_slug
)
select
  season_label, competition, player_slug, player_name, team_slug, team_name, jersey_no,
  games,
  round(tot_minutes::numeric,1)                                   as minutes_total,
  round((tot_minutes)::numeric/nullif(games,0),1)                as mpg,
  tot_points as points_total, tot_treb as reb_total, tot_assists as assists_total,
  tot_steals as steals_total, tot_blocks as blocks_total, tot_turnovers as turnovers_total,
  tot_oreb as oreb_total, tot_dreb as dreb_total, tot_fg3m as fg3m_total,
  round((tot_points)::numeric/nullif(games,0),1)                 as ppg,
  round((tot_treb)::numeric/nullif(games,0),1)                   as rpg,
  round((tot_assists)::numeric/nullif(games,0),1)                as apg,
  round((tot_steals)::numeric/nullif(games,0),1)                 as spg,
  round((tot_blocks)::numeric/nullif(games,0),1)                 as bpg,
  round((tot_turnovers)::numeric/nullif(games,0),1)              as topg,
  round((tot_oreb)::numeric/nullif(games,0),1)                   as orpg,
  round((tot_dreb)::numeric/nullif(games,0),1)                   as drpg,
  round((tot_fg3m)::numeric/nullif(games,0),2)                   as fg3m_pg,
  -- shooting
  round((tot_fgm::numeric/nullif(tot_fga,0))*100,1)              as fg_pct,
  round((tot_fg2m::numeric/nullif(tot_fg2a,0))*100,1)            as fg2_pct,
  round((tot_fg3m::numeric/nullif(tot_fg3a,0))*100,1)            as fg3_pct,
  round((tot_ftm::numeric/nullif(tot_fta,0))*100,1)             as ft_pct,
  round(((tot_fgm + 0.5*tot_fg3m)::numeric/nullif(tot_fga,0))*100,1)                     as efg_pct,
  round((tot_points::numeric/nullif(2*(tot_fga + 0.44*tot_fta),0))*100,1)                as ts_pct,
  round((tot_fg3a::numeric/nullif(tot_fga,0))*100,1)            as three_rate,
  -- advanced
  round((tot_points/nullif(tot_minutes,0))::numeric,2)          as ppm,
  round((tot_points/nullif(tot_minutes,0)*36)::numeric,1)       as pts_per36,
  round((tot_treb/nullif(tot_minutes,0)*36)::numeric,1)         as reb_per36,
  round((tot_assists/nullif(tot_minutes,0)*36)::numeric,1)      as ast_per36,
  round( (100 * ((tot_fga + 0.44*tot_fta + tot_turnovers) * (tm_minutes/5.0))
         / nullif(tot_minutes * (tm_fga + 0.44*tm_fta + tm_tov),0))::numeric, 1)         as usage_pct,
  -- combo markets (per game)
  round(((tot_points+tot_treb+tot_assists))::numeric/nullif(games,0),1) as pra_pg,
  round(((tot_points+tot_assists))::numeric/nullif(games,0),1)         as pa_pg,
  round(((tot_points+tot_treb))::numeric/nullif(games,0),1)            as pr_pg,
  -- oyuncu boyutundan (SofaScore) — SONA eklendi
  (select pl.position  from basketball.players pl where pl.player_slug = agg.player_slug) as position,
  (select pl.height_cm from basketball.players pl where pl.player_slug = agg.player_slug) as height_cm
from agg;

grant select on analytics.bb_player_season_stats_v1 to anon, authenticated;

-- ============================================================
-- 3) Leaderboard view'ı yeniden kur — `q.*` ESKİ kolon listesiyle donmuş,
--    yeni position/height_cm'i almaz. DROP+CREATE ile * yeniden genişler.
-- ============================================================
drop view if exists analytics.bb_player_leaderboard_v1;
create view analytics.bb_player_leaderboard_v1 as
with cfg as (
  select coalesce(max(value) filter (where key='min_minutes'),10) as min_minutes
  from basketball.model_config
),
mx as (
  select season_label, competition, max(games) as max_games
  from analytics.bb_player_season_stats_v1 group by 1,2
),
q as (
  select s.*,
    (s.mpg >= (select min_minutes from cfg)
       and s.games >= greatest(5, 0.30*mx.max_games)) as is_qualified
  from analytics.bb_player_season_stats_v1 s
  join mx on mx.season_label=s.season_label and mx.competition=s.competition
)
select q.*,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by ppg desc)  end as ppg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by rpg desc)  end as rpg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by apg desc)  end as apg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by spg desc)  end as spg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by bpg desc)  end as bpg_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by fg3m_pg desc) end as fg3m_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by ts_pct desc nulls last) end as ts_rank,
  case when is_qualified then rank() over (partition by season_label,competition,is_qualified order by usage_pct desc nulls last) end as usage_rank
from q;

grant select on analytics.bb_player_leaderboard_v1 to anon, authenticated;
