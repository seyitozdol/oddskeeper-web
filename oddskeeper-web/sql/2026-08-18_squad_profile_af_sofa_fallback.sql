-- 2026-08-18: Kadro profili kimlik zinciri kendi-kendini-onarir hale geldi.
--
-- SORUN: takim profili Squad sekmesi oyuncu linkini ref.player_mapping
-- (apifootball -> opta) uzerinden cozer; satir yoksa oyuncu apifootball
-- slug'ina (--af...) duser ve BOS bir profil acilir (or. Ilhan Fakili:
-- kadrodan i-fakili--af446824 acilirken verisi ilhan-fakili--ss1858278'te).
-- player_mapping'e 2026-08-16'da backfill yapilmisti ama YENI kimlikler
-- (kupa/lig verisiyle sonradan dogan ss profilleri) tekrar kopuyor.
--
-- COZUM: team_current_squad_profile_def_v1, player_mapping bulunamazsa
-- DOB-dogrulamali ref.apifootball_sofascore_player_map ->
-- ref.sofascore_opta_player_map zincirini CANLI dener (view seviyesinde;
-- her mat tazelemesinde otomatik). Kolon kumesi/sirasi DEGISMEDI.
-- (Kisaltmali-ad vakalari icin ayrica pipeline/src/football/
--  bridge_squad_player_mapping.py player_mapping'i doldurur.)

create or replace view analytics.team_current_squad_profile_def_v1 as
 WITH afs AS (
         -- af id basina tek sofascore karsiligi (dogrulanmis kopru)
         SELECT DISTINCT ON (m.apifootball_player_id) m.apifootball_player_id,
            m.sofascore_player_id
           FROM ref.apifootball_sofascore_player_map m
        ), prof AS (
         SELECT DISTINCT ON (player_profile_bridged_v1.player_source_id) player_profile_bridged_v1.player_source_id,
            player_profile_bridged_v1.season_label,
            player_profile_bridged_v1.player_name,
            player_profile_bridged_v1.player_slug,
            player_profile_bridged_v1.primary_position_code,
            player_profile_bridged_v1.appearances,
            player_profile_bridged_v1.starts,
            player_profile_bridged_v1.sub_appearances,
            player_profile_bridged_v1.starter_rate_pct,
            player_profile_bridged_v1.last_match_datetime
           FROM analytics.player_profile_bridged_v1
          ORDER BY player_profile_bridged_v1.player_source_id, player_profile_bridged_v1.season_label DESC, player_profile_bridged_v1.appearances DESC
        ), info AS (
         SELECT DISTINCT ON (player_current_info_v1.player_slug) player_current_info_v1.player_slug,
            player_current_info_v1.full_name,
            player_current_info_v1.first_name,
            player_current_info_v1.last_name
           FROM analytics.player_current_info_v1
          ORDER BY player_current_info_v1.player_slug, player_current_info_v1.fetched_at DESC NULLS LAST
        )
 SELECT s.team_slug,
    s.team_source_id,
    s.team_name,
    s.player_source_id AS af_player_id,
    COALESCE(pm.opta_player_id, som.opta_player_id) AS opta_player_id,
    COALESCE(pm.opta_player_id, som.opta_player_id, 'af-'::text || s.player_source_id) AS player_key,
    COALESCE(prof.player_name, s.player_name) AS player_name,
    COALESCE(prof.player_slug, s.player_slug) AS player_slug,
    COALESCE(prof.primary_position_code,
        CASE s.position_group
            WHEN 'GOALKEEPER'::text THEN 'GK'::text
            WHEN 'DEFENDER'::text THEN 'DF'::text
            WHEN 'MIDFIELDER'::text THEN 'MF'::text
            WHEN 'FORWARD'::text THEN 'FW'::text
            ELSE 'NA'::text
        END) AS primary_position_code,
    s.position_group,
    s.shirt_number,
    COALESCE(prof.appearances, 0) AS appearances,
    COALESCE(prof.starts, 0) AS starts,
    COALESCE(prof.sub_appearances, 0) AS sub_appearances,
    prof.starter_rate_pct,
    prof.last_match_datetime,
    prof.season_label AS stats_season_label,
    COALESCE(
        CASE
            WHEN s.player_name ~ '^[[:upper:]]\.\s'::text AND COALESCE(split_part(info.first_name, ' '::text, 1), ''::text) <> ''::text THEN regexp_replace(s.player_name, '^[[:upper:]]\.\s*'::text, COALESCE((regexp_match(info.first_name, ('(?:^|\s)('::text || "left"(s.player_name, 1)) || '[^\s]+)'::text))[1], split_part(info.first_name, ' '::text, 1)) || ' '::text)
            ELSE s.player_name
        END, prof.player_name) AS display_name
   FROM analytics.team_current_squad_v1 s
     LEFT JOIN ref.player_mapping pm ON pm.apifootball_player_id = s.player_source_id
     LEFT JOIN afs ON afs.apifootball_player_id = s.player_source_id
     LEFT JOIN ref.sofascore_opta_player_map som ON som.sofascore_player_id = afs.sofascore_player_id
     LEFT JOIN prof ON prof.player_source_id = COALESCE(pm.opta_player_id, som.opta_player_id)
     LEFT JOIN info ON info.player_slug = COALESCE(prof.player_slug, s.player_slug);

-- Uygulama sonrasi: refresh materialized view analytics.team_current_squad_profile_mat;
