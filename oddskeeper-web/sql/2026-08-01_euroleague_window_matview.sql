-- el_player_metric_window_v1 ağır (cross join lateral + window over ~140k satır);
-- PostgREST paginasyonunda (6× recompute) statement timeout. MATVIEW'a çevir
-- (2025-2026 statik → tek refresh yeter). Aynı isim → server fn değişmez.

drop view if exists analytics.el_player_metric_window_v1;

create materialized view analytics.el_player_metric_window_v1 as
with pu as (
  select
    p.season_label, p.competition, p.person_code as player_slug,
    (case when p.player_name like '%, %'
       then initcap(split_part(p.player_name, ', ', 2)) || ' ' || initcap(split_part(p.player_name, ', ', 1))
       else initcap(p.player_name) end)                  as player_name,
    p.team_code as team_slug, p.team_name, p.game_date, p.minutes,
    m.market_key, m.market_label, m.val
  from euroleague.player_match_stats p
  cross join lateral (values
    ('points',    'Sayı',            coalesce(p.points,0)::numeric),
    ('rebounds',  'Ribaund',         coalesce(p.treb,0)::numeric),
    ('oreb',      'Hücum Ribaund',   coalesce(p.oreb,0)::numeric),
    ('dreb',      'Savunma Ribaund', coalesce(p.dreb,0)::numeric),
    ('assists',   'Asist',           coalesce(p.assists,0)::numeric),
    ('threes',    '3 Sayı',          coalesce(p.fg3m,0)::numeric),
    ('twos',      '2 Sayı',          coalesce(p.fg2m,0)::numeric),
    ('ftm',       'Serbest Atış',    coalesce(p.ftm,0)::numeric),
    ('steals',    'Top Çalma',       coalesce(p.steals,0)::numeric),
    ('blocks',    'Blok',            coalesce(p.blocks,0)::numeric),
    ('turnovers', 'Top Kaybı',       coalesce(p.turnovers,0)::numeric),
    ('pra',       'Sayı+Rib+Asist',  (coalesce(p.points,0)+coalesce(p.treb,0)+coalesce(p.assists,0))::numeric),
    ('pa',        'Sayı+Asist',      (coalesce(p.points,0)+coalesce(p.assists,0))::numeric),
    ('pr',        'Sayı+Ribaund',    (coalesce(p.points,0)+coalesce(p.treb,0))::numeric),
    ('fgmadepct', 'İsabet %',        case when (coalesce(p.fg2a,0)+coalesce(p.fg3a,0)) > 0 then (coalesce(p.fg2m,0)+coalesce(p.fg3m,0))::numeric / (coalesce(p.fg2a,0)+coalesce(p.fg3a,0)) * 100 else null end),
    ('ftpct',     'Serbest %',       case when coalesce(p.fta,0) > 0 then coalesce(p.ftm,0)::numeric / p.fta * 100 else null end)
  ) as m(market_key, market_label, val)
),
ranked as (
  select *, row_number() over (partition by player_slug, market_key order by game_date desc) as rn from pu
)
select
  season_label, competition, player_slug, max(player_name) as player_name,
  team_slug, max(team_name) as team_name, market_key, market_label,
  count(*)                                    as games,
  round(avg(coalesce(minutes,0)), 1)          as avg_minutes,
  round(avg(val), 2)                          as season_avg,
  round(avg(val) filter (where rn <= 5), 2)   as last5_avg,
  round(avg(val) filter (where rn <= 10), 2)  as last10_avg,
  round(coalesce(stddev_samp(val), 0), 2)     as calc_std,
  round(sum(val), 1)                          as total
from ranked
group by season_label, competition, player_slug, team_slug, market_key, market_label;

create unique index if not exists ux_el_player_window
  on analytics.el_player_metric_window_v1 (competition, season_label, player_slug, team_slug, market_key);

grant select on analytics.el_player_metric_window_v1 to anon, authenticated;
