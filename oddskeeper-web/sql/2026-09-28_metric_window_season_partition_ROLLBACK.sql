-- GERI ALMA: 2026-09-28_metric_window_season_partition.sql'in tersi.
-- 4 nesnenin degisiklik ONCESI canli tanimlari (pg_get_viewdef, 2026-09-28), indeksleri
-- ve grant'lari (relacl: authenticated=r, service_role=arwd, sahip postgres).
-- postgres rolu ile uygula. Not: bu tanimlarda row_number() yalniz (oyuncu|takim, market)
-- ile bolumlu; yeni sezon verisi geldikce eski sezonun last5/last10'u yine bosalir.
-- Scrape cron'larinin kosmadigi bir dakikada uygula (:02-:03 ya da :07-:08); lock_timeout kisa:
-- kosan bir REFRESH'in arkasinda PostgREST okuyuculari (lock_timeout 8 s) kuyrukta takilmasin.
begin;
set local lock_timeout = '5s';

-- analytics.el_player_metric_window_v1 (MATVIEW; 1 unique indeks, 2 grant; bagimlisi yok)
drop materialized view analytics.el_player_metric_window_v1;
create materialized view analytics.el_player_metric_window_v1 as
WITH pu AS (
         SELECT p.season_label,
            p.competition,
            p.person_code AS player_slug,
                CASE
                    WHEN p.player_name ~~ '%, %'::text THEN (initcap(split_part(p.player_name, ', '::text, 2)) || ' '::text) || initcap(split_part(p.player_name, ', '::text, 1))
                    ELSE initcap(p.player_name)
                END AS player_name,
            p.team_code AS team_slug,
            p.team_name,
            p.game_date,
            p.minutes,
            m.market_key,
            m.market_label,
            m.val
           FROM euroleague.player_match_stats p
             CROSS JOIN LATERAL ( VALUES ('points'::text,'Sayı'::text,COALESCE(p.points, 0)::numeric), ('rebounds'::text,'Ribaund'::text,COALESCE(p.treb, 0)::numeric), ('oreb'::text,'Hücum Ribaund'::text,COALESCE(p.oreb, 0)::numeric), ('dreb'::text,'Savunma Ribaund'::text,COALESCE(p.dreb, 0)::numeric), ('assists'::text,'Asist'::text,COALESCE(p.assists, 0)::numeric), ('threes'::text,'3 Sayı'::text,COALESCE(p.fg3m, 0)::numeric), ('twos'::text,'2 Sayı'::text,COALESCE(p.fg2m, 0)::numeric), ('ftm'::text,'Serbest Atış'::text,COALESCE(p.ftm, 0)::numeric), ('steals'::text,'Top Çalma'::text,COALESCE(p.steals, 0)::numeric), ('blocks'::text,'Blok'::text,COALESCE(p.blocks, 0)::numeric), ('turnovers'::text,'Top Kaybı'::text,COALESCE(p.turnovers, 0)::numeric), ('pra'::text,'Sayı+Rib+Asist'::text,(COALESCE(p.points, 0) + COALESCE(p.treb, 0) + COALESCE(p.assists, 0))::numeric), ('pa'::text,'Sayı+Asist'::text,(COALESCE(p.points, 0) + COALESCE(p.assists, 0))::numeric), ('pr'::text,'Sayı+Ribaund'::text,(COALESCE(p.points, 0) + COALESCE(p.treb, 0))::numeric), ('fgmadepct'::text,'İsabet %'::text,
                        CASE
                            WHEN (COALESCE(p.fg2a, 0) + COALESCE(p.fg3a, 0)) > 0 THEN (COALESCE(p.fg2m, 0) + COALESCE(p.fg3m, 0))::numeric / (COALESCE(p.fg2a, 0) + COALESCE(p.fg3a, 0))::numeric * 100::numeric
                            ELSE NULL::numeric
                        END), ('ftpct'::text,'Serbest %'::text,
                        CASE
                            WHEN COALESCE(p.fta, 0) > 0 THEN COALESCE(p.ftm, 0)::numeric / p.fta::numeric * 100::numeric
                            ELSE NULL::numeric
                        END)) m(market_key, market_label, val)
        ), ranked AS (
         SELECT pu.season_label,
            pu.competition,
            pu.player_slug,
            pu.player_name,
            pu.team_slug,
            pu.team_name,
            pu.game_date,
            pu.minutes,
            pu.market_key,
            pu.market_label,
            pu.val,
            row_number() OVER (PARTITION BY pu.player_slug, pu.market_key ORDER BY pu.game_date DESC) AS rn
           FROM pu
        )
 SELECT season_label,
    competition,
    player_slug,
    max(player_name) AS player_name,
    team_slug,
    max(team_name) AS team_name,
    market_key,
    market_label,
    count(*) AS games,
    round(avg(COALESCE(minutes, 0::numeric)), 1) AS avg_minutes,
    round(avg(val), 2) AS season_avg,
    round(avg(val) FILTER (WHERE rn <= 5), 2) AS last5_avg,
    round(avg(val) FILTER (WHERE rn <= 10), 2) AS last10_avg,
    round(COALESCE(stddev_samp(val), 0::numeric), 2) AS calc_std,
    round(sum(val), 1) AS total
   FROM ranked
  GROUP BY season_label, competition, player_slug, team_slug, market_key, market_label;
