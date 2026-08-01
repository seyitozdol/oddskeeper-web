-- EuroLeague/EuroCup Match-Player Tools veri katmanı (BSL bb_* tools view'larinin portu).
-- Kaynak: euroleague.player_match_stats + team_match_stats (per-game, denormalize:
-- home_away/opponent/game_date zaten var → ayri enriched GEREKMEZ).
-- team_code AS team_slug, person_code AS player_slug → frontend tools bilesenleri DEGISMEDEN calisir.
-- competition (E/U) kolonu cikita eklendi → server fn EL/EC ayirir.

-- ============================================================
-- 1) Takim ev/deplasman split (maç sayisi log5 modeli + moneyline std)
-- ============================================================
create or replace view analytics.el_team_home_away_split_v1 as
select
  season_label, competition, team_code as team_slug, max(team_name) as team_name,
  count(*)                                                       as games,
  round(avg(points), 2)                                         as ppg,
  round(avg(opp_points), 2)                                     as oppg,
  round(avg(points) filter (where home_away = 'Home'), 2)       as home_pf,
  round(avg(opp_points) filter (where home_away = 'Home'), 2)   as home_pa,
  round(avg(points) filter (where home_away = 'Away'), 2)       as away_pf,
  round(avg(opp_points) filter (where home_away = 'Away'), 2)   as away_pa,
  round(coalesce(stddev_samp(points) filter (where home_away = 'Home'), stddev_samp(points)), 2) as home_pf_std,
  round(coalesce(stddev_samp(points) filter (where home_away = 'Away'), stddev_samp(points)), 2) as away_pf_std,
  round(coalesce(stddev_samp(points), 0), 2)                    as pf_std
from euroleague.team_match_stats
group by season_label, competition, team_code;

-- ============================================================
-- 2) Takim metrik formu: sezon AVG + son-10 + std
-- ============================================================
create or replace view analytics.el_team_metric_form_v1 as
with unp as (
  select
    t.season_label, t.competition, t.team_code as team_slug, t.team_name, t.game_date,
    m.market_key, m.market_label, m.val
  from euroleague.team_match_stats t
  cross join lateral (values
    ('points',    'Sayı',            coalesce(t.points,0)::numeric),
    ('rebounds',  'Toplam Ribaund',  coalesce(t.treb,0)::numeric),
    ('oreb',      'Hücum Ribaund',   coalesce(t.oreb,0)::numeric),
    ('dreb',      'Savunma Ribaund', coalesce(t.dreb,0)::numeric),
    ('assists',   'Asist',           coalesce(t.assists,0)::numeric),
    ('threes',    '3 Sayı',          coalesce(t.fg3m,0)::numeric),
    ('twos',      '2 Sayı',          coalesce(t.fg2m,0)::numeric),
    ('fgm',       'İsabetli Atış',   (coalesce(t.fg2m,0)+coalesce(t.fg3m,0))::numeric),
    ('ftm',       'Serbest Atış',    coalesce(t.ftm,0)::numeric),
    ('steals',    'Top Çalma',       coalesce(t.steals,0)::numeric),
    ('blocks',    'Blok',            coalesce(t.blocks,0)::numeric),
    ('turnovers', 'Top Kaybı',       coalesce(t.turnovers,0)::numeric)
  ) as m(market_key, market_label, val)
),
ranked as (
  select *, row_number() over (partition by team_slug, market_key order by game_date desc) as rn from unp
)
select
  season_label, competition, team_slug, team_name, market_key, market_label,
  count(*)                                    as games,
  round(avg(val), 2)                          as season_avg,
  round(avg(val) filter (where rn <= 10), 2)  as last10_avg,
  round(coalesce(stddev_samp(val), 0), 2)     as std
from ranked
group by season_label, competition, team_slug, team_name, market_key, market_label;

-- ============================================================
-- 3) Oyuncu metrik pencereleri: son-5/son-10/sezon + total + games + avg_minutes
-- ============================================================
create or replace view analytics.el_player_metric_window_v1 as
with pu as (
  select
    p.season_label, p.competition, p.person_code as player_slug, p.player_name,
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

-- ============================================================
-- 4) Takim maç logu (metrik degerli) — TeamRecent + last10-weighted + min/max
-- ============================================================
create or replace view analytics.el_team_match_log_v1 as
select
  season_label, competition,
  team_code as team_slug, team_name,
  (team_code || ' - ' || opponent_code || ' g' || game_code) as match_key,
  game_date::date                                        as match_date,
  round                                                  as week,
  home_away,
  opponent_code as opponent_slug, opponent_name,
  points, opp_points,
  (points - opp_points)                                  as margin,
  case when points > opp_points then 'W' when points < opp_points then 'L' else 'T' end as result,
  (coalesce(fg2m,0)+coalesce(fg3m,0))                    as fgm,
  (coalesce(fg2a,0)+coalesce(fg3a,0))                    as fga,
  fg3m, fg3a, treb, oreb, dreb, assists, turnovers, steals, blocks,
  ((coalesce(fg2a,0)+coalesce(fg3a,0)) - coalesce(oreb,0) + coalesce(turnovers,0) + 0.44*coalesce(fta,0)) as possessions
from euroleague.team_match_stats;

-- ============================================================
-- 5) Oyuncu listesi (Player List sekmesi + mükerrer tespit)
-- ============================================================
create or replace view analytics.el_player_list_v1 as
select
  season_label, competition, person_code as player_slug,
  max(player_name)                                       as player_name,
  (array_agg(team_code order by game_date desc))[1]      as team_slug,
  (array_agg(team_name order by game_date desc))[1]      as team_name,
  count(*)                                               as games
from euroleague.player_match_stats
group by season_label, competition, person_code;

grant select on
  analytics.el_team_home_away_split_v1,
  analytics.el_team_metric_form_v1,
  analytics.el_player_metric_window_v1,
  analytics.el_team_match_log_v1,
  analytics.el_player_list_v1
to anon, authenticated;
