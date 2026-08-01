-- EuroLeague/EuroCup analytics okuma katmanı — euroleague.* üzerine türev view'lar.
-- BSL modeline GİRMEZ; yalnızca oyuncu detayında EL/EC sekmesi için okunur.
-- player_bsl_link köprüsüyle bir BSL oyuncusunun (Türk) EL/EC istatistikleri gösterilir.

-- ============================================================
-- 1) Oyuncu sezon ortalamaları (competition + season + person)
-- ============================================================
create or replace view analytics.el_player_season_v1 as
select
  p.competition, p.season_code, p.season_label, p.person_code,
  case p.competition when 'E' then 'EuroLeague' when 'U' then 'EuroCup' else p.competition end as competition_name,
  max(p.player_name)                                    as player_name,
  (array_agg(p.team_code order by p.game_date desc))[1] as team_code,
  (array_agg(p.team_name order by p.game_date desc))[1] as team_name,
  count(*)                                              as games,
  round(avg(p.minutes), 1)                              as mpg,
  round(avg(p.points), 1)                               as ppg,
  round(avg(p.treb), 1)                                 as rpg,
  round(avg(p.oreb), 1)                                 as orpg,
  round(avg(p.dreb), 1)                                 as drpg,
  round(avg(p.assists), 1)                              as apg,
  round(avg(p.steals), 1)                               as spg,
  round(avg(p.blocks), 1)                               as bpg,
  round(avg(p.turnovers), 1)                            as topg,
  round(avg(p.fg3m), 1)                                 as fg3m_pg,
  round(avg(p.valuation), 1)                            as val_pg,
  sum(p.points)                                         as points_total,
  round((sum(p.fg2m + p.fg3m)::numeric / nullif(sum(p.fg2a + p.fg3a), 0)) * 100, 1) as fg_pct,
  round((sum(p.fg2m)::numeric / nullif(sum(p.fg2a), 0)) * 100, 1)                   as fg2_pct,
  round((sum(p.fg3m)::numeric / nullif(sum(p.fg3a), 0)) * 100, 1)                   as fg3_pct,
  round((sum(p.ftm)::numeric  / nullif(sum(p.fta), 0)) * 100, 1)                    as ft_pct,
  round((sum(p.points)::numeric / nullif(2*(sum(p.fg2a+p.fg3a) + 0.44*sum(p.fta)), 0)) * 100, 1) as ts_pct
from euroleague.player_match_stats p
group by p.competition, p.season_code, p.season_label, p.person_code;

-- ============================================================
-- 2) Oyuncu maç logu (EL/EC sekmesinde maç geçmişi)
-- ============================================================
create or replace view analytics.el_player_game_log_v1 as
select
  p.competition,
  case p.competition when 'E' then 'EuroLeague' when 'U' then 'EuroCup' else p.competition end as competition_name,
  p.season_code, p.season_label, p.person_code, p.game_code, p.identifier, p.round, p.phase_code, p.game_date,
  p.team_code, p.team_name, p.home_away, p.opponent_code, p.opponent_name,
  p.minutes, p.points, p.fg2m, p.fg2a, p.fg3m, p.fg3a, p.ftm, p.fta,
  p.oreb, p.dreb, p.treb, p.assists, p.steals, p.turnovers, p.blocks, p.blocks_against,
  p.fouls_committed, p.fouls_drawn, p.valuation, p.plus_minus
from euroleague.player_match_stats p;

-- ============================================================
-- 3) BSL-bağlantılı: bir BSL oyuncusunun EL/EC sezonları + maç logu
--    (player_bsl_link köprüsüyle; frontend player_slug ile sorgular)
-- ============================================================
create or replace view analytics.bsl_player_euro_seasons_v1 as
select l.bsl_player_slug, s.*
from analytics.el_player_season_v1 s
join euroleague.player_bsl_link l on l.person_code = s.person_code;

create or replace view analytics.bsl_player_euro_log_v1 as
select l.bsl_player_slug, g.*
from analytics.el_player_game_log_v1 g
join euroleague.player_bsl_link l on l.person_code = g.person_code;

grant select on
  analytics.el_player_season_v1,
  analytics.el_player_game_log_v1,
  analytics.bsl_player_euro_seasons_v1,
  analytics.bsl_player_euro_log_v1
to anon, authenticated;
