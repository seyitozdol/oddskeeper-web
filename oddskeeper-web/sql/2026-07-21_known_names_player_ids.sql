-- 2026-07-21  Bilindik oyuncu isimleri + oyuncu ID kayit tablosu
-- 1) team_current_squad_profile_v1.display_name yeniden tanimlandi:
--    Eski hali bio'daki resmi ismi kuruyordu ("Talisca" -> "Anderson Souza
--    Conceicao", cok uzun ve taninmiyor). Yeni kural: apifootball kadro ismi
--    bilindik isimdir; kisaltmasizsa aynen kullanilir ("Talisca", "Ederson"),
--    "L. Torreira" gibi kisaltmali ise bas harf, bio first_name icindeki bas
--    harfe uyan kelimeyle acilir ("Lucas Torreira", "K. Akturkoglu" +
--    "Muhammed Kerem" -> "Kerem Akturkoglu"); uyan kelime yoksa ilk kelime.
-- 2) analytics.pm_player_ids: Oyuncu Listesi sekmesindeki elle girilen ozel
--    ID'ler (player_slug bazinda), Kaydet butonuyla upsert edilir.

CREATE OR REPLACE VIEW analytics.team_current_squad_profile_v1 AS
WITH prof AS (
  SELECT DISTINCT ON (player_source_id)
    player_source_id, season_label, player_name, player_slug,
    primary_position_code, appearances, starts, sub_appearances,
    starter_rate_pct, last_match_datetime
  FROM analytics.player_profile_v1
  ORDER BY player_source_id, season_label DESC, appearances DESC
),
info AS (
  SELECT DISTINCT ON (player_slug)
    player_slug, full_name, first_name, last_name
  FROM analytics.player_current_info_v1
  ORDER BY player_slug, fetched_at DESC NULLS LAST
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
  prof.season_label                                         AS stats_season_label,
  COALESCE(
    CASE
      WHEN s.player_name ~ '^[[:upper:]]\.\s'
           AND COALESCE(split_part(info.first_name, ' ', 1), '') <> ''
      THEN regexp_replace(
             s.player_name,
             '^[[:upper:]]\.\s*',
             COALESCE(
               (regexp_match(info.first_name,
                  '(?:^|\s)(' || left(s.player_name, 1) || '[^\s]+)'))[1],
               split_part(info.first_name, ' ', 1)) || ' ')
      ELSE s.player_name
    END,
    prof.player_name)                                       AS display_name
FROM analytics.team_current_squad_v1 s
LEFT JOIN ref.player_mapping pm
  ON pm.apifootball_player_id = s.player_source_id
LEFT JOIN prof
  ON prof.player_source_id = pm.opta_player_id
LEFT JOIN info
  ON info.player_slug = COALESCE(prof.player_slug, s.player_slug);

GRANT SELECT ON analytics.team_current_squad_profile_v1 TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS analytics.pm_player_ids (
  player_slug text PRIMARY KEY,
  external_id text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analytics.pm_player_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_player_ids_all ON analytics.pm_player_ids;
CREATE POLICY pm_player_ids_all ON analytics.pm_player_ids
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.pm_player_ids TO anon, authenticated;
GRANT ALL ON analytics.pm_player_ids TO service_role;
