-- Basketbol oyuncu pencereli metrik modeli (Excel PlayerCalc karşılığı).
-- Her oyuncu × metrik: son-5 / son-10 / tüm-sezon ortalaması + trim + oyun sayısı.
-- Excel: 5M/Ort, 10M/Ort, Avr, TrimAv sütunları. Exp.Av (rakip-ayarlı) frontend'de
-- opponentAllowed/teamAvg ile hesaplanır. STD Excel'de market-bazlı SABİT (frontend'de).

create or replace view analytics.bb_player_metric_window_v1 as
with pu as (
  select
    e.season_label, e.competition, e.player_slug, e.player_name, e.team_slug, e.team_name,
    e.match_date, e.minutes,
    m.market_key, m.market_label, m.val
  from analytics.bb_player_game_enriched_v1 e
  cross join lateral (values
    ('points',    'Sayı',            coalesce(e.points,0)::numeric),
    ('rebounds',  'Ribaund',         coalesce(e.treb,0)::numeric),
    ('oreb',      'Hücum Ribaund',   coalesce(e.oreb,0)::numeric),
    ('dreb',      'Savunma Ribaund', coalesce(e.dreb,0)::numeric),
    ('assists',   'Asist',           coalesce(e.assists,0)::numeric),
    ('threes',    '3 Sayı',          coalesce(e.fg3m,0)::numeric),
    ('twos',      '2 Sayı',          coalesce(e.fg2m,0)::numeric),
    ('ftm',       'Serbest Atış',    coalesce(e.ftm,0)::numeric),
    ('steals',    'Top Çalma',       coalesce(e.steals,0)::numeric),
    ('blocks',    'Blok',            coalesce(e.blocks,0)::numeric),
    ('turnovers', 'Top Kaybı',       coalesce(e.turnovers,0)::numeric),
    ('pra',       'Sayı+Rib+Asist',  (coalesce(e.points,0)+coalesce(e.treb,0)+coalesce(e.assists,0))::numeric),
    ('pa',        'Sayı+Asist',      (coalesce(e.points,0)+coalesce(e.assists,0))::numeric),
    ('pr',        'Sayı+Ribaund',    (coalesce(e.points,0)+coalesce(e.treb,0))::numeric)
  ) as m(market_key, market_label, val)
),
ranked as (
  select *, row_number() over (partition by player_slug, market_key order by match_date desc) as rn
  from pu
)
select
  season_label, competition, player_slug, max(player_name) as player_name,
  team_slug, max(team_name) as team_name, market_key, market_label,
  count(*)                                          as games,
  round(avg(coalesce(minutes,0)), 1)                as avg_minutes,
  round(avg(val), 2)                                as season_avg,
  round(avg(val) filter (where rn <= 5), 2)         as last5_avg,
  round(avg(val) filter (where rn <= 10), 2)        as last10_avg,
  round(coalesce(stddev_samp(val), 0), 2)           as calc_std,
  round(sum(val), 1)                                as total
from ranked
group by season_label, competition, player_slug, team_slug, market_key, market_label;

grant select on analytics.bb_player_metric_window_v1 to anon, authenticated;

-- Fixture view (frontend basketball.* şemasını PostgREST'e açmadan okusun)
create or replace view analytics.bb_fixtures_v1 as
select fixture_id, season_label, competition, week, match_text,
       home_team_slug, home_team_name, away_team_slug, away_team_name
from basketball.fixtures;
grant select on analytics.bb_fixtures_v1 to anon, authenticated;
