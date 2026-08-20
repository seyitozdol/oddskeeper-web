-- P-2 (mimari inceleme 2, 2026-08-20): bb_player_metric_window_v1 duz view'di;
-- PostgREST sayfalamasinda her sayfa tum pencereyi yeniden hesapliyordu
-- (olculen: ~640-1000 ms/sayfa x 5 sayfa, 96.5k ara satir, 12.7 MB disk sort).
-- el_player_metric_window_v1 kalibiyla ayni isimde MATVIEW'a cevrildi (frontend
-- degismez). Refresh kancasi: fetch_tbf_bsl.py yukleme sonunda (el kalibi gibi;
-- BSL verisi futbol match_scrape orkestratorunden AKMAZ, dogru kanca TBF loader).
-- UYGULANDI: 2026-08-20 canli (4976 satir birebir; sorgu 1012 ms -> 133 ms RTT dahil).

drop view if exists analytics.bb_player_metric_window_v1;

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

create unique index ux_bb_player_window
  on analytics.bb_player_metric_window_v1 (competition, season_label, player_slug, team_slug, market_key);

grant select on analytics.bb_player_metric_window_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
