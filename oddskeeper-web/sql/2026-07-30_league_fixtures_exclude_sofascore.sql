-- 2026-07-30: league_fixtures_v1 sofascore fixture'larini dislar.
--
-- SORUN: football.fixtures artik 26/27 Super Lig fikstursunu IKI kaynaktan
-- tutuyor: source='apifootball' (306) + source='sofascore' (306). Bu view'in
-- team_source_id/slug uzayi apifootball/Opta id'lerine dayali (ref.team_mapping,
-- team_current_squad_profile_v1 apifootball id tasir). sofascore satirlari
-- sofascore team id'leri tasidigindan:
--   * ayni mac view'de iki kez cikiyor ("Kasimpasa" apifootball + "Kasimpasa"
--     sofascore, farkli tarih/id),
--   * sofascore fixture'i secilince player-market/deep-prediction oyuncu
--     listesi BOS geliyor (team_source_id kadro apifootball id'siyle uyusmuyor).
--
-- COZUM: open_fixtures CTE'sine source<>'sofascore' filtresi. apifootball +
-- manual + varsa opta satirlari kalir (hepsi apifootball/Opta id uzayinda);
-- sofascore fikstur satirlari gelecekteki SofaScore-native tsl_ss katmani icin
-- ayri tutulur. Kolon seti degismedi; CREATE OR REPLACE grant'lari korur.
--
-- UYGULANDI: 2026-07-30

CREATE OR REPLACE VIEW analytics.league_fixtures_v1 AS
WITH open_fixtures AS (
  SELECT f_1.fixture_id,
    f_1.competition,
    f_1.season_label,
    f_1.round_number,
    f_1.fixture_date,
    f_1.fixture_datetime,
    f_1.kickoff_time_known,
    f_1.kickoff_time_text,
    f_1.fixture_status,
    f_1.venue,
    f_1.home_team_slug,
    f_1.home_team_source_id,
    f_1.home_team_name,
    f_1.away_team_slug,
    f_1.away_team_source_id,
    f_1.away_team_name
  FROM football.fixtures f_1
  WHERE (COALESCE(lower(f_1.fixture_status), 'scheduled'::text) = ANY (ARRAY['scheduled'::text, 'postponed'::text, 'cancelled'::text]))
    AND f_1.source IS DISTINCT FROM 'sofascore'::text
    AND NOT (EXISTS ( SELECT 1
       FROM football.matches m
      WHERE m.home_team_source_id = f_1.home_team_source_id
        AND m.away_team_source_id = f_1.away_team_source_id
        AND m.match_datetime IS NOT NULL
        AND m.match_datetime::date = f_1.fixture_date))
)
SELECT fixture_id,
    competition,
    season_label,
    round_number,
    fixture_date,
    fixture_datetime,
    kickoff_time_known,
    kickoff_time_text,
    fixture_status,
    venue,
    home_team_slug,
    home_team_source_id,
    home_team_name,
    away_team_slug,
    away_team_source_id,
    away_team_name
   FROM open_fixtures f;
