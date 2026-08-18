-- 2026-08-18: Avrupa kupalari FlashScore fallback.
-- SofaScore bazi kupa maclarinda (ozellikle on eleme) oyuncu VE/VEYA takim
-- istatistigi vermez (kadro var, stat yok). FlashScore verir. Bu migration:
--  1) ref.flashscore_sofa_match_map: FS mac id <-> SofaScore mac id eslesmesi
--     (fetch_flashscore_cup_matches.py doldurur; tarih+skor+ad ile).
--  2) analytics.eurocup_fs_player_match_log_v1: FS kupa oyuncu-mac logu (FS
--     typeId'leri getCupMatchPlayers kolonlarina). Frontend, SofaScore bossa
--     bu view'a (map ile cozdugu FS mac id ile) duser.
--  3) analytics.eurocup_team_bars_v1: kupa mac-detay 10 takim marketi; her mac
--     icin SofaScore gercek stat varsa SofaScore, yoksa (map ile) FlashScore.
--
-- Sofascore-keyed kupa view'lari (eurocup_stage_matches_v1, eurocup_player_match_log_v1,
-- eurocup_team_match_log_v1) DEGISMEDI; source='sofascore' sabit kalir. FlashScore
-- fallback yalniz mac-detay yuzeyinde (getCupMatchPlayers + getCupMatchBars).

-- ---------------------------------------------------------------------------
-- 1) Eslesme tablosu
-- ---------------------------------------------------------------------------
create table if not exists ref.flashscore_sofa_match_map (
  sofascore_match_id   text primary key,
  flashscore_match_id  text not null,
  competition          text,
  confidence           numeric,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists flashscore_sofa_match_map_fs_idx
  on ref.flashscore_sofa_match_map (flashscore_match_id);
grant select on ref.flashscore_sofa_match_map to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) FS oyuncu-mac logu (FlashScore branch). match_id = SofaScore mac id (map ile),
--    boylece frontend AYNI SofaScore matchId ile sorgular (ref erisimi gerekmez).
--    is_home ile takim tarafi (FS takim id'si SofaScore'dan farkli; frontend
--    is_home + match.homeId/awayId ile eslestirir). FS raw_stats {typeId: rawValue}
--    + _rating/_position/_inBaseLineup.
-- ---------------------------------------------------------------------------
create or replace view analytics.eurocup_fs_player_match_log_v1 as
select
  m.season_label,
  m.competition,
  map.sofascore_match_id                             as match_id,   -- SofaScore mac id
  m.match_datetime,
  d.source_player_id                                  as player_id,  -- FS oyuncu id
  d.player_name,
  d.source_team_id                                    as team_id,    -- FS takim id (ham)
  d.team_name,
  case when d.player_side = 'home' then m.away_team_source_id else m.home_team_source_id end as opponent_id,
  case when d.player_side = 'home' then m.away_team_name       else m.home_team_name       end as opponent_name,
  d.player_side = 'home'                              as is_home,
  m.home_score,
  m.away_score,
  d.lineup_status,
  d.position_code,
  coalesce((d.raw_stats ->> 'MATCH_MINUTES_PLAYED')::numeric::integer, 0) as minutes,
  (d.raw_stats ->> '_rating')::numeric                                     as rating,
  coalesce((d.raw_stats ->> 'GOALS')::numeric::integer, 0)                 as goals,
  coalesce((d.raw_stats ->> 'ASSISTS_GOAL')::numeric::integer, 0)          as assists,
  coalesce((d.raw_stats ->> 'SHOTS_TOTAL')::numeric::integer, 0)           as shots,
  coalesce((d.raw_stats ->> 'SHOTS_ON_TARGET')::numeric::integer, 0)       as shots_on_target,
  coalesce((d.raw_stats ->> 'PASSES_TOTAL')::numeric::integer, 0)          as total_passes,
  coalesce((d.raw_stats ->> 'PASSES_ACCURATE')::numeric::integer, 0)       as accurate_passes,
  coalesce((d.raw_stats ->> 'KEY_PASSES')::numeric::integer, 0)            as key_passes,
  coalesce((d.raw_stats ->> 'TACKLES_TOTAL')::numeric::integer, 0)         as tackles,
  coalesce((d.raw_stats ->> 'INTERCEPTIONS')::numeric::integer, 0)         as interceptions,
  coalesce((d.raw_stats ->> 'CLEARANCES')::numeric::integer, 0)            as clearances,
  coalesce((d.raw_stats ->> 'BALL_RECOVERIES')::numeric::integer, 0)       as ball_recoveries,
  coalesce((d.raw_stats ->> 'DUELS_WON')::numeric::integer, 0)             as duels_won,
  coalesce((d.raw_stats ->> 'DUELS_AERIAL_WON')::numeric::integer, 0)      as aerials_won,
  coalesce((d.raw_stats ->> 'FOULS_COMMITTED')::numeric::integer, 0)       as fouls,
  coalesce((d.raw_stats ->> 'FOULS_SUFFERED')::numeric::integer, 0)        as was_fouled,
  coalesce((d.raw_stats ->> 'OFFSIDES')::numeric::integer, 0)              as offsides,
  coalesce((d.raw_stats ->> 'DRIBBLES_WON')::numeric::integer, 0)          as dribbles_won,
  coalesce((d.raw_stats ->> 'DRIBBLES_TOTAL')::numeric::integer, 0)        as dribbles_attempted,
  coalesce((d.raw_stats ->> 'TOUCHES_TOTAL')::numeric::integer, 0)         as touches,
  coalesce((d.raw_stats ->> 'SAVES_TOTAL')::numeric::integer, 0)           as saves
