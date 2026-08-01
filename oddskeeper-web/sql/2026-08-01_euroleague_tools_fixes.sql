-- EL/EC tools düzeltmeleri: (1) oyuncu ismi CAPS+virgül ("LARKIN, SHANE") →
-- "Shane Larkin" (soyad,ad → ad soyad, initcap); (2) takım split'ine crest_url
-- (tools'ta yerel slug logosu yok → kırık; CDN crest gerekir).

-- isim normalize helper (inline): 'SOYAD, AD' → 'Ad Soyad'; virgülsüzse initcap.
-- initcap Postgres title-case; DE COLO, NANDO → Nando De Colo.

create or replace view analytics.el_player_list_v1 as
select
  season_label, competition, person_code as player_slug,
  max(case when player_name like '%, %'
        then initcap(split_part(player_name, ', ', 2)) || ' ' || initcap(split_part(player_name, ', ', 1))
        else initcap(player_name) end)                  as player_name,
  (array_agg(team_code order by game_date desc))[1]      as team_slug,
  (array_agg(team_name order by game_date desc))[1]      as team_name,
  count(*)                                               as games
from euroleague.player_match_stats
group by season_label, competition, person_code;

create or replace view analytics.el_player_metric_window_v1 as
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

-- split'e crest_url (euroleague.teams'ten; tools TeamCrest url ile render eder)
create or replace view analytics.el_team_home_away_split_v1 as
select
  s.season_label, s.competition, s.team_code as team_slug, max(s.team_name) as team_name,
  count(*)                                                       as games,
  round(avg(s.points), 2)                                       as ppg,
  round(avg(s.opp_points), 2)                                   as oppg,
  round(avg(s.points) filter (where s.home_away = 'Home'), 2)       as home_pf,
  round(avg(s.opp_points) filter (where s.home_away = 'Home'), 2)   as home_pa,
  round(avg(s.points) filter (where s.home_away = 'Away'), 2)       as away_pf,
  round(avg(s.opp_points) filter (where s.home_away = 'Away'), 2)   as away_pa,
  round(coalesce(stddev_samp(s.points) filter (where s.home_away = 'Home'), stddev_samp(s.points)), 2) as home_pf_std,
  round(coalesce(stddev_samp(s.points) filter (where s.home_away = 'Away'), stddev_samp(s.points)), 2) as away_pf_std,
  round(coalesce(stddev_samp(s.points), 0), 2)                  as pf_std,
  max(tm.crest_url)                                             as crest_url
from euroleague.team_match_stats s
left join euroleague.teams tm on tm.competition=s.competition and tm.season_code=s.season_code and tm.team_code=s.team_code
group by s.season_label, s.competition, s.team_code;

grant select on
  analytics.el_player_list_v1, analytics.el_player_metric_window_v1,
  analytics.el_team_home_away_split_v1
to anon, authenticated;
