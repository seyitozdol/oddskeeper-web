-- EL/EC oyuncu ROL + pozisyon view'ı — bb_player_role_v1'in EuroLeague/EuroCup
-- karşılığı. Match-Player Tools (EL/EC) > Player Dist panelinde POS/ROL doldurur.
-- Anahtar uzayı el_* tools view'larıyla aynı: team_slug = team_code, player_slug = person_code.
-- Eşikler aynı model_config (role_*) satırlarından okunur; hafta yerine EL round kullanılır.
-- euro_team = false (EL/EC bağlamında alternatif-kadro rozeti anlamsız).

create or replace view analytics.el_player_role_v1 as
with cfg as (
  select
    coalesce(max(value) filter (where key='role_starter_min'),    22)  as starter_min,
    coalesce(max(value) filter (where key='role_rotation_min'),   14)  as rotation_min,
    coalesce(max(value) filter (where key='role_bench_min'),       8)  as bench_min,
    coalesce(max(value) filter (where key='role_avail_share'),   0.5)  as avail_share,
    coalesce(max(value) filter (where key='role_early_games_max'), 6)  as early_games_max,
    coalesce(max(value) filter (where key='role_gap_weeks'),       5)  as gap_weeks
  from basketball.model_config
),
tg as (
  select competition, season_label, team_code,
         count(*) as team_games, max(round) as team_last_round
  from euroleague.team_match_stats group by competition, season_label, team_code
),
pp as (
  select competition, season_label, season_code, team_code, person_code,
         max(player_name)                    as player_name,
         count(*)                            as games,
         round(avg(coalesce(minutes,0)), 1)  as avg_minutes,
         min(round)                          as first_round,
         max(round)                          as last_round
  from euroleague.player_match_stats
  group by competition, season_label, season_code, team_code, person_code
)
select
  pp.competition, pp.season_label,
  pp.team_code   as team_slug,
  pp.person_code as player_slug,
  pp.player_name,
  pl.position_name as position,
  pp.games, pp.avg_minutes,
  false as euro_team,
  case
    when pp.games <= cfg.early_games_max and pp.last_round <= tg.team_last_round - cfg.gap_weeks then 'departed'
    when pp.avg_minutes >= cfg.starter_min and pp.games >= cfg.avail_share * tg.team_games   then 'starter'
    when pp.avg_minutes >= cfg.rotation_min then 'rotation'
    when pp.avg_minutes >= cfg.bench_min    then 'limited'
    else 'garbage'
  end as role
from pp
join tg on tg.competition = pp.competition and tg.season_label = pp.season_label and tg.team_code = pp.team_code
cross join cfg
left join euroleague.players pl
  on pl.competition = pp.competition and pl.season_code = pp.season_code and pl.person_code = pp.person_code;

grant select on analytics.el_player_role_v1 to anon, authenticated;
