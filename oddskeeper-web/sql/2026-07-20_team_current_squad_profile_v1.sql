-- 2026-07-20  analytics.team_current_squad_profile_v1
-- Amac: Player Market Prediction sayfasi fixture secildiginde guncel kadroyu gostersin.
-- Sorun: 2026-27 fiksturleri apifootball kaynakli, takim id'leri sayisal ('564' gibi);
--   oyuncu verisi (dim_player, player_profile_v1) ise Opta id uzayinda. Sayfa
--   dim_player.current_source_team_id ile arayinca 0 satir donuyor, tablolar bos kaliyordu.
-- Cozum: Guncel kadro football.team_squad_current'tan gelir (apifootball, fiksturle ayni
--   id uzayi; analytics.team_current_squad_v1 uzerinden). ref.player_mapping ile Opta
--   oyuncu id'sine baglanir, istatistik profili analytics.player_profile_v1'den eklenir
--   (oyuncu basina en guncel sezon, esitlikte en cok maca sahip satir).
-- Not: player_key = Opta id (eslesme varsa) yoksa 'af-<apifootball_id>'. Eslesmeyen
--   oyuncular (yeni transferler, yukselen takimlar) istatistiksiz gelir, appearances=0.

CREATE OR REPLACE VIEW analytics.team_current_squad_profile_v1 AS
WITH prof AS (
  SELECT DISTINCT ON (player_source_id)
    player_source_id, season_label, player_name, player_slug,
    primary_position_code, appearances, starts, sub_appearances,
    starter_rate_pct, last_match_datetime
  FROM analytics.player_profile_v1
  ORDER BY player_source_id, season_label DESC, appearances DESC
)
SELECT
  s.team_slug,
  s.team_source_id,
  s.team_name,
  s.player_source_id                                        AS af_player_id,
  pm.opta_player_id,
  COALESCE(pm.opta_player_id, 'af-' || s.player_source_id)  AS player_key,
  COALESCE(prof.player_name, s.player_name)                 AS player_name,
  COALESCE(prof.player_slug, s.player_slug)                 AS player_slug,
  COALESCE(
    prof.primary_position_code,
    CASE s.position_group
      WHEN 'GOALKEEPER' THEN 'GK'
      WHEN 'DEFENDER'   THEN 'DF'
      WHEN 'MIDFIELDER' THEN 'MF'
      WHEN 'FORWARD'    THEN 'FW'
      ELSE 'NA'
    END)                                                    AS primary_position_code,
  s.position_group,
  s.shirt_number,
  COALESCE(prof.appearances, 0)                             AS appearances,
  COALESCE(prof.starts, 0)                                  AS starts,
  COALESCE(prof.sub_appearances, 0)                         AS sub_appearances,
  prof.starter_rate_pct,
  prof.last_match_datetime,
  prof.season_label                                         AS stats_season_label
FROM analytics.team_current_squad_v1 s
LEFT JOIN ref.player_mapping pm
  ON pm.apifootball_player_id = s.player_source_id
LEFT JOIN prof
  ON prof.player_source_id = pm.opta_player_id;

GRANT SELECT ON analytics.team_current_squad_profile_v1 TO anon, authenticated, service_role;