from football.match_player_stats_details d
join football.matches m
  on m.source = d.source and m.source_match_id = d.source_match_id
join ref.flashscore_sofa_match_map map
  on map.flashscore_match_id = d.source_match_id
where d.source = 'flashscore'
  and m.competition = any (array['UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi']);
grant select on analytics.eurocup_fs_player_match_log_v1 to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Kupa mac-detay takim marketleri (10 market), SofaScore -> FlashScore fallback
--    Cikti: her SofaScore kupa mac_id icin home_*/away_* metrikler.
--    Kaynak secimi: SofaScore gercek takim stat varsa (shots>0 veya xG) SofaScore,
--    yoksa map ile FlashScore. Karsilastirma team_side ile (takim id gerekmez).
-- ---------------------------------------------------------------------------
create or replace view analytics.eurocup_team_bars_v1 as
with cup_matches as (
  select source_match_id as match_id
  from football.matches
  where source = 'sofascore'
    and competition = any (array['UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi'])
),
sofa_real as (
  select distinct source_match_id
  from football.match_team_stats
  where source = 'sofascore'
    and (coalesce(summary_shots, 0) > 0 or details_expected_goals is not null)
),
resolved as (
  select cm.match_id,
    case when sr.source_match_id is not null then 'sofascore' else 'flashscore' end as src,
    case when sr.source_match_id is not null then cm.match_id else map.flashscore_match_id end as stats_match_id
  from cup_matches cm
  left join sofa_real sr on sr.source_match_id = cm.match_id
  left join ref.flashscore_sofa_match_map map on map.sofascore_match_id = cm.match_id
),
sides as (
  select r.match_id, ts.team_side,
    ts.summary_shots                                              as shots,
    ts.summary_shots_on_target                                   as sot,
    ts.summary_corners_won                                       as corners,
    ts.summary_saves                                             as saves,
    ts.summary_tackles                                           as tackles,
    ts.details_total_throws                                      as throws,
    ts.details_goal_kicks                                        as goal_kicks,
    ts.summary_fouls_conceded                                    as fouls,
    coalesce(ts.summary_yellow_cards,0) + 2*coalesce(ts.summary_red_cards,0) as cards,
    ts.summary_offsides                                          as offsides
  from resolved r
  join football.match_team_stats ts
    on ts.source = r.src and ts.source_match_id = r.stats_match_id
  where r.stats_match_id is not null
)
select match_id,
  max(shots)      filter (where team_side='home') as home_shots,
  max(shots)      filter (where team_side='away') as away_shots,
  max(sot)        filter (where team_side='home') as home_sot,
  max(sot)        filter (where team_side='away') as away_sot,
  max(corners)    filter (where team_side='home') as home_corners,
  max(corners)    filter (where team_side='away') as away_corners,
  max(saves)      filter (where team_side='home') as home_saves,
  max(saves)      filter (where team_side='away') as away_saves,
  max(tackles)    filter (where team_side='home') as home_tackles,
  max(tackles)    filter (where team_side='away') as away_tackles,
  max(throws)     filter (where team_side='home') as home_throws,
  max(throws)     filter (where team_side='away') as away_throws,
  max(goal_kicks) filter (where team_side='home') as home_goal_kicks,
  max(goal_kicks) filter (where team_side='away') as away_goal_kicks,
  max(fouls)      filter (where team_side='home') as home_fouls,
  max(fouls)      filter (where team_side='away') as away_fouls,
  max(cards)      filter (where team_side='home') as home_cards,
  max(cards)      filter (where team_side='away') as away_cards,
  max(offsides)   filter (where team_side='home') as home_offsides,
  max(offsides)   filter (where team_side='away') as away_offsides
from sides
group by match_id;
grant select on analytics.eurocup_team_bars_v1 to anon, authenticated;
