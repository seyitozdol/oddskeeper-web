-- 2026-10-01: Turkiye A Milli Futbol Takimi (header "TR", league anahtari 'trnat').
-- Onkosul: 2026-10-01_national_team_base.sql + 2026-10-01_national_team_guards.sql
--
-- Iki katman:
--   natl_*  : yuklu TUM milli takim maclari (Turkiye + rakipleri). Model
--             ekranlarinin (MSM/PSM) girdisi; rakibin de gecmisi gerekir.
--   trnat_* : Turkiye sayfasinin (Tournaments/Players/Results/Rankings) besledigi
--             view'lar; yalniz Turkiye'nin (sofascore takim id 4700) maclari.
--
-- KIMLIK: takim = sofascore team id (text), oyuncu = sofascore player id (text);
-- kupa (ucl/uel/uecl) yigini ile ayni. Oyuncu linkleri tek football profiline
-- gider (sofascore_football_player_link_v1), ayri profil sayfasi YOK.
--
-- SAYFA SEZON ANAHTARI: trnat_matches_v1 / trnat_player_season_stats_v1'deki
-- season_label kolonu TAKVIM SEZONU DEGIL, turnuva baskisi anahtaridir
-- ('<ut>-<sezon id>', or. '10783-89945' = Uluslar Ligi 26/27) ve ek olarak
-- 'all' (2023'ten beri tum resmi maclar). Kolon adi ortak cup saglayicisi
-- (eurocupData.makeCupProvider, .eq('season_label', ...)) ile uyum icin boyle.
-- Model katmani (natl_pm_*, msm.natl_*) ise gercek takvim sezonunu kullanir.

-- ============================================================ natl_* (genel)

create or replace view analytics.natl_stage_matches_v1 as
select m.source_match_id as match_id,
  m.competition,
  m.season_label,
  m.match_datetime,
  m.home_team_source_id as home_team_id,
  m.home_team_name,
  m.away_team_source_id as away_team_id,
  m.away_team_name,
  m.home_score,
  m.away_score,
  m.round_number,
  m.round_name,
  m.winner_team_source_id,
  em.unique_tournament_id,
  em.season_id,
  em.unique_tournament_id || '-' || em.season_id as edition_key,
  em.tournament_name as stage_name
from football.matches m
join ref.national_competitions nc on nc.competition = m.competition
left join football.national_event_meta em on em.event_id = m.source_match_id
where m.source = 'sofascore';

-- eurocup_player_match_log_v1 ile ayni kolonlar/sira (mac detayi + PSM logu).
create or replace view analytics.natl_player_match_log_v1 as
select m.season_label,
  m.competition,
  m.source_match_id as match_id,
  m.match_datetime,
  d.source_player_id as player_id,
  d.player_name,
  d.source_team_id as team_id,
  d.team_name,
  case when d.player_side = 'home' then m.away_team_source_id else m.home_team_source_id end as opponent_id,
  case when d.player_side = 'home' then m.away_team_name else m.home_team_name end as opponent_name,
  d.player_side = 'home' as is_home,
  m.home_score,
  m.away_score,
  d.lineup_status,
  d.position_code,
  coalesce((d.raw_stats ->> 'minutesPlayed')::integer, 0) as minutes,
  (d.raw_stats ->> 'rating')::numeric as rating,
  coalesce((d.raw_stats ->> 'goals')::integer, 0) as goals,
  coalesce((d.raw_stats ->> 'goalAssist')::integer, 0) as assists,
  coalesce((d.raw_stats ->> 'totalShots')::integer, 0) as shots,
  coalesce((d.raw_stats ->> 'onTargetScoringAttempt')::integer, 0) as shots_on_target,
  coalesce((d.raw_stats ->> 'totalPass')::integer, 0) as total_passes,
  coalesce((d.raw_stats ->> 'accuratePass')::integer, 0) as accurate_passes,
  coalesce((d.raw_stats ->> 'keyPass')::integer, 0) as key_passes,
  coalesce((d.raw_stats ->> 'totalCross')::integer, 0) as crosses,
  coalesce((d.raw_stats ->> 'accurateCross')::integer, 0) as accurate_crosses,
  coalesce((d.raw_stats ->> 'totalLongBalls')::integer, 0) as long_balls,
  coalesce((d.raw_stats ->> 'accurateLongBalls')::integer, 0) as accurate_long_balls,
  coalesce((d.raw_stats ->> 'totalTackle')::integer, 0) as tackles,
  coalesce((d.raw_stats ->> 'wonTackle')::integer, 0) as tackles_won,
  coalesce((d.raw_stats ->> 'interceptionWon')::integer, 0) as interceptions,
  coalesce((d.raw_stats ->> 'totalClearance')::integer, 0) as clearances,
  coalesce((d.raw_stats ->> 'outfielderBlock')::integer, 0) as blocks,
  coalesce((d.raw_stats ->> 'ballRecovery')::integer, 0) as ball_recoveries,
  coalesce((d.raw_stats ->> 'duelWon')::integer, 0) as duels_won,
  coalesce((d.raw_stats ->> 'duelLost')::integer, 0) as duels_lost,
  coalesce((d.raw_stats ->> 'aerialWon')::integer, 0) as aerials_won,
  coalesce((d.raw_stats ->> 'aerialLost')::integer, 0) as aerials_lost,
  coalesce((d.raw_stats ->> 'fouls')::integer, 0) as fouls,
  coalesce((d.raw_stats ->> 'wasFouled')::integer, 0) as was_fouled,
  coalesce((d.raw_stats ->> 'totalOffside')::integer, 0) as offsides,
  coalesce((d.raw_stats ->> 'dispossessed')::integer, 0) as dispossessed,
  coalesce((d.raw_stats ->> 'possessionLostCtrl')::integer, 0) as possession_lost,
  coalesce((d.raw_stats ->> 'wonContest')::integer, 0) as dribbles_won,
  coalesce((d.raw_stats ->> 'totalContest')::integer, 0) as dribbles_attempted,
  coalesce((d.raw_stats ->> 'touches')::integer, 0) as touches,
  coalesce((d.raw_stats ->> 'saves')::integer, 0) as saves,
  coalesce((d.raw_stats ->> 'penaltySave')::integer, 0) as penalties_saved,
  (d.raw_stats ->> 'kilometersCovered')::numeric as km_covered,
  (d.raw_stats ->> 'numberOfSprints')::integer as sprints,
  (d.raw_stats ->> 'topSpeed')::numeric as top_speed
from football.mpsd_with_raw d
join football.matches m on m.source = d.source and m.source_match_id = d.source_match_id
join ref.national_competitions nc on nc.competition = m.competition
where d.source = 'sofascore';

-- Mac detayi takim cubuklari (eurocup_team_bars_v1 sekli; FlashScore fallback yok,
-- SofaScore milli maclarda takim istatistigini tam veriyor).
create or replace view analytics.natl_team_bars_v1 as
select ts.source_match_id as match_id,
  max(ts.summary_shots) filter (where ts.team_side = 'home') as home_shots,
  max(ts.summary_shots) filter (where ts.team_side = 'away') as away_shots,
  max(ts.summary_shots_on_target) filter (where ts.team_side = 'home') as home_sot,
  max(ts.summary_shots_on_target) filter (where ts.team_side = 'away') as away_sot,
  max(ts.summary_corners_won) filter (where ts.team_side = 'home') as home_corners,
  max(ts.summary_corners_won) filter (where ts.team_side = 'away') as away_corners,
  max(ts.summary_saves) filter (where ts.team_side = 'home') as home_saves,
  max(ts.summary_saves) filter (where ts.team_side = 'away') as away_saves,
  max(ts.summary_tackles) filter (where ts.team_side = 'home') as home_tackles,
  max(ts.summary_tackles) filter (where ts.team_side = 'away') as away_tackles,
  max(ts.details_total_throws) filter (where ts.team_side = 'home') as home_throws,
  max(ts.details_total_throws) filter (where ts.team_side = 'away') as away_throws,
  max(ts.details_goal_kicks) filter (where ts.team_side = 'home') as home_goal_kicks,
  max(ts.details_goal_kicks) filter (where ts.team_side = 'away') as away_goal_kicks,
  max(ts.summary_fouls_conceded) filter (where ts.team_side = 'home') as home_fouls,
  max(ts.summary_fouls_conceded) filter (where ts.team_side = 'away') as away_fouls,
  max(coalesce(ts.summary_yellow_cards, 0) + 2 * coalesce(ts.summary_red_cards, 0)) filter (where ts.team_side = 'home') as home_cards,
  max(coalesce(ts.summary_yellow_cards, 0) + 2 * coalesce(ts.summary_red_cards, 0)) filter (where ts.team_side = 'away') as away_cards,
  max(ts.summary_offsides) filter (where ts.team_side = 'home') as home_offsides,
  max(ts.summary_offsides) filter (where ts.team_side = 'away') as away_offsides
from football.match_team_stats ts
join ref.national_competitions nc on nc.competition = ts.competition
where ts.source = 'sofascore'
group by ts.source_match_id;

-- ============================================================ trnat_* (Turkiye sayfasi)

-- Turkiye'nin fiksturu (ucl_fixtures_v1 sekli + baski anahtari). season_label
-- burada GERCEK takvim sezonu (PSM/MSM okur).
create or replace view analytics.trnat_fixtures_v1 as
select f.fixture_id,
  f.season_label,
  f.competition,
  f.round_number,
  f.fixture_date,
  f.fixture_datetime,
  f.home_team_source_id as home_team_id,
  f.home_team_name,
  f.away_team_source_id as away_team_id,
  f.away_team_name,
  f.fixture_status,
  em.unique_tournament_id || '-' || em.season_id as edition_key,
  em.tournament_name as stage_name
from football.fixtures f
join ref.national_competitions nc on nc.competition = f.competition
left join football.national_event_meta em on em.event_id = f.fixture_id::text
where f.source = 'sofascore'
  and '4700' in (f.home_team_source_id, f.away_team_source_id);

-- Turkiye'nin oynanmis maclari; season_label = baski anahtari | 'all'.
-- competition = sayfa duzeyi sabit etiket (saglayici .eq('competition') suzer),
-- gercek turnuva adi tournament kolonunda.
create or replace view analytics.trnat_matches_v1 as
select k.season_label,
  m.match_id,
  'Milli Takım'::text as competition,
  m.competition as tournament,
  m.match_datetime,
  m.home_team_id,
  m.home_team_name,
  m.away_team_id,
  m.away_team_name,
  m.home_score,
  m.away_score,
  m.round_number,
  m.round_name,
  m.stage_name,
  m.edition_key
from analytics.natl_stage_matches_v1 m
cross join lateral (values (m.edition_key), ('all'::text)) k(season_label)
where '4700' in (m.home_team_id, m.away_team_id)
  and k.season_label is not null;

-- Turkiye'nin yer aldigi turnuva baskilari (sezon secici + Tournaments sekmesi).
create or replace view analytics.trnat_editions_v1 as
with played as (
  select edition_key, count(*) as played,
    min(match_datetime) as first_match, max(match_datetime) as last_match
  from analytics.natl_stage_matches_v1
  where '4700' in (home_team_id, away_team_id) and home_score is not null and edition_key is not null
  group by edition_key
), upcoming as (
  select edition_key, count(*) as upcoming, min(fixture_datetime) as next_fixture
  from analytics.trnat_fixtures_v1
  where fixture_status in ('scheduled', 'live', 'postponed')
    and fixture_datetime > now() - interval '3 hours' and edition_key is not null
  group by edition_key
)
select e.unique_tournament_id || '-' || e.season_id as edition_key,
  e.unique_tournament_id,
  e.season_id,
  e.competition,
  nc.name_en,
  nc.name_tr,
  nc.short_en || ' ' || coalesce(e.year_text, '') as label_en,
  nc.short_tr || ' ' || coalesce(e.year_text, '') as label_tr,
  e.year_text,
  coalesce(p.played, 0) as played,
  coalesce(u.upcoming, 0) as upcoming,
  p.first_match,
  p.last_match,
  u.next_fixture
from football.national_editions e
join ref.national_competitions nc on nc.unique_tournament_id = e.unique_tournament_id
left join played p on p.edition_key = e.unique_tournament_id || '-' || e.season_id
left join upcoming u on u.edition_key = e.unique_tournament_id || '-' || e.season_id
where p.edition_key is not null or u.edition_key is not null;

-- Baskinin grup tablosu (SofaScore standings; Turkiye'yi iceren grup).
create or replace view analytics.trnat_standings_v1 as
select s.unique_tournament_id || '-' || s.season_id as edition_key,
  s.group_name,
  s.position,
  s.team_source_id as team_id,
  s.team_name,
  s.played, s.wins, s.draws, s.losses,
  s.goals_for, s.goals_against, s.points,
  s.note,
  s.updated_at
from football.national_standings s;

-- Turkiye oyunculari: baski | 'all' x oyuncu. Kolonlar ucl_player_season_stats_v1
-- ile ayni (ortak cup saglayicisi + CUP_PLAYER_MAP). xG yalniz SofaScore'un
-- verdigi maclarda dolu (final turnuvalari + Uluslar Ligi 26/27).
create or replace view analytics.trnat_player_season_stats_v1 as
with base as (
  select em.unique_tournament_id || '-' || em.season_id as edition_key,
    d.source_match_id,
    d.source_player_id,
    d.player_name,
    d.team_name,
    d.source_team_id,
    d.position_code,
    d.lineup_status,
    m.match_datetime,
    coalesce((d.raw_stats ->> 'minutesPlayed')::integer, 0) as minutes,
    (d.raw_stats ->> 'rating')::numeric as rating,
    coalesce((d.raw_stats ->> 'goals')::integer, 0) as goals,
    coalesce((d.raw_stats ->> 'goalAssist')::integer, 0) as assists,
    coalesce((d.raw_stats ->> 'ownGoals')::integer, 0) as own_goals,
    coalesce((d.raw_stats ->> 'totalShots')::integer, 0) as shots,
    coalesce((d.raw_stats ->> 'onTargetScoringAttempt')::integer, 0) as shots_on_target,
    coalesce((d.raw_stats ->> 'bigChanceMissed')::integer, 0) as big_chances_missed,
    coalesce((d.raw_stats ->> 'hitWoodwork')::integer, 0) as hit_woodwork,
    coalesce((d.raw_stats ->> 'totalPass')::integer, 0) as total_passes,
    coalesce((d.raw_stats ->> 'accuratePass')::integer, 0) as accurate_passes,
    coalesce((d.raw_stats ->> 'keyPass')::integer, 0) as key_passes,
    coalesce((d.raw_stats ->> 'bigChanceCreated')::integer, 0) as big_chances_created,
    coalesce((d.raw_stats ->> 'totalCross')::integer, 0) as crosses,
    coalesce((d.raw_stats ->> 'accurateCross')::integer, 0) as accurate_crosses,
    coalesce((d.raw_stats ->> 'totalLongBalls')::integer, 0) as long_balls,
    coalesce((d.raw_stats ->> 'accurateLongBalls')::integer, 0) as accurate_long_balls,
    coalesce((d.raw_stats ->> 'totalTackle')::integer, 0) as tackles,
    coalesce((d.raw_stats ->> 'wonTackle')::integer, 0) as tackles_won,
    coalesce((d.raw_stats ->> 'interceptionWon')::integer, 0) as interceptions,
    coalesce((d.raw_stats ->> 'totalClearance')::integer, 0) as clearances,
    coalesce((d.raw_stats ->> 'outfielderBlock')::integer, 0) as blocks,
    coalesce((d.raw_stats ->> 'ballRecovery')::integer, 0) as ball_recoveries,
    coalesce((d.raw_stats ->> 'duelWon')::integer, 0) as duels_won,
    coalesce((d.raw_stats ->> 'duelLost')::integer, 0) as duels_lost,
    coalesce((d.raw_stats ->> 'aerialWon')::integer, 0) as aerials_won,
    coalesce((d.raw_stats ->> 'aerialLost')::integer, 0) as aerials_lost,
    coalesce((d.raw_stats ->> 'fouls')::integer, 0) as fouls,
    coalesce((d.raw_stats ->> 'wasFouled')::integer, 0) as was_fouled,
    coalesce((d.raw_stats ->> 'totalOffside')::integer, 0) as offsides,
    coalesce((d.raw_stats ->> 'dispossessed')::integer, 0) as dispossessed,
    coalesce((d.raw_stats ->> 'possessionLostCtrl')::integer, 0) as possession_lost,
    coalesce((d.raw_stats ->> 'wonContest')::integer, 0) as dribbles_won,
    coalesce((d.raw_stats ->> 'totalContest')::integer, 0) as dribbles_attempted,
    coalesce((d.raw_stats ->> 'touches')::integer, 0) as touches,
    coalesce((d.raw_stats ->> 'saves')::integer, 0) as saves,
    coalesce((d.raw_stats ->> 'penaltySave')::integer, 0) as penalties_saved,
    coalesce((d.raw_stats ->> 'errorLeadToAShot')::integer, 0) as errors_leading_to_shot,
    coalesce((d.raw_stats ->> 'errorLeadToAGoal')::integer, 0) as errors_leading_to_goal,
    (d.raw_stats ->> 'kilometersCovered')::numeric as km_covered,
    (d.raw_stats ->> 'numberOfSprints')::integer as sprints,
    (d.raw_stats ->> 'topSpeed')::numeric as top_speed,
    (d.raw_stats ->> 'expectedGoals')::numeric as xg,
    (d.raw_stats ->> 'expectedGoalsOnTarget')::numeric as xgot,
    (d.raw_stats ->> 'expectedAssists')::numeric as xa,
    d.raw_stats ->> 'position' as fs_position
  from football.mpsd_with_raw d
  join football.matches m on m.source = d.source and m.source_match_id = d.source_match_id
  join ref.national_competitions nc on nc.competition = m.competition
  join football.national_event_meta em on em.event_id = m.source_match_id
  where d.source = 'sofascore' and d.source_team_id = '4700'
), cards as (
  select pc.source_match_id, pc.source_player_id,
    count(*) filter (where pc.card_class = 'yellow') as yellow_cards,
    count(*) filter (where pc.card_class in ('red', 'yellowRed')) as red_cards
  from football.match_player_cards pc
  where pc.source = 'sofascore' and pc.on_pitch and not pc.rescinded
  group by pc.source_match_id, pc.source_player_id
), agg as (
  select k.season_label,
    b.source_player_id as player_id,
    max(b.player_name) as player_name,
    (array_agg(b.team_name order by b.match_datetime desc))[1] as team_name,
    (array_agg(b.source_team_id order by b.match_datetime desc))[1] as team_id,
    string_agg(distinct b.team_name, ', ') as teams,
    mode() within group (order by b.position_code) as position_code,
    count(*) filter (where b.minutes > 0) as appearances,
    count(*) filter (where b.lineup_status = 'starter') as starts,
    sum(b.minutes) as minutes,
    sum(b.goals) as goals,
    sum(b.assists) as assists,
    sum(b.own_goals) as own_goals,
    sum(b.shots) as shots,
    sum(b.shots_on_target) as shots_on_target,
    sum(b.big_chances_missed) as big_chances_missed,
    sum(b.hit_woodwork) as hit_woodwork,
    sum(b.total_passes) as total_passes,
    sum(b.accurate_passes) as accurate_passes,
    case when sum(b.total_passes) > 0
      then round(100.0 * sum(b.accurate_passes)::numeric / sum(b.total_passes)::numeric, 1) end as pass_accuracy,
    sum(b.key_passes) as key_passes,
    sum(b.big_chances_created) as big_chances_created,
    sum(b.crosses) as crosses,
    sum(b.accurate_crosses) as accurate_crosses,
    sum(b.long_balls) as long_balls,
    sum(b.accurate_long_balls) as accurate_long_balls,
    sum(b.tackles) as tackles,
    sum(b.tackles_won) as tackles_won,
    sum(b.interceptions) as interceptions,
    sum(b.clearances) as clearances,
    sum(b.blocks) as blocks,
    sum(b.ball_recoveries) as ball_recoveries,
    sum(b.duels_won) as duels_won,
    sum(b.duels_lost) as duels_lost,
    sum(b.aerials_won) as aerials_won,
    sum(b.aerials_lost) as aerials_lost,
    sum(b.fouls) as fouls,
    sum(b.was_fouled) as was_fouled,
    sum(b.offsides) as offsides,
    sum(b.dispossessed) as dispossessed,
    sum(b.possession_lost) as possession_lost,
    sum(b.dribbles_won) as dribbles_won,
    sum(b.dribbles_attempted) as dribbles_attempted,
    sum(b.touches) as touches,
    sum(b.saves) as saves,
    sum(b.penalties_saved) as penalties_saved,
    sum(b.errors_leading_to_shot) as errors_leading_to_shot,
    sum(b.errors_leading_to_goal) as errors_leading_to_goal,
    round(avg(b.rating) filter (where b.minutes > 0), 2) as rating_avg,
    round(sum(b.km_covered), 1) as km_covered,
    sum(b.sprints) as sprints,
    max(b.top_speed) as top_speed,
    round(sum(b.xg), 2) as xg,
    round(sum(b.xgot), 2) as xgot,
    round(sum(b.xa), 2) as xa,
    coalesce(sum(c.yellow_cards), 0) as yellow_cards,
    coalesce(sum(c.red_cards), 0) as red_cards,
    mode() within group (order by b.fs_position) as fs_position
  from base b
  cross join lateral (values (b.edition_key), ('all'::text)) k(season_label)
  left join cards c on c.source_match_id = b.source_match_id and c.source_player_id = b.source_player_id
  group by k.season_label, b.source_player_id
)
select a.*,
  i.photo_url,
  i.country,
  l.player_slug
from agg a
left join football.sofascore_player_info i on i.sofascore_player_id = a.player_id
left join analytics.sofascore_football_player_link_v1 l on l.sofascore_player_id = a.player_id;

-- ============================================================ PSM (natl_pm_*)
-- eurocup_pm_* zinciriyle ayni sekil; competition sabit 'Milli Takım' (PSM
-- .eq('competition') suzer), gercek turnuva tournament kolonunda. Uluslar Ligi,
-- elemeler ve final turnuvalari AYNI takvim sezonunda birlikte sayilir.

drop materialized view if exists analytics.natl_pm_squad_mat;
drop materialized view if exists analytics.natl_pm_player_season_mat;
drop view if exists analytics.natl_pm_player_season_v1;
drop materialized view if exists analytics.natl_pm_player_match_log_mat;

create materialized view analytics.natl_pm_player_match_log_mat as
select l.season_label,
  'Milli Takım'::text as competition,
  l.match_id, l.match_datetime, l.player_id, l.player_name, l.team_id, l.team_name,
  l.opponent_id, l.opponent_name, l.is_home, l.home_score, l.away_score,
  l.lineup_status, l.position_code, l.minutes, l.rating, l.goals, l.assists,
  l.shots, l.shots_on_target, l.total_passes, l.accurate_passes, l.key_passes,
  l.crosses, l.accurate_crosses, l.long_balls, l.accurate_long_balls,
  l.tackles, l.tackles_won, l.interceptions, l.clearances, l.blocks,
  l.ball_recoveries, l.duels_won, l.duels_lost, l.aerials_won, l.aerials_lost,
  l.fouls, l.was_fouled, l.offsides, l.dispossessed, l.possession_lost,
  l.dribbles_won, l.dribbles_attempted, l.touches, l.saves, l.penalties_saved,
  l.km_covered, l.sprints, l.top_speed,
  l.competition as tournament
from analytics.natl_player_match_log_v1 l;
create unique index uq_natl_pm_log_mat
  on analytics.natl_pm_player_match_log_mat (competition, season_label, match_id, player_id);
create index ix_natl_pm_log_player
  on analytics.natl_pm_player_match_log_mat (competition, player_id, match_datetime desc);

create view analytics.natl_pm_player_season_v1 as
select competition,
  season_label,
  player_id,
  max(player_name) as player_name,
  (array_agg(team_id order by match_datetime desc))[1] as team_id,
  (array_agg(team_name order by match_datetime desc))[1] as team_name,
  mode() within group (order by position_code) as position_code,
  count(*) filter (where minutes > 0) as appearances,
  count(*) filter (where lineup_status = 'starter') as starts,
  sum(minutes) as minutes,
  max(match_datetime) filter (where minutes > 0) as last_match_datetime,
  sum(goals) as goals,
  sum(assists) as assists,
  sum(shots) as shots,
  sum(shots_on_target) as shots_on_target,
  sum(total_passes) as total_passes,
  sum(accurate_passes) as accurate_passes,
  sum(key_passes) as key_passes,
  sum(crosses) as crosses,
  sum(tackles) as tackles,
  sum(interceptions) as interceptions,
  sum(clearances) as clearances,
  sum(blocks) as blocks,
  sum(ball_recoveries) as ball_recoveries,
  sum(duels_won) as duels_won,
  sum(aerials_won) as aerials_won,
  sum(fouls) as fouls,
  sum(was_fouled) as was_fouled,
  sum(offsides) as offsides,
  sum(dribbles_won) as dribbles_won,
  sum(touches) as touches,
  sum(saves) as saves
from analytics.natl_pm_player_match_log_mat
group by competition, season_label, player_id;

create materialized view analytics.natl_pm_player_season_mat as
select * from analytics.natl_pm_player_season_v1;
create unique index uq_natl_pm_season_mat
  on analytics.natl_pm_player_season_mat (competition, season_label, player_id);

-- Kadro: milli takimda "sezon rosteri" yok; takimin SON 8 resmi macinin mac
-- kadrosunda (yedek kulubesi dahil) yer alan oyuncular. Oynama oranlari da bu
-- pencereden (PSM Starter/Sub tahmini guncel cagrilanlara dayansin).
create materialized view analytics.natl_pm_squad_mat as
with team_matches as (
  select team_id, match_id,
    dense_rank() over (partition by team_id order by match_datetime desc, match_id desc) as rn
  from (select distinct team_id, match_id, match_datetime from analytics.natl_pm_player_match_log_mat) x
), recent as (
  select l.*
  from analytics.natl_pm_player_match_log_mat l
  join team_matches tm on tm.team_id = l.team_id and tm.match_id = l.match_id
  where tm.rn <= 8
), agg as (
  select competition,
    team_id,
    (array_agg(team_name order by match_datetime desc))[1] as team_name,
    player_id,
    max(player_name) as player_name,
    mode() within group (order by position_code) as position_code,
    count(*) filter (where minutes > 0) as appearances,
    count(*) filter (where lineup_status = 'starter') as starts,
    sum(minutes) as minutes,
    max(match_datetime) filter (where minutes > 0) as last_match_datetime
  from recent
  group by competition, team_id, player_id
)
select a.competition,
  a.team_id,
  a.team_name,
  a.player_id,
  coalesce(i.player_name, a.player_name) as player_name,
  coalesce(i."position", a.position_code) as "position",
  i.photo_url,
  i.birth_date,
  i.country,
  null::numeric as market_value_eur,
  'roster'::text as membership_source,
  a.appearances,
  a.starts,
  a.minutes,
  round(100.0 * a.starts::numeric / nullif(a.appearances, 0)::numeric) as starter_rate_pct,
  a.last_match_datetime
from agg a
left join football.sofascore_player_info i on i.sofascore_player_id = a.player_id;
create unique index uq_natl_pm_squad_mat
  on analytics.natl_pm_squad_mat (competition, team_id, player_id);

-- Sut bolgeleri (PSM "SOT In Box / Out Box"): mac + sezon; competition sabit.
create or replace view analytics.natl_shot_zones_match_v1 as
select z.source_match_id,
  'Milli Takım'::text as competition,
  z.season_label,
  z.match_datetime,
  z.sofascore_player_id,
  z.opta_player_id,
  z.player_name,
  z.shots_total, z.shots_ibox, z.shots_obox,
  z.sot_total, z.sot_ibox, z.sot_obox,
  z.goals_ibox, z.goals_obox
from analytics.player_shot_zones_match_mat z
join ref.national_competitions nc on nc.competition = z.competition;

create or replace view analytics.natl_shot_zones_season_v1 as
select competition,
  sofascore_player_id,
  season_label,
  count(*) as matches,
  sum(shots_total) as shots_total,
  sum(shots_ibox) as shots_ibox,
  sum(shots_obox) as shots_obox,
  sum(sot_total) as sot_total,
  sum(sot_ibox) as sot_ibox,
  sum(sot_obox) as sot_obox,
  sum(goals_ibox) as goals_ibox,
  sum(goals_obox) as goals_obox
from analytics.natl_shot_zones_match_v1
group by competition, sofascore_player_id, season_label;

-- ============================================================ MSM (league 'trnat')
-- msm.eurocup_team_match_log_v1 deseni: kimlik = sofascore takim id (team_slug
-- kolonunda), "gercek istatistik" kapisi ayni. Sezon = gercek takvim sezonu.

create or replace view msm.natl_team_match_log_v1 as
with pair as (
  select 'trnat'::text as league,
    replace(coalesce(m.season_label, ''), '/', '-') as season,
    t.source,
    3 as source_rank,
    t.source_match_id,
    m.match_datetime,
    t.source_team_id as team_slug,
    t.team_name,
    t.team_side = 'home' as is_home,
    t.opponent_team_source_id as opp_slug,
    t.opponent_team_name,
    t.summary_shots as f_shot, o.summary_shots as a_shot,
    t.summary_shots_on_target as f_sot, o.summary_shots_on_target as a_sot,
    t.summary_fouls_conceded as f_foul, o.summary_fouls_conceded as a_foul,
    t.summary_corners_won as f_corner, o.summary_corners_won as a_corner,
    t.summary_offsides as f_offside, o.summary_offsides as a_offside,
    t.summary_saves as f_saves, o.summary_saves as a_saves,
    t.summary_tackles as f_tackle, o.summary_tackles as a_tackle,
    coalesce(t.summary_yellow_cards, 0) + coalesce(t.summary_red_cards, 0) * 2 as f_card,
    coalesce(o.summary_yellow_cards, 0) + coalesce(o.summary_red_cards, 0) * 2 as a_card,
    t.details_total_throws as f_throw, o.details_total_throws as a_throw,
    t.details_goal_kicks as f_gkick, o.details_goal_kicks as a_gkick,
    coalesce(t.summary_red_cards, 0) + coalesce(o.summary_red_cards, 0) as match_red_cards,
    m.referee
  from football.match_team_stats t
  join football.matches m on m.source = t.source and m.source_match_id = t.source_match_id
  join ref.national_competitions nc on nc.competition = m.competition
  join football.match_team_stats o on o.source = t.source and o.source_match_id = t.source_match_id
    and o.team_side <> t.team_side
  where t.source = 'sofascore'
    and (t.summary_shots > 0 or t.details_expected_goals is not null)
    and (o.summary_shots > 0 or o.details_expected_goals is not null)
), indexed as (
  select p.*,
    dense_rank() over (partition by p.league, p.season, p.team_slug
                       order by p.match_datetime, p.source_match_id) as team_match_index
  from pair p
), unp as (
  select i.league, i.season, i.source, i.source_rank, i.source_match_id, i.match_datetime,
    i.team_slug, i.team_name, i.is_home, i.opp_slug, i.opponent_team_name,
    i.team_match_index, i.match_red_cards, v.market, v.for_value, v.against_value, i.referee
  from indexed i
  cross join lateral (values
    ('Shot'::text, i.f_shot, i.a_shot), ('SOT', i.f_sot, i.a_sot), ('Foul', i.f_foul, i.a_foul),
    ('Corner', i.f_corner, i.a_corner), ('Offside', i.f_offside, i.a_offside),
    ('Saves', i.f_saves, i.a_saves), ('Tackle', i.f_tackle, i.a_tackle), ('Card', i.f_card, i.a_card),
    ('Throw-in', i.f_throw, i.a_throw), ('Goal Kick', i.f_gkick, i.a_gkick)
  ) v(market, for_value, against_value)
)
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from unp
where team_slug is not null and for_value is not null;

create or replace view msm.natl_team_season_stats_v1 as
select league, season, team_slug, market, source,
  min(source_rank) as source_rank,
  count(*) filter (where is_home) as home_games,
  count(*) filter (where not is_home) as away_games,
  avg(for_value) filter (where is_home) as hf,
  avg(against_value) filter (where is_home) as ha,
  avg(for_value) filter (where not is_home) as af,
  avg(against_value) filter (where not is_home) as aa
from msm.natl_team_match_log_v1
group by league, season, team_slug, market, source;

-- Gecmis sezon degerleri (histdata) milli takimda CANLI hesaplanir: yeni rakip
-- geldikce gecmisi sonradan yuklenir, seed tablosu bayatlardi. Guncel sezon
-- haric her sezon; eksik saha (yalniz ev ya da yalniz deplasman oynanmis) genel
-- ortalamaya duser (kupa seed'indeki kuralin aynisi).
create or replace view msm.natl_histdata_v1 as
select l.league,
  l.season,
  l.market,
  max(l.team_name) as team_name,
  l.team_slug,
  coalesce(avg(l.for_value) filter (where l.is_home), avg(l.for_value)) as hf,
  coalesce(avg(l.against_value) filter (where l.is_home), avg(l.against_value)) as ha,
  coalesce(avg(l.for_value) filter (where not l.is_home), avg(l.for_value)) as af,
  coalesce(avg(l.against_value) filter (where not l.is_home), avg(l.against_value)) as aa,
  max(l.match_datetime) as updated_at,
  false as estimated
from msm.natl_team_match_log_v1 l
where l.season < replace(ref.current_season_label(), '/', '-')
group by l.league, l.season, l.market, l.team_slug;

create or replace view analytics.msm_team_match_log_v1 as
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from msm.team_match_log_v1
union all
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from msm.eurocup_team_match_log_v1
union all
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from msm.natl_team_match_log_v1;

create or replace view analytics.msm_team_season_stats_v1 as
select league, season, team_slug, market, source, source_rank,
  home_games, away_games, hf, ha, af, aa
from msm.team_season_stats_v1
union all
select league, season, team_slug, market, source, source_rank,
  home_games, away_games, hf, ha, af, aa
from msm.eurocup_team_season_stats_v1
union all
select league, season, team_slug, market, source, source_rank,
  home_games, away_games, hf, ha, af, aa
from msm.natl_team_season_stats_v1;

create or replace view analytics.msm_histdata_v1 as
select league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at, estimated
from msm.histdata
union all
select league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at, estimated
from msm.natl_histdata_v1;

create or replace view analytics.msm_teams_v1 as
select h.league, h.team_slug,
  coalesce(dn.display_name, lg.team_name, h.team_name, h.team_slug) as display_name
from (
  select league, team_slug, max(team_name) as team_name
  from msm.histdata group by league, team_slug
  union all
  select 'trnat'::text, team_slug, max(team_name)
  from msm.natl_team_match_log_v1 group by team_slug
) h
left join lateral (
  select tm.display_name from ref.team_mapping tm
  where tm.team_slug = h.team_slug
  order by tm.is_active desc nulls last, length(tm.display_name) desc
  limit 1
) dn on true
left join analytics.tff1_team_logos_v1 lg on lg.team_id = h.team_slug;

-- MSM fikstur: Turkiye'nin guncel sezon maclari. round_number turnuvalar arasi
-- cakismasin diye sezon ici SIRA numarasi (Uluslar Ligi R1 ile eleme R1 ayni
-- "hafta"da gorunmesin). competition/season_label frontend filtresiyle uyum icin
-- sabit (queries.ts COMPETITION + FIXTURE_SEASON).
create or replace view analytics.msm_fixtures_trnat_v1 as
select f.fixture_id,
  (row_number() over (order by f.fixture_datetime, f.fixture_id))::integer as round_number,
  'Milli Takım'::text as competition,
  ref.current_season_label() as season_label,
  f.home_team_id as home_team_slug,
  f.away_team_id as away_team_slug,
  f.home_team_name,
  f.away_team_name,
  f.fixture_datetime
from analytics.trnat_fixtures_v1 f
where f.season_label = ref.current_season_label()
   or f.fixture_datetime >= now() - interval '7 days';

-- ------------------------------------------------------------ MSM seed (tsl kopyasi)
-- Agirliklar tsl ile ayni (3 gecmis sezon + guncel); hakem verisi milli maclarda
-- yok -> referee_applies=false. Kolon listesi dinamik: tabloya sonradan eklenen
-- ayarlar da kopyalanir.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'msm' and table_name = 'model_config' and column_name not in ('league', 'updated_at');
  execute format(
    'insert into msm.model_config (league, %s) select ''trnat'', %s from msm.model_config where league = ''tsl'' on conflict (league) do nothing',
    cols, cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'msm' and table_name = 'market_config' and column_name not in ('league', 'updated_at');
  execute format(
    'insert into msm.market_config (league, %s) select ''trnat'', %s from msm.market_config where league = ''tsl'' on conflict (league, market) do nothing',
    cols, cols);
  update msm.market_config set referee_applies = false where league = 'trnat' and referee_applies;

  insert into msm.template (league, market, template_code, details, sort_order)
  select 'trnat', t.market, t.template_code, t.details, t.sort_order
  from msm.template t where t.league = 'tsl'
  on conflict do nothing;
end $$;

-- ------------------------------------------------------------ grant'lar
-- anon'a HICBIR sey yok (anon lockdown); mat grant'lari pg_class.relacl'da durur.
grant select on
  analytics.natl_stage_matches_v1, analytics.natl_player_match_log_v1, analytics.natl_team_bars_v1,
  analytics.trnat_fixtures_v1, analytics.trnat_matches_v1, analytics.trnat_editions_v1,
  analytics.trnat_standings_v1, analytics.trnat_player_season_stats_v1,
  analytics.natl_pm_player_match_log_mat, analytics.natl_pm_player_season_v1,
  analytics.natl_pm_player_season_mat, analytics.natl_pm_squad_mat,
  analytics.natl_shot_zones_match_v1, analytics.natl_shot_zones_season_v1,
  analytics.msm_fixtures_trnat_v1
to authenticated, service_role;

notify pgrst, 'reload schema';
