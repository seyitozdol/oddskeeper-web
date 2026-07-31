-- Basketbol oran motoru model view'ları (Faz 4).
-- Her market için per-game mean + std (+ örnek sayısı). Fiyatlar frontend'de
-- analitik normal CDF ile hesaplanır: Excel'in Normal(mean,std) Monte-Carlo'su
-- (tam sayıya yuvarlanıp x.5 line ile karşılaştırma) MATEMATİKSEL OLARAK
-- P(X>line)=1-Φ((line-mean)/std)'ye eşittir → örnekleme gürültüsü olmadan birebir.
-- LONG format: (varlık, market_key) başına 1 satır.

-- ============================================================
-- Oyuncu market modeli (prop'lar)
-- ============================================================
create or replace view analytics.bb_player_market_model_v1 as
with base as (
  select
    e.season_label, e.competition, e.player_slug, e.player_name, e.team_slug, e.team_name,
    coalesce(e.points,0)   as points,
    coalesce(e.treb,0)     as treb,
    coalesce(e.assists,0)  as assists,
    coalesce(e.fg3m,0)     as fg3m,
    coalesce(e.steals,0)   as steals,
    coalesce(e.blocks,0)   as blocks
  from analytics.bb_player_game_enriched_v1 e
),
unp as (
  select b.season_label, b.competition, b.player_slug, b.player_name, b.team_slug, b.team_name,
         m.market_key, m.market_label, m.val
  from base b
  cross join lateral (values
    ('points',   'Sayı',            b.points::numeric),
    ('rebounds', 'Ribaund',         b.treb::numeric),
    ('assists',  'Asist',           b.assists::numeric),
    ('threes',   '3 Sayı',          b.fg3m::numeric),
    ('steals',   'Top Çalma',       b.steals::numeric),
    ('blocks',   'Blok',            b.blocks::numeric),
    ('pra',      'Sayı+Rib+Asist',  (b.points + b.treb + b.assists)::numeric),
    ('pa',       'Sayı+Asist',      (b.points + b.assists)::numeric),
    ('pr',       'Sayı+Ribaund',    (b.points + b.treb)::numeric)
  ) as m(market_key, market_label, val)
)
select
  season_label, competition, player_slug, player_name, team_slug, team_name,
  market_key, market_label,
  count(*)                                   as games,
  round(avg(val), 3)                         as mean,
  round(coalesce(stddev_samp(val), 0), 3)    as std,
  round(max(val), 1)                         as max_val
from unp
group by season_label, competition, player_slug, player_name, team_slug, team_name, market_key, market_label;

-- ============================================================
-- Takım market modeli (prop'lar)
-- ============================================================
create or replace view analytics.bb_team_market_model_v1 as
with base as (
  select
    season_label, competition, team_slug, team_name,
    coalesce(points,0) points, coalesce(oreb,0) oreb, coalesce(dreb,0) dreb, coalesce(treb,0) treb,
    coalesce(assists,0) assists, coalesce(turnovers,0) turnovers, coalesce(steals,0) steals,
    coalesce(blocks,0) blocks, coalesce(fg3m,0) fg3m, coalesce(fg2m,0) fg2m, coalesce(ftm,0) ftm,
    (coalesce(fg2m,0)+coalesce(fg3m,0)) fgm
  from basketball.team_match_stats
),
unp as (
  select b.season_label, b.competition, b.team_slug, b.team_name, m.market_key, m.market_label, m.val
  from base b
  cross join lateral (values
    ('points',     'Sayı',          b.points::numeric),
    ('rebounds',   'Toplam Ribaund',b.treb::numeric),
    ('oreb',       'Hücum Ribaund', b.oreb::numeric),
    ('dreb',       'Savunma Ribaund',b.dreb::numeric),
    ('assists',    'Asist',         b.assists::numeric),
    ('threes',     '3 Sayı',        b.fg3m::numeric),
    ('twos',       '2 Sayı',        b.fg2m::numeric),
    ('fgm',        'İsabetli Atış', b.fgm::numeric),
    ('ftm',        'Serbest Atış',  b.ftm::numeric),
    ('steals',     'Top Çalma',     b.steals::numeric),
    ('blocks',     'Blok',          b.blocks::numeric),
    ('turnovers',  'Top Kaybı',     b.turnovers::numeric)
  ) as m(market_key, market_label, val)
)
select
  season_label, competition, team_slug, team_name, market_key, market_label,
  count(*)                                as games,
  round(avg(val), 3)                      as mean,
  round(coalesce(stddev_samp(val), 0), 3) as std,
  round(max(val), 1)                      as max_val
from unp
group by season_label, competition, team_slug, team_name, market_key, market_label;

grant select on
  analytics.bb_player_market_model_v1,
  analytics.bb_team_market_model_v1
to anon, authenticated;
