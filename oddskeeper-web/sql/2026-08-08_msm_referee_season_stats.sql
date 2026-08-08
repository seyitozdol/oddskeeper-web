-- MSM: hakem sezon-istatistigi view'i (Referees sekmesi + market-stats hakem lookup).
-- Kaynak: football.matches (referee) JOIN football.match_team_stats (mac-basi takim statlari).
-- Lig+sezon basina TEK kaynak: en dusuk source_rank (opta=1, apifootball=2, sofascore=3)
-- olan; boylece ayni mac cok-kaynakta cift sayilmaz. Referee sadece opta/apifootball/
-- sofascore'da (backfill sonrasi) dolu. 1.Lig icin tek kaynak sofascore.
-- Card formulu = (toplam sari + toplam kirmizi*2) / apps  (MSM kural birligi).
-- Fouls/Tackles = toplam faul / toplam tackle (tackle yoksa NULL -> UI '—').

create or replace view msm.referee_season_stats_v1 as
with match_agg as (
  -- mac-basi (source, source_match_id): hakem + ev+dep toplam statlar
  select
    case when m.competition ilike '%per Lig%' then 'tsl'
         when m.competition ilike '%1. Lig%' or m.competition ilike '%1.Lig%'
              or m.competition ilike '%irinci Lig%' then 'tff1'
         else m.competition end                              as league,
    m.season_label                                           as season,
    m.source,
    case m.source when 'opta' then 1 when 'apifootball' then 2
                  when 'sofascore' then 3 else 9 end         as source_rank,
    m.source_match_id,
    trim(m.referee)                                          as referee,
    sum(coalesce(t.summary_fouls_conceded, 0))               as fouls,
    sum(t.summary_tackles)                                   as tackles,       -- NULL kaynakta NULL kalir
    count(t.summary_tackles)                                 as tackles_rows,
    sum(coalesce(t.summary_yellow_cards, 0))                 as yellow,
    sum(coalesce(t.summary_red_cards, 0))                    as red,
    sum(coalesce(t.opta_penalties_won_total,
                 (t.sofascore_extras->>'penalties')::numeric)) as pens,
    count(coalesce(t.opta_penalties_won_total,
                   (t.sofascore_extras->>'penalties')::numeric)) as pen_rows
  from football.matches m
  join football.match_team_stats t
    on t.source = m.source and t.source_match_id = m.source_match_id
  where m.referee is not null and trim(m.referee) <> ''
  group by 1, 2, 3, 4, 5, 6
),
best as (
  -- lig+sezon basina secilecek kaynak (referee+stat'i olan en iyi rank)
  select league, season, min(source_rank) as best_rank
  from match_agg
  group by 1, 2
),
sel as (
  select a.*
  from match_agg a
  join best b on b.league = a.league and b.season = a.season and b.best_rank = a.source_rank
)
select
  league,
  season,
  referee,
  count(*)                                                   as apps,
  sum(fouls)                                                 as fouls_total,
  sum(tackles)                                               as tackles_total,
  sum(tackles_rows)                                          as tackles_rows,
  sum(yellow)                                                as yellow_total,
  sum(red)                                                   as red_total,
  case when sum(pen_rows) > 0 then sum(pens) end             as pen_total,
  round(sum(fouls)::numeric / nullif(count(*), 0), 2)        as fouls_pg,
  case when sum(tackles) > 0
       then round(sum(fouls)::numeric / nullif(sum(tackles), 0), 2) end as fouls_per_tackle,
  case when sum(pen_rows) > 0
       then round(sum(pens)::numeric / nullif(count(*), 0), 2) end      as pen_pg,
  round(sum(yellow)::numeric / nullif(count(*), 0), 2)       as yel_pg,
  round(sum(red)::numeric / nullif(count(*), 0), 2)          as red_pg,
  round((sum(yellow) + sum(red) * 2)::numeric / nullif(count(*), 0), 2) as cards_pg
from sel
group by league, season, referee;

create or replace view analytics.msm_referee_season_stats_v1 as
  select * from msm.referee_season_stats_v1;

grant select on msm.referee_season_stats_v1 to anon, authenticated;
grant select on analytics.msm_referee_season_stats_v1 to anon, authenticated;
