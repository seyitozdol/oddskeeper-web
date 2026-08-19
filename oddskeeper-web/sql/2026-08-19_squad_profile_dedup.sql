-- A2 (ARCHITECTURE_REVIEW) / PSM C. Güner mükerrer bug fix:
-- team_current_squad_profile_v1 ince passthrough (SELECT ... FROM ..._mat). Mat'ta
-- ayni oyuncu bazen 2 satirla var: apifootball native + synthetic-tm ayni opta'ya
-- cozulup (team_source_id, player_slug, player_key) AYNI donuyor, yalniz af_player_id
-- farkli (585709 vs tm1070983). Sonuc: PSM kadrosunda C. Güner 2 satir (ve ayni
-- React key -> tekrar sort'ta gorsel 7x). Su an yalniz Galatasaray etkili
-- (669 satirdan 1'i mukerrer; 668 benzersiz).
--
-- Cozum: view'i okuma-aninda (team_source_id, player_slug) bazinda dedup et; native
-- kimligi (numerik af_player_id) sentetige tercih et. Mat/refresh DEGISMEZ, yalniz
-- view. Frontend gorunumu: C. Güner tek satir. Geri alma: *_ROLLBACK.sql.
CREATE OR REPLACE VIEW analytics.team_current_squad_profile_v1 AS
SELECT team_slug, team_source_id, team_name, af_player_id, opta_player_id, player_key,
       player_name, player_slug, primary_position_code, position_group, shirt_number,
       appearances, starts, sub_appearances, starter_rate_pct, last_match_datetime,
       stats_season_label, display_name
FROM (
  SELECT *,
         row_number() OVER (
           PARTITION BY team_source_id, player_slug
           ORDER BY (af_player_id ~ '^[0-9]+$') DESC NULLS LAST,  -- native numerik id once
                    appearances DESC NULLS LAST,
                    af_player_id NULLS LAST
         ) AS _rn
  FROM analytics.team_current_squad_profile_mat
) _d
WHERE _rn = 1;
