-- 2026-09-20: sezon kadrosu sitede GORUNSUN (takim profili kadro listesi + yeni oyuncu profil basligi).
-- Takim profili kadrosu sezon istatistiginden besleniyordu -> 26/27'de bos, sezon basladiginda da
-- yalniz maca cikanlar gorunurdu. Kadro view'larina profil alanlari eklendi (create or replace:
-- kolonlar SONA eklenir; bagimli matview + rol view'i etkilenmez).

create or replace view analytics.bb_team_roster_v1 as
select r.season_label, r.team_slug, coalesce(t.team_name, r.team_slug) as team_name,
       r.player_slug, p.player_name, p.position, p.sofascore_player_id,
       r.source, r.confirmed,
       p.country_code, p.height_cm, p.jersey_no
from basketball.team_rosters r
join basketball.players p on p.player_slug = r.player_slug
left join basketball.teams t on t.team_slug = r.team_slug;

grant select on analytics.bb_team_roster_v1 to authenticated, service_role;

create or replace view analytics.bb_player_role_roster_v1 as
with cfg as (
  select
    coalesce(max(value) filter (where key='role_starter_min'),  22)  as starter_min,
    coalesce(max(value) filter (where key='role_rotation_min'), 14)  as rotation_min,
    coalesce(max(value) filter (where key='role_bench_min'),     8)  as bench_min,
    coalesce(max(value) filter (where key='role_avail_share'), 0.5)  as avail_share
  from basketball.model_config
),
g as (
  select ro.season_label, ro.player_slug, e.team_slug as game_team, max(e.team_name) as game_team_name,
         count(*) as games, sum(coalesce(e.minutes,0)) as minutes,
         count(*) filter (where e.season_label = ro.season_label) as games_current
  from analytics.bb_team_roster_v1 ro
  join analytics.bb_player_game_enriched_v1 e
    on e.player_slug = ro.player_slug and e.season_label <= ro.season_label
  group by ro.season_label, ro.player_slug, e.team_slug
),
tot as (
  select season_label, player_slug, sum(games) as games, sum(games_current) as games_current,
         round(sum(minutes) / nullif(sum(games), 0), 1) as avg_minutes,
         (array_agg(game_team      order by games desc))[1] as prev_team_slug,
         (array_agg(game_team_name order by games desc))[1] as prev_team_name,
         max(games) as prev_team_player_games
  from g group by season_label, player_slug
),
tg as (
  select team_slug, max(n) as team_games
  from (select season_label, team_slug, count(*) as n from basketball.team_match_stats group by 1, 2) x
  group by team_slug
)
select ro.season_label, ro.team_slug, ro.player_slug, ro.player_name, ro.position,
       coalesce(t.games, 0)        as games,
       coalesce(t.games_current,0) as games_current,
       coalesce(t.avg_minutes, 0)  as avg_minutes,
       exists (select 1 from euroleague.team_bsl_link tl where tl.bsl_team_slug = ro.team_slug) as euro_team,
       case
         when coalesce(t.games, 0) = 0 then 'newcomer'
         when t.avg_minutes >= cfg.starter_min
              and t.games >= cfg.avail_share * coalesce(tg.team_games, 30) then 'starter'
         when t.avg_minutes >= cfg.rotation_min then 'rotation'
         when t.avg_minutes >= cfg.bench_min    then 'limited'
         else 'garbage'
       end as role,
       ro.sofascore_player_id,
       case when coalesce(t.games, 0) = 0 then 'new'
            when t.prev_team_slug = ro.team_slug then 'returning'
            else 'transfer' end as origin,
       case when t.prev_team_slug is distinct from ro.team_slug then t.prev_team_slug end as prev_team_slug,
       case when t.prev_team_slug is distinct from ro.team_slug then t.prev_team_name end as prev_team_name,
       ro.source, ro.confirmed,
       ro.country_code
from analytics.bb_team_roster_v1 ro
cross join cfg
left join tot t on t.season_label = ro.season_label and t.player_slug = ro.player_slug
left join tg on tg.team_slug = t.prev_team_slug;

grant select on analytics.bb_player_role_roster_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
