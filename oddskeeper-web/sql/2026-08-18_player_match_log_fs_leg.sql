-- 2026-08-18: Tek-profil — mac-logu koprusune FlashScore kupa legi.
--
-- SORUN: SofaScore bircok kupa macinda (ozellikle elemeler + 26/27) oyuncu
-- SATIRI verir ama ISTATISTIK vermez (raw_stats'ta minutesPlayed yok);
-- gercek istatistik FlashScore fallback'inde (source='flashscore', FS id
-- uzayi + ref.flashscore_sofa_* map'leri; bkz. sql/2026-08-18_eurocup_
-- flashscore_fallback.sql). Bridged mac logu yalniz source='sofascore'
-- okudugundan bu maclar profilde bos gorunuyordu (or. Ilhan Fakili
-- ss1858278: EL 26/27'de 4 mac, hepsi bos; FS'te 87/76/85/63 dakika).
--
-- COZUM: player_match_log_sofascore_def_v1 iki legli UNION ALL olur:
--  1) sofascore legi (mevcut) — kupa satirlarindan, istatistigi OLMAYAN ve
--     FS karsiligi OLAN (mac,oyuncu) ciftleri DUSULUR (yerine FS geleceginden
--     mukerrer olmaz; FS'i de olmayan roster-only satir yine gosterilir).
--  2) FS kupa legi — FS detay satiri, mac/oyuncu map'leriyle sofascore
--     kimligine cevrilir (mac id = sofascore id -> kupa mac linkleri calisir);
--     yalniz sofascore'un dakikali satiri OLMAYAN ciftler icin. FS anahtarlari
--     eurocup_fs_player_match_log_v1 ile ayni (MATCH_MINUTES_PLAYED, GOALS,
--     ASSISTS_GOAL, EXPECTED_GOALS...). Kart kolonlari sofascore legiyle
--     tutarli NULL kalir. Takim kimligi player_side + sofascore mac satirindan
--     (FS takim id uzayi kullanilmaz).
-- Kolon kumesi/sirasi DEGISMEDI. Mat: refresh player_match_log_sofascore_mat.

