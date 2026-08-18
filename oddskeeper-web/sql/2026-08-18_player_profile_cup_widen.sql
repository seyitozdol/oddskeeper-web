-- 2026-08-18: Tek-profil Faz 2b — kupa-only oyunculara football profili + foto.
--
-- Uc degisiklik (hepsi create or replace; mat'lar recreate GEREKTIRMEZ, refresh
-- yeni def'i calistirir. Tazeleme sirasi: player_profile_bridged_mat ONCE, sonra
-- player_match_log_sofascore_mat + player_current_info_bridged_mat — refresh_tsl_mats.py
-- sirasi zaten dogru):
--
-- 1) player_profile_sofascore_v1: kupa maclarini da kapsar AMA yalniz
--    match_method='synthetic' VE Super Lig'de (sofascore) hic mac satiri olmayan
--    oyuncular icin. Boylece:
--      - dual (opta'li) oyuncunun profil basligi DEGISMEZ (kupa satiri sofascore
--        legine hic girmez; bridge'in "en yeni satir kazanir" siralamasi tetiklenmez);
--      - SL'de oynayan synthetic oyuncu (yeni transfer) da SL basliginda kalir;
--      - yalniz kupa-only oyuncu (Mbappe ss826643 gibi) YENI profil satiri + slug alir.
--    Yabanci kupa takimlari ref.team_mapping'te YOK -> join LEFT'e cevrildi;
--    SL dali icin "tm.team_slug is not null" sarti eski INNER davranisini birebir korur.
--    team_name yabanci takimda mac verisindeki d.team_name'den gelir; team_slug NULL
--    kalir (football takim profili yalniz Turk takimlarinda var).
--    pos_ranked anahtari team_slug -> team_source_id (SL'de bire bir esdeger;
--    NULL slug'li yabanci takimlarda partition/join dogru calissin diye).
--
-- 2) player_match_log_sofascore_def_v1 (Faz 2a duzeltmesi): opta_seasons dislamasi
--    yalniz Super Lig satirlarina uygulanir. Opta YALNIZ Super Lig maci tasir
--    (DB'de dogrulandi: football.matches source='opta' -> tek competition), yani
--    kupa satiri opta ile asla mukerrer olamaz. Eski haliyle dual oyuncunun
--    opta'li sezondaki kupa maclari (or. Torreira CL 25/26 = 12 mac) logdan
--    dusuyordu; simdi tek profil logu tum rekabetleri gosterir.
--
-- 3) player_current_info_bridged_def_v1: latest_match CTE'si kupa maclarini da
--    tarar -> kupa-only oyuncu foto/forma/mevki alir (foto kanonik kaynagi
--    football.sofascore_player_info.photo_url). Mevcut TSL oyuncularinda etki
--    yalniz "en son mac" secimine kupa macinin girebilmesi (forma no/mevki);
--    foto ayni sofascore id'den geldigi icin DEGISMEZ.

create or replace view analytics.player_profile_sofascore_v1 as
with sl_players as (
    -- Super Lig'de (sofascore) en az bir mac satiri olan oyuncular: kupa
    -- genislemesi bunlara uygulanmaz (profil basligi Super Lig'e sabit kalir).
    select distinct d.source_player_id
    from football.match_player_stats_details d
    join football.matches m
      on m.source = d.source and m.source_match_id = d.source_match_id
    where d.source = 'sofascore'
      and m.competition like 'S%per Lig%'
), base as (
    select
        tm.team_slug,
        d.source_team_id                               as team_source_id,
        coalesce(tm.display_name, d.team_name)         as team_name,
        m.competition,
        m.season_label,
        m.match_datetime,
        d.source_match_id,
        pmap.opta_player_id                            as player_source_id,
        d.player_name,
        d.lineup_status,
        upper(nullif(d.position_code, ''))             as position_code,
        coalesce((d.raw_stats ->> 'minutesPlayed')::int, 0)  as minutes_played,
        coalesce((d.raw_stats ->> 'goals')::int, 0)          as goals,
        coalesce((d.raw_stats ->> 'goalAssist')::int, 0)     as assists
    from football.match_player_stats_details d
    join football.matches m
      on m.source = d.source and m.source_match_id = d.source_match_id
    join ref.sofascore_opta_player_map pmap
      on pmap.sofascore_player_id = d.source_player_id
    left join ref.team_mapping tm
      on tm.source_team_id = d.source_team_id and tm.is_active = true
    where d.source = 'sofascore'
      and m.season_label is not null
      and (
        (m.competition like 'S%per Lig%' and tm.team_slug is not null)
        or (
          m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')
          and pmap.match_method = 'synthetic'
          and not exists (select 1 from sl_players sp
                          where sp.source_player_id = d.source_player_id)
        )
      )
), pos_ranked as (
    -- oyuncunun en cok oynadigi mevki (kaleci > defans > orta saha > forvet onceligi
    -- esitlikte); opta zinciriyle ayni mantik.
    select team_source_id, season_label, player_source_id, position_code,
           row_number() over (
             partition by team_source_id, season_label, player_source_id
             order by case position_code when 'G' then 1 when 'D' then 2
                                         when 'M' then 3 when 'F' then 4 else 100 end,
                      count(*) desc) as rn
    from base
    where position_code is not null
    group by team_source_id, season_label, player_source_id, position_code
), agg as (
    select
        team_slug, team_source_id, team_name, competition, season_label,
        player_source_id,
        (array_agg(player_name order by match_datetime desc))[1] as player_name,
        count(distinct source_match_id) filter (where minutes_played > 0)::int as appearances,
        count(distinct source_match_id) filter (where lineup_status = 'starter')::int as starts,
        count(distinct source_match_id) filter (where lineup_status = 'substitute'
                                                 and minutes_played > 0)::int as sub_appearances,
        sum(minutes_played)::int as total_minutes,
        sum(goals)::int   as goals,
        sum(assists)::int as assists,
        min(match_datetime) as first_match_datetime,
        max(match_datetime) as last_match_datetime
    from base
    group by team_slug, team_source_id, team_name, competition, season_label, player_source_id
)
select
    a.team_slug,
    a.team_source_id,
    a.team_name,
    a.competition,
    a.season_label,
    a.player_source_id,
    a.player_name,
    -- slug bicimi Opta zinciriyle AYNI: '<normalize-ad>--<player_source_id>'
    lower(trim(both '-' from regexp_replace(regexp_replace(
        translate(a.player_name,
                  'ÇĞİÖŞÜçğıöşüÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÑñĆćČčŠšŽžŁłŃń',
                  'CGIOSUcgiosuAAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcCcSsZzLlNn'),
        '[^a-zA-Z0-9]+', '-', 'g'), '-{2,}', '-', 'g'))) || '--' || a.player_source_id
        as player_slug,
    case pr.position_code
        when 'G' then 'GK' when 'D' then 'DF' when 'M' then 'MF' when 'F' then 'FW'
        else 'OTHER' end as primary_position_code,
    case pr.position_code
        when 'G' then 'GOALKEEPER' when 'D' then 'DEFENDER'
        when 'M' then 'MIDFIELDER' when 'F' then 'FORWARD'
        else 'OTHER' end as position_group,
    a.appearances,
    a.starts,
    a.sub_appearances,
    round(a.starts::numeric / nullif(a.appearances, 0)::numeric * 100, 2) as starter_rate_pct,
    a.total_minutes,
    round(a.total_minutes::numeric / nullif(a.appearances, 0)::numeric, 2) as avg_minutes,
    a.goals,
    a.assists,
    a.first_match_datetime,
    a.last_match_datetime
from agg a
left join pos_ranked pr
  on pr.team_source_id = a.team_source_id and pr.season_label = a.season_label
 and pr.player_source_id = a.player_source_id and pr.rn = 1;

-- (2) Mac logu: dislama yalniz Super Lig satirlarina. Kupa satirlari her zaman
-- kalir (opta kupa maci tasimaz -> mukerrer olamaz).
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
          WHERE o.player_source_id = pmap.opta_player_id AND o.season_label = m.season_label)));