CREATE UNIQUE INDEX ux_el_player_window ON analytics.el_player_metric_window_v1 USING btree (competition, season_label, player_slug, team_slug, market_key);
grant select on analytics.el_player_metric_window_v1 to authenticated;
grant select, insert, update, delete on analytics.el_player_metric_window_v1 to service_role;

-- analytics.bb_player_metric_window_v1 (MATVIEW; 1 unique indeks, 2 grant; bagimlisi yok)
drop materialized view analytics.bb_player_metric_window_v1;
create materialized view analytics.bb_player_metric_window_v1 as
WITH pu AS (
         SELECT e.season_label,
            e.competition,
            e.player_slug,
            e.player_name,
            e.team_slug,
            e.team_name,
            e.match_date,
            e.minutes,
            m.market_key,
            m.market_label,
            m.val
           FROM analytics.bb_player_game_enriched_v1 e
             CROSS JOIN LATERAL ( VALUES ('points'::text,'Sayı'::text,COALESCE(e.points, 0)::numeric), ('rebounds'::text,'Ribaund'::text,COALESCE(e.treb, 0)::numeric), ('oreb'::text,'Hücum Ribaund'::text,COALESCE(e.oreb, 0)::numeric), ('dreb'::text,'Savunma Ribaund'::text,COALESCE(e.dreb, 0)::numeric), ('assists'::text,'Asist'::text,COALESCE(e.assists, 0)::numeric), ('threes'::text,'3 Sayı'::text,COALESCE(e.fg3m, 0)::numeric), ('twos'::text,'2 Sayı'::text,COALESCE(e.fg2m, 0)::numeric), ('ftm'::text,'Serbest Atış'::text,COALESCE(e.ftm, 0)::numeric), ('steals'::text,'Top Çalma'::text,COALESCE(e.steals, 0)::numeric), ('blocks'::text,'Blok'::text,COALESCE(e.blocks, 0)::numeric), ('turnovers'::text,'Top Kaybı'::text,COALESCE(e.turnovers, 0)::numeric), ('pra'::text,'Sayı+Rib+Asist'::text,(COALESCE(e.points, 0) + COALESCE(e.treb, 0) + COALESCE(e.assists, 0))::numeric), ('pa'::text,'Sayı+Asist'::text,(COALESCE(e.points, 0) + COALESCE(e.assists, 0))::numeric), ('pr'::text,'Sayı+Ribaund'::text,(COALESCE(e.points, 0) + COALESCE(e.treb, 0))::numeric), ('fgmadepct'::text,'İsabet %'::text,
                        CASE
                            WHEN (COALESCE(e.fg2a, 0) + COALESCE(e.fg3a, 0)) > 0 THEN (COALESCE(e.fg2m, 0) + COALESCE(e.fg3m, 0))::numeric / (COALESCE(e.fg2a, 0) + COALESCE(e.fg3a, 0))::numeric * 100::numeric
                            ELSE NULL::numeric
                        END), ('ftpct'::text,'Serbest %'::text,
                        CASE
                            WHEN COALESCE(e.fta, 0) > 0 THEN COALESCE(e.ftm, 0)::numeric / e.fta::numeric * 100::numeric
                            ELSE NULL::numeric
                        END)) m(market_key, market_label, val)
        ), ranked AS (
         SELECT pu.season_label,
            pu.competition,
            pu.player_slug,
            pu.player_name,
            pu.team_slug,
            pu.team_name,
            pu.match_date,
            pu.minutes,
            pu.market_key,
            pu.market_label,
            pu.val,
            row_number() OVER (PARTITION BY pu.player_slug, pu.market_key ORDER BY pu.match_date DESC) AS rn
           FROM pu
        )
 SELECT season_label,
    competition,
    player_slug,
    max(player_name) AS player_name,
    team_slug,
    max(team_name) AS team_name,
    market_key,
    market_label,
    count(*) AS games,
    round(avg(COALESCE(minutes, 0::numeric)), 1) AS avg_minutes,
    round(avg(val), 2) AS season_avg,
    round(avg(val) FILTER (WHERE rn <= 5), 2) AS last5_avg,
    round(avg(val) FILTER (WHERE rn <= 10), 2) AS last10_avg,
    round(COALESCE(stddev_samp(val), 0::numeric), 2) AS calc_std,
    round(sum(val), 1) AS total
   FROM ranked
  GROUP BY season_label, competition, player_slug, team_slug, market_key, market_label;
CREATE UNIQUE INDEX ux_bb_player_window ON analytics.bb_player_metric_window_v1 USING btree (competition, season_label, player_slug, team_slug, market_key);
grant select on analytics.bb_player_metric_window_v1 to authenticated;
grant select, insert, update, delete on analytics.bb_player_metric_window_v1 to service_role;

