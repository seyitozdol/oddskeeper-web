-- Super Lig FlashScore oyuncu sezon istatistikleri, Opta oyuncu id'sine bagli.
-- Kaynak: football.match_player_stats_details source='flashscore' (Super Lig 25/26)
--         + ref.flashscore_player_map.opta_player_id (build_flashscore_opta_player_map.py).
-- FlashScore oyuncu verisi 2025/26'da basliyor; onceki sezonlar yok.
-- Frontend MAT'i okur (logic view API statement timeout riskine girer).
-- Uygulandi: 2026-07-28

create or replace view analytics.tsl_player_flashscore_season_v1 as
select
  m.season_label,
  fmap.opta_player_id,
  max(d.player_name)                                                as fs_player_name,
  count(*) filter (where coalesce((d.raw_stats->>'MATCH_MINUTES_PLAYED')::int, 0) > 0) as appearances,
  sum(coalesce((d.raw_stats->>'MATCH_MINUTES_PLAYED')::int, 0))     as minutes,
  sum(coalesce((d.raw_stats->>'GOALS')::int, 0))                    as goals,
  sum(coalesce((d.raw_stats->>'ASSISTS_GOAL')::int, 0))             as assists,
  round(sum((d.raw_stats->>'EXPECTED_GOALS')::numeric), 2)          as xg,
  round(sum((d.raw_stats->>'EXPECTED_GOALS_ON_TARGET')::numeric), 2) as xgot,
  round(sum((d.raw_stats->>'EXPECTED_ASSISTS')::numeric), 2)        as xa,
  sum(coalesce((d.raw_stats->>'SHOTS_TOTAL')::int, 0))              as shots,
  sum(coalesce((d.raw_stats->>'SHOTS_ON_TARGET')::int, 0))          as shots_on_target,
  sum(coalesce((d.raw_stats->>'BIG_CHANCES_CREATED')::int, 0))      as big_chances_created,
  sum(coalesce((d.raw_stats->>'BIG_CHANCES_MISSED')::int, 0))       as big_chances_missed,
  sum(coalesce((d.raw_stats->>'KEY_PASSES')::int, 0))               as key_passes,
  sum(coalesce((d.raw_stats->>'PROGRESSIVE_PASSES_ACCURATE')::int, 0)) as progressive_passes,
  sum(coalesce((d.raw_stats->>'PROGRESSIVE_CARRIES')::int, 0))      as progressive_carries,
  sum(coalesce((d.raw_stats->>'BOX_ENTRIES_ACCURATE')::int, 0))     as box_entries,
  sum(coalesce((d.raw_stats->>'FINAL_THIRD_ENTRIES_SUCCESSFUL')::int, 0)) as final_third_entries,
  sum(coalesce((d.raw_stats->>'TOUCHES_TOTAL')::int, 0))            as touches,
  sum(coalesce((d.raw_stats->>'TOUCHES_BOX_OPPOSITE')::int, 0))     as touches_opp_box,
  sum(coalesce((d.raw_stats->>'CARDS_YELLOW')::int, 0))             as yellow_cards,
  -- CARDS_RED ikinci saridan atilmalari icerir
  sum(coalesce((d.raw_stats->>'CARDS_RED')::int, 0))                as red_cards,
  round(sum((d.raw_stats->>'GOALS_PREVENTED')::numeric), 2)         as goals_prevented,
  round(avg((d.raw_stats->>'_rating')::numeric)
        filter (where coalesce((d.raw_stats->>'MATCH_MINUTES_PLAYED')::int, 0) > 0), 2) as rating_avg
from football.match_player_stats_details d
join football.matches m
  on m.source = d.source and m.source_match_id = d.source_match_id
join ref.flashscore_player_map fmap
  on fmap.flashscore_player_id = d.source_player_id and fmap.opta_player_id is not null
where d.source = 'flashscore'
  and m.competition = 'Süper Lig'
group by 1, 2;

drop materialized view if exists analytics.tsl_player_flashscore_season_mat;
create materialized view analytics.tsl_player_flashscore_season_mat as
  select * from analytics.tsl_player_flashscore_season_v1;
create unique index uq_tsl_fs_season_mat on analytics.tsl_player_flashscore_season_mat (season_label, opta_player_id);

grant select on analytics.tsl_player_flashscore_season_v1 to anon, authenticated, service_role;
grant select on analytics.tsl_player_flashscore_season_mat to anon, authenticated, service_role;