-- (3) Kimlik/bio koprusu: latest_match kupa maclarini da tarar.
create or replace view analytics.player_current_info_bridged_def_v1 as
with missing as (
    select p.player_source_id, p.player_slug, p.player_name,
           p.team_slug, p.team_name, p.season_label
    from analytics.player_profile_bridged_mat p
    where not exists (select 1 from analytics.player_current_info_v1 ci
                      where ci.opta_player_id = p.player_source_id)
), latest_match as (
    -- en son macindaki forma numarasi + mevki (SofaScore ham verisi; SL + kupalar)
    select distinct on (pmap.opta_player_id)
           pmap.opta_player_id                       as player_source_id,
           d.source_player_id                        as sofascore_player_id,
           nullif(d.raw_stats ->> 'jerseyNumber', '')::int as shirt_number,
           upper(nullif(d.position_code, ''))        as position_code
    from football.match_player_stats_details d
    join football.matches m
      on m.source = d.source and m.source_match_id = d.source_match_id
    join ref.sofascore_opta_player_map pmap
      on pmap.sofascore_player_id = d.source_player_id
    where d.source = 'sofascore'
      and (m.competition like 'S%per Lig%'
           or m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi'))
    order by pmap.opta_player_id, m.match_datetime desc
)
select * from analytics.player_current_info_v1
union all
select
    mi.player_slug,
    mi.player_source_id                              as opta_player_id,
    null::text                                       as apifootball_player_id,
    mi.team_slug                                     as current_team_slug,
    mi.team_name                                     as current_team_name,
    coalesce(spi.player_name, mi.player_name)        as player_name,
    case when spi.birth_date is not null
         then extract(year from age(spi.birth_date))::int end as age,
    lm.shirt_number,
    case lm.position_code
        when 'G' then 'Goalkeeper' when 'D' then 'Defender'
        when 'M' then 'Midfielder' when 'F' then 'Attacker' end as position,
    spi.photo_url,
    spi.updated_at                                   as fetched_at,
    coalesce(spi.player_name, mi.player_name)        as full_name,
    spi.country                                      as nationality,
    spi.height_cm,
    null::int                                        as weight_kg,
    spi.birth_date,
    null::text                                       as birth_place,
    null::text                                       as first_name,
    null::text                                       as last_name
from missing mi
left join latest_match lm on lm.player_source_id = mi.player_source_id
left join football.sofascore_player_info spi on spi.sofascore_player_id = lm.sofascore_player_id;

-- Grantlar degismedi (create or replace mevcut grantlari korur).
-- Uygulama sonrasi: refresh materialized view analytics.player_profile_bridged_mat;
--                   refresh materialized view analytics.player_match_log_sofascore_mat;
--                   refresh materialized view analytics.player_current_info_bridged_mat;
