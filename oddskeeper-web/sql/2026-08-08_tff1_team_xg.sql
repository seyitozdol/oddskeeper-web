-- 2026-08-08: tff1 takim view'ina xG eklendi (frontend team tablosu xg bekliyordu, bostu).
-- Kaynak: football.match_team_stats (source='sofascore', details_expected_goals) =
-- SofaScore statistics takim xG'si (yeni takim-stat scraper yaziyor). Oyuncu-xG toplami
-- degil (o eslesmeye bagli, eksik olur); resmi takim xG'si daha dogru. 26/27 dolar,
-- 25/26 team-stat satiri olmadigi icin null (regresyon yok, view'da xG zaten yoktu).
create or replace view analytics.tff1_team_season_stats_v1 as
with team_matches as (
  select season_label, home_team_source_id as team_id, home_team_name as team_name,
         home_score as gf, away_score as ga
  from football.matches
  where source = 'sofascore' and competition = 'Trendyol 1. Lig'
  union all
  select season_label, away_team_source_id, away_team_name, away_score, home_score
  from football.matches
  where source = 'sofascore' and competition = 'Trendyol 1. Lig'
),
standings as (
  select
    season_label,
    team_id,
    max(team_name)                                   as team_name,
    count(*)                                         as played,
    count(*) filter (where gf > ga)                  as wins,
    count(*) filter (where gf = ga)                  as draws,
    count(*) filter (where gf < ga)                  as losses,
    sum(gf)                                          as goals_for,
    sum(ga)                                          as goals_against,
    sum(gf) - sum(ga)                                as goal_diff,
    3 * count(*) filter (where gf > ga) + count(*) filter (where gf = ga) as points,
    count(*) filter (where ga = 0)                   as clean_sheets
  from team_matches
  group by 1, 2
),
player_agg as (
  select
    m.season_label,
    d.source_team_id                                              as team_id,
    sum(coalesce((d.raw_stats->>'totalShots')::int, 0))           as shots,
    sum(coalesce((d.raw_stats->>'onTargetScoringAttempt')::int, 0)) as shots_on_target,
    sum(coalesce((d.raw_stats->>'totalPass')::int, 0))            as total_passes,
    sum(coalesce((d.raw_stats->>'accuratePass')::int, 0))         as accurate_passes,
    sum(coalesce((d.raw_stats->>'keyPass')::int, 0))              as key_passes,
    sum(coalesce((d.raw_stats->>'bigChanceCreated')::int, 0))     as big_chances_created,
    sum(coalesce((d.raw_stats->>'totalTackle')::int, 0))          as tackles,
    sum(coalesce((d.raw_stats->>'interceptionWon')::int, 0))      as interceptions,
    sum(coalesce((d.raw_stats->>'fouls')::int, 0))                as fouls,
    round(avg((d.raw_stats->>'rating')::numeric)
          filter (where coalesce((d.raw_stats->>'minutesPlayed')::int, 0) > 0), 2) as rating_avg,
    round(sum((d.raw_stats->>'kilometersCovered')::numeric)
          / nullif(count(distinct d.source_match_id)
                   filter (where d.raw_stats ? 'kilometersCovered'), 0), 1) as km_per_match
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  where d.source = 'sofascore'
    and m.competition = 'Trendyol 1. Lig'
  group by 1, 2
),
team_xg as (
  -- Takim xG = oyuncu xG toplami. 1.Lig'de xG SofaScore'da YOK, FlashScore'dan gelir;
  -- oyuncu mat'i (tff1_player_season_stats_mat) FS xG'yi fmap ile dogru kopruluyor,
  -- ayrica sofascore team_id ve season_label tasiyor -> takima toplamak temiz.
  select season_label, team_id, round(sum(xg), 2) as xg
  from analytics.tff1_player_season_stats_mat
  where xg is not null
  group by 1, 2
)
select
  s.*,
  case when s.played > 0 then round(100.0 * s.wins / s.played, 1) end as win_pct,
  p.shots,
  p.shots_on_target,
  p.total_passes,
  p.accurate_passes,
  case when p.total_passes > 0
       then round(100.0 * p.accurate_passes / p.total_passes, 1) end as pass_accuracy,
  p.key_passes,
  p.big_chances_created,
  p.tackles,
  p.interceptions,
  p.fouls,
  p.rating_avg,
  p.km_per_match,
  tx.xg
from standings s
left join player_agg p
  on p.season_label = s.season_label and p.team_id = s.team_id
left join team_xg tx
  on tx.season_label = s.season_label and tx.team_id = s.team_id;

grant select on analytics.tff1_team_season_stats_v1 to anon, authenticated, service_role;

-- team mat'i yeni kolon icin yeniden olustur (select * bagli)
drop materialized view if exists analytics.tff1_team_season_stats_mat;
create materialized view analytics.tff1_team_season_stats_mat as
  select * from analytics.tff1_team_season_stats_v1;
create unique index uq_tff1_team_season_mat on analytics.tff1_team_season_stats_mat (season_label, team_id);
grant select on analytics.tff1_team_season_stats_mat to anon, authenticated, service_role;