create or replace view analytics.player_match_log_sofascore_def_v1 as
 WITH slug_map AS (
         SELECT player_profile_bridged_mat.player_source_id,
            player_profile_bridged_mat.player_slug,
            player_profile_bridged_mat.player_name
           FROM analytics.player_profile_bridged_mat
          WHERE player_profile_bridged_mat.player_source_id IS NOT NULL AND player_profile_bridged_mat.player_slug IS NOT NULL
        ), opta_seasons AS (
         SELECT DISTINCT ps.source_player_id AS player_source_id,
            m_1.season_label
           FROM football.match_player_stats_opta_points ps
             JOIN football.matches m_1 ON m_1.source_match_id = ps.source_match_id
          WHERE m_1.season_label IS NOT NULL
        ), fs_pairs AS (
         -- FS kupa satirlarinin sofascore kimlikli (mac, oyuncu) ciftleri
         SELECT DISTINCT mm.sofascore_match_id, ppm.sofascore_player_id
           FROM football.match_player_stats_details fd
             JOIN ref.flashscore_sofa_match_map mm ON mm.flashscore_match_id = fd.source_match_id
             JOIN ref.flashscore_sofa_cup_player_map ppm ON ppm.flashscore_player_id = fd.source_player_id
          WHERE fd.source = 'flashscore'::text
        )
 SELECT sm.player_slug,
    pmap.opta_player_id AS player_source_id,
    COALESCE(sm.player_name, d.player_name) AS player_name,
    tm.team_slug,
    d.source_team_id AS team_source_id,
    d.team_name,
    m.source_match_id,
    m.competition,
    m.season_label,
    m.match_datetime,
    m.home_team_source_id = d.source_team_id AS is_home,
    m.away_team_source_id = d.source_team_id AS is_away,
        CASE
            WHEN m.home_team_source_id = d.source_team_id THEN m.away_team_name
            ELSE m.home_team_name
        END AS opponent_name,
        CASE
            WHEN m.home_team_source_id = d.source_team_id THEN away_map.team_slug
            ELSE home_map.team_slug
        END AS opponent_team_slug,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.home_team_source_id = d.source_team_id THEN concat(m.home_score, '-', m.away_score)
            ELSE concat(m.away_score, '-', m.home_score)
        END AS score_display,
        CASE
            WHEN m.home_score IS NULL OR m.away_score IS NULL THEN NULL::text
            WHEN m.winner_team_source_id = d.source_team_id THEN 'W'::text
            WHEN m.winner_team_source_id IS NULL THEN 'D'::text
            ELSE 'L'::text
        END AS result_code,
    d.lineup_status,
    d.position_code,
    NULL::numeric AS points,
    (d.raw_stats ->> 'minutesPlayed'::text)::integer AS minutes_played,
    COALESCE((d.raw_stats ->> 'goals'::text)::integer, 0) AS goals,
    COALESCE((d.raw_stats ->> 'goalAssist'::text)::integer, 0) AS assists,
    COALESCE((d.raw_stats ->> 'onTargetScoringAttempt'::text)::integer, 0) AS shots_on_target,
    COALESCE((d.raw_stats ->> 'shotOffTarget'::text)::integer, 0) AS shots_off_target,
    COALESCE((d.raw_stats ->> 'blockedScoringAttempt'::text)::integer, 0) AS shots_blocked,
    COALESCE((d.raw_stats ->> 'totalPass'::text)::integer, 0) AS passes,
    COALESCE((d.raw_stats ->> 'totalCross'::text)::integer, 0) AS crosses,
    COALESCE((d.raw_stats ->> 'totalTackle'::text)::integer, 0) AS tackles,
    COALESCE((d.raw_stats ->> 'interceptionWon'::text)::integer, 0) AS interceptions,
    COALESCE((d.raw_stats ->> 'wasFouled'::text)::integer, 0) AS fouls_won,
    COALESCE((d.raw_stats ->> 'fouls'::text)::integer, 0) AS fouls_conceded,
    COALESCE((d.raw_stats ->> 'totalOffside'::text)::integer, 0) AS offsides,
    NULL::integer AS cards_yellow,
    NULL::integer AS cards_red,
    NULL::integer AS penalties_won,
    COALESCE((d.raw_stats ->> 'saves'::text)::integer, 0) AS saves_total,
    (d.raw_stats ->> 'expectedGoals'::text)::numeric AS expected_goals,
    COALESCE((d.raw_stats ->> 'accuratePass'::text)::integer, 0) AS accurate_pass
   FROM football.match_player_stats_details d
     JOIN football.matches m ON m.source = d.source AND m.source_match_id = d.source_match_id
     JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = d.source_player_id
     JOIN slug_map sm ON sm.player_source_id = pmap.opta_player_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id = d.source_team_id AND tm.is_active = true
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = m.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = m.away_team_source_id AND away_map.is_active = true
  WHERE d.source = 'sofascore'::text
    AND (m.competition ~~ 'S%per Lig%'::text
         OR m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text]))
    AND m.season_label IS NOT NULL
    AND (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])
         OR NOT (EXISTS ( SELECT 1
           FROM opta_seasons o
          WHERE o.player_source_id = pmap.opta_player_id AND o.season_label = m.season_label)))
    AND NOT (m.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])
             AND NOT (d.raw_stats ? 'minutesPlayed'::text)
             AND EXISTS ( SELECT 1
                FROM fs_pairs fp
               WHERE fp.sofascore_match_id = m.source_match_id
                 AND fp.sofascore_player_id = d.source_player_id))
 UNION ALL
 SELECT sm.player_slug,
    pmap.opta_player_id AS player_source_id,
    COALESCE(sm.player_name, fd.player_name) AS player_name,
    tm.team_slug,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.home_team_source_id
            ELSE ms.away_team_source_id
        END AS team_source_id,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.home_team_name
            ELSE ms.away_team_name
        END AS team_name,
    ms.source_match_id,
    ms.competition,
    ms.season_label,
    ms.match_datetime,
    fd.player_side = 'home'::text AS is_home,
    fd.player_side <> 'home'::text AS is_away,
        CASE
            WHEN fd.player_side = 'home'::text THEN ms.away_team_name
            ELSE ms.home_team_name
        END AS opponent_name,
        CASE
            WHEN fd.player_side = 'home'::text THEN away_map.team_slug
            ELSE home_map.team_slug
        END AS opponent_team_slug,
        CASE
            WHEN ms.home_score IS NULL OR ms.away_score IS NULL THEN NULL::text
            WHEN fd.player_side = 'home'::text THEN concat(ms.home_score, '-', ms.away_score)
            ELSE concat(ms.away_score, '-', ms.home_score)
        END AS score_display,
        CASE
            WHEN ms.home_score IS NULL OR ms.away_score IS NULL THEN NULL::text
            WHEN ms.winner_team_source_id = CASE WHEN fd.player_side = 'home'::text
                 THEN ms.home_team_source_id ELSE ms.away_team_source_id END THEN 'W'::text
            WHEN ms.winner_team_source_id IS NULL THEN 'D'::text
            ELSE 'L'::text
        END AS result_code,
    fd.lineup_status,
    fd.position_code,
    NULL::numeric AS points,
    (NULLIF(fd.raw_stats ->> 'MATCH_MINUTES_PLAYED'::text, ''::text)::numeric)::integer AS minutes_played,
    COALESCE((NULLIF(fd.raw_stats ->> 'GOALS'::text, ''::text)::numeric)::integer, 0) AS goals,
    COALESCE((NULLIF(fd.raw_stats ->> 'ASSISTS_GOAL'::text, ''::text)::numeric)::integer, 0) AS assists,
    COALESCE((NULLIF(fd.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric)::integer, 0) AS shots_on_target,
    GREATEST(COALESCE((NULLIF(fd.raw_stats ->> 'SHOTS_TOTAL'::text, ''::text)::numeric)::integer, 0)
             - COALESCE((NULLIF(fd.raw_stats ->> 'SHOTS_ON_TARGET'::text, ''::text)::numeric)::integer, 0), 0) AS shots_off_target,
    0 AS shots_blocked,
    COALESCE((NULLIF(fd.raw_stats ->> 'PASSES_TOTAL'::text, ''::text)::numeric)::integer, 0) AS passes,
    0 AS crosses,
    COALESCE((NULLIF(fd.raw_stats ->> 'TACKLES_TOTAL'::text, ''::text)::numeric)::integer, 0) AS tackles,
    COALESCE((NULLIF(fd.raw_stats ->> 'INTERCEPTIONS'::text, ''::text)::numeric)::integer, 0) AS interceptions,
    COALESCE((NULLIF(fd.raw_stats ->> 'FOULS_SUFFERED'::text, ''::text)::numeric)::integer, 0) AS fouls_won,
    COALESCE((NULLIF(fd.raw_stats ->> 'FOULS_COMMITTED'::text, ''::text)::numeric)::integer, 0) AS fouls_conceded,
    COALESCE((NULLIF(fd.raw_stats ->> 'OFFSIDES'::text, ''::text)::numeric)::integer, 0) AS offsides,
    NULL::integer AS cards_yellow,
    NULL::integer AS cards_red,
    NULL::integer AS penalties_won,
    COALESCE((NULLIF(fd.raw_stats ->> 'SAVES_TOTAL'::text, ''::text)::numeric)::integer, 0) AS saves_total,
    NULLIF(fd.raw_stats ->> 'EXPECTED_GOALS'::text, ''::text)::numeric AS expected_goals,
    COALESCE((NULLIF(fd.raw_stats ->> 'PASSES_ACCURATE'::text, ''::text)::numeric)::integer, 0) AS accurate_pass
   FROM football.match_player_stats_details fd
     JOIN ref.flashscore_sofa_match_map mm ON mm.flashscore_match_id = fd.source_match_id
     JOIN ref.flashscore_sofa_cup_player_map ppm ON ppm.flashscore_player_id = fd.source_player_id
     JOIN football.matches ms ON ms.source = 'sofascore'::text AND ms.source_match_id = mm.sofascore_match_id
     JOIN ref.sofascore_opta_player_map pmap ON pmap.sofascore_player_id = ppm.sofascore_player_id
     JOIN slug_map sm ON sm.player_source_id = pmap.opta_player_id
     LEFT JOIN ref.team_mapping tm ON tm.source_team_id = (CASE WHEN fd.player_side = 'home'::text
          THEN ms.home_team_source_id ELSE ms.away_team_source_id END) AND tm.is_active = true
     LEFT JOIN ref.team_mapping home_map ON home_map.source_team_id = ms.home_team_source_id AND home_map.is_active = true
     LEFT JOIN ref.team_mapping away_map ON away_map.source_team_id = ms.away_team_source_id AND away_map.is_active = true
  WHERE fd.source = 'flashscore'::text
    AND ms.competition = ANY (ARRAY['UEFA Şampiyonlar Ligi'::text, 'UEFA Avrupa Ligi'::text, 'UEFA Konferans Ligi'::text])
    AND ms.season_label IS NOT NULL
    AND NOT (EXISTS ( SELECT 1
       FROM football.match_player_stats_details d2
      WHERE d2.source = 'sofascore'::text
        AND d2.source_match_id = mm.sofascore_match_id
        AND d2.source_player_id = ppm.sofascore_player_id
        AND d2.raw_stats ? 'minutesPlayed'::text));

-- Uygulama sonrasi: refresh materialized view analytics.player_match_log_sofascore_mat;