-- analytics.el_team_metric_form_v1 (VIEW; kolonlar ayni -> or replace, grant'lar korunur)
create or replace view analytics.el_team_metric_form_v1 as
WITH unp AS (
         SELECT t.season_label,
            t.competition,
            t.team_code AS team_slug,
            t.team_name,
            t.game_date,
            m.market_key,
            m.market_label,
            m.val
           FROM euroleague.team_match_stats t
             CROSS JOIN LATERAL ( VALUES ('points'::text,'Sayı'::text,COALESCE(t.points, 0)::numeric), ('rebounds'::text,'Toplam Ribaund'::text,COALESCE(t.treb, 0)::numeric), ('oreb'::text,'Hücum Ribaund'::text,COALESCE(t.oreb, 0)::numeric), ('dreb'::text,'Savunma Ribaund'::text,COALESCE(t.dreb, 0)::numeric), ('assists'::text,'Asist'::text,COALESCE(t.assists, 0)::numeric), ('threes'::text,'3 Sayı'::text,COALESCE(t.fg3m, 0)::numeric), ('twos'::text,'2 Sayı'::text,COALESCE(t.fg2m, 0)::numeric), ('fgm'::text,'İsabetli Atış'::text,(COALESCE(t.fg2m, 0) + COALESCE(t.fg3m, 0))::numeric), ('ftm'::text,'Serbest Atış'::text,COALESCE(t.ftm, 0)::numeric), ('steals'::text,'Top Çalma'::text,COALESCE(t.steals, 0)::numeric), ('blocks'::text,'Blok'::text,COALESCE(t.blocks, 0)::numeric), ('turnovers'::text,'Top Kaybı'::text,COALESCE(t.turnovers, 0)::numeric)) m(market_key, market_label, val)
        ), ranked AS (
         SELECT unp.season_label,
            unp.competition,
            unp.team_slug,
            unp.team_name,
            unp.game_date,
            unp.market_key,
            unp.market_label,
            unp.val,
            row_number() OVER (PARTITION BY unp.team_slug, unp.market_key ORDER BY unp.game_date DESC) AS rn
           FROM unp
        )
 SELECT season_label,
    competition,
    team_slug,
    team_name,
    market_key,
    market_label,
    count(*) AS games,
    round(avg(val), 2) AS season_avg,
    round(avg(val) FILTER (WHERE rn <= 10), 2) AS last10_avg,
    round(COALESCE(stddev_samp(val), 0::numeric), 2) AS std
   FROM ranked
  GROUP BY season_label, competition, team_slug, team_name, market_key, market_label;

-- analytics.bb_team_metric_form_v1 (VIEW; kolonlar ayni -> or replace, grant'lar korunur)
create or replace view analytics.bb_team_metric_form_v1 as
WITH unp AS (
         SELECT t.season_label,
            t.competition,
            t.team_slug,
            t.team_name,
            t.match_date,
            m.market_key,
            m.market_label,
            m.val
           FROM basketball.team_match_stats t
             CROSS JOIN LATERAL ( VALUES ('points'::text,'Sayı'::text,COALESCE(t.points, 0)::numeric), ('rebounds'::text,'Toplam Ribaund'::text,COALESCE(t.treb, 0)::numeric), ('oreb'::text,'Hücum Ribaund'::text,COALESCE(t.oreb, 0)::numeric), ('dreb'::text,'Savunma Ribaund'::text,COALESCE(t.dreb, 0)::numeric), ('assists'::text,'Asist'::text,COALESCE(t.assists, 0)::numeric), ('threes'::text,'3 Sayı'::text,COALESCE(t.fg3m, 0)::numeric), ('twos'::text,'2 Sayı'::text,COALESCE(t.fg2m, 0)::numeric), ('fgm'::text,'İsabetli Atış'::text,(COALESCE(t.fg2m, 0) + COALESCE(t.fg3m, 0))::numeric), ('ftm'::text,'Serbest Atış'::text,COALESCE(t.ftm, 0)::numeric), ('steals'::text,'Top Çalma'::text,COALESCE(t.steals, 0)::numeric), ('blocks'::text,'Blok'::text,COALESCE(t.blocks, 0)::numeric), ('turnovers'::text,'Top Kaybı'::text,COALESCE(t.turnovers, 0)::numeric)) m(market_key, market_label, val)
        ), ranked AS (
         SELECT unp.season_label,
            unp.competition,
            unp.team_slug,
            unp.team_name,
            unp.match_date,
            unp.market_key,
            unp.market_label,
            unp.val,
            row_number() OVER (PARTITION BY unp.team_slug, unp.market_key ORDER BY unp.match_date DESC) AS rn
           FROM unp
        )
 SELECT season_label,
    competition,
    team_slug,
    team_name,
    market_key,
    market_label,
    count(*) AS games,
    round(avg(val), 2) AS season_avg,
    round(avg(val) FILTER (WHERE rn <= 10), 2) AS last10_avg,
    round(COALESCE(stddev_samp(val), 0::numeric), 2) AS std
   FROM ranked
  GROUP BY season_label, competition, team_slug, team_name, market_key, market_label;

notify pgrst, 'reload schema';

commit;
