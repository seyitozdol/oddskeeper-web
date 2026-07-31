-- Basketbol Katılım Araçları veri katmanı (Faz 5).
-- Fixture-driven oran akışı: (1) maç sayıları ev/dep düzeltmeli, (2) takım metrik
-- projeksiyonu AVG/Last10, (3) metriklerin oyunculara dağıtımı (tarihsel pay).

-- ============================================================
-- 1) Takım ev/deplasman split (adım 1: rakibe+saha-ayarlı beklenen sayı)
-- ============================================================
create or replace view analytics.bb_team_home_away_split_v1 as
select
  season_label, competition, team_slug, max(team_name) as team_name,
  count(*)                                                        as games,
  round(avg(points), 2)                                          as ppg,
  round(avg(opp_points), 2)                                      as oppg,
  round(avg(points) filter (where home_away = 'Home'), 2)        as home_pf,
  round(avg(opp_points) filter (where home_away = 'Home'), 2)    as home_pa,
  round(avg(points) filter (where home_away = 'Away'), 2)        as away_pf,
  round(avg(opp_points) filter (where home_away = 'Away'), 2)    as away_pa,
  round(coalesce(stddev_samp(points) filter (where home_away = 'Home'), stddev_samp(points)), 2) as home_pf_std,
  round(coalesce(stddev_samp(points) filter (where home_away = 'Away'), stddev_samp(points)), 2) as away_pf_std,
  round(coalesce(stddev_samp(points), 0), 2)                     as pf_std
from basketball.team_match_stats
group by season_label, competition, team_slug;

-- ============================================================
-- 2) Takım metrik formu: sezon AVG + son-10 + std (adım 2)
-- ============================================================
create or replace view analytics.bb_team_metric_form_v1 as
with unp as (
  select
    t.season_label, t.competition, t.team_slug, t.team_name, t.match_date,
    m.market_key, m.market_label, m.val
  from basketball.team_match_stats t
  cross join lateral (values
    ('points',    'Sayı',           coalesce(t.points,0)::numeric),
    ('rebounds',  'Toplam Ribaund', coalesce(t.treb,0)::numeric),
    ('oreb',      'Hücum Ribaund',  coalesce(t.oreb,0)::numeric),
    ('dreb',      'Savunma Ribaund',coalesce(t.dreb,0)::numeric),
    ('assists',   'Asist',          coalesce(t.assists,0)::numeric),
    ('threes',    '3 Sayı',         coalesce(t.fg3m,0)::numeric),
    ('twos',      '2 Sayı',         coalesce(t.fg2m,0)::numeric),
    ('fgm',       'İsabetli Atış',  (coalesce(t.fg2m,0)+coalesce(t.fg3m,0))::numeric),
    ('ftm',       'Serbest Atış',   coalesce(t.ftm,0)::numeric),
    ('steals',    'Top Çalma',      coalesce(t.steals,0)::numeric),
    ('blocks',    'Blok',           coalesce(t.blocks,0)::numeric),
    ('turnovers', 'Top Kaybı',      coalesce(t.turnovers,0)::numeric)
  ) as m(market_key, market_label, val)
),
ranked as (
  select *, row_number() over (partition by team_slug, market_key order by match_date desc) as rn
  from unp
)
select
  season_label, competition, team_slug, team_name, market_key, market_label,
  count(*)                                             as games,
  round(avg(val), 2)                                   as season_avg,
  round(avg(val) filter (where rn <= 10), 2)           as last10_avg,
  round(coalesce(stddev_samp(val), 0), 2)              as std
from ranked
group by season_label, competition, team_slug, team_name, market_key, market_label;

-- ============================================================
-- 3) Oyuncu metrik payı (adım 3: takım metriğini prime oyunculara dağıt)
--    share = oyuncu sezon toplamı / takım sezon toplamı (o metrikte)
-- ============================================================
create or replace view analytics.bb_player_metric_share_v1 as
with pu as (
  select
    e.season_label, e.competition, e.player_slug, e.player_name, e.team_slug, e.team_name,
    e.minutes,
    m.market_key, m.market_label, m.val
  from analytics.bb_player_game_enriched_v1 e
  cross join lateral (values
    ('points',    'Sayı',           coalesce(e.points,0)::numeric),
    ('rebounds',  'Ribaund',        coalesce(e.treb,0)::numeric),
    ('oreb',      'Hücum Ribaund',  coalesce(e.oreb,0)::numeric),
    ('dreb',      'Savunma Ribaund',coalesce(e.dreb,0)::numeric),
    ('assists',   'Asist',          coalesce(e.assists,0)::numeric),
    ('threes',    '3 Sayı',         coalesce(e.fg3m,0)::numeric),
    ('twos',      '2 Sayı',         coalesce(e.fg2m,0)::numeric),
    ('fgm',       'İsabetli Atış',  (coalesce(e.fg2m,0)+coalesce(e.fg3m,0))::numeric),
    ('ftm',       'Serbest Atış',   coalesce(e.ftm,0)::numeric),
    ('steals',    'Top Çalma',      coalesce(e.steals,0)::numeric),
    ('blocks',    'Blok',           coalesce(e.blocks,0)::numeric),
    ('turnovers', 'Top Kaybı',      coalesce(e.turnovers,0)::numeric)
  ) as m(market_key, market_label, val)
),
pa as (
  select
    season_label, competition, player_slug, max(player_name) as player_name,
    team_slug, max(team_name) as team_name, market_key, market_label,
    count(*)                                     as games,
    round(avg(coalesce(minutes,0)), 1)           as avg_minutes,
    round(sum(val), 1)                           as total,
    round(avg(val), 2)                           as per_game,
    round(coalesce(stddev_samp(val), 0), 2)      as std
  from pu
  group by season_label, competition, player_slug, team_slug, market_key, market_label
),
team_tot as (
  select team_slug, market_key, sum(total) as team_total
  from pa group by team_slug, market_key
)
select
  pa.season_label, pa.competition, pa.player_slug, pa.player_name, pa.team_slug, pa.team_name,
  pa.market_key, pa.market_label, pa.games, pa.avg_minutes, pa.total, pa.per_game, pa.std,
  tt.team_total,
  round(pa.total / nullif(tt.team_total, 0), 4)  as share
from pa
join team_tot tt on tt.team_slug = pa.team_slug and tt.market_key = pa.market_key;

grant select on
  analytics.bb_team_home_away_split_v1,
  analytics.bb_team_metric_form_v1,
  analytics.bb_player_metric_share_v1
to anon, authenticated;
