-- 2026-09-28: son-5 / son-10 form penceresi SEZON + LIG icinde siralanir.
--
-- SORUN: el_player_metric_window_v1, el_team_metric_form_v1, bb_player_metric_window_v1
-- ve bb_team_metric_form_v1 maclari row_number() ile yalniz (oyuncu|takim, market)
-- bolumunde siraliyor, sonra SEZON + LIG bazinda topluyordu. Yeni sezonun maclari
-- rn 1..k'yi kapinca eski sezon satirlarinin last5_avg/last10_avg'i NULL ya da eksik
-- (5 yerine 4 mac) kaliyordu. EL'de ayrica sezon ortasi E'den U'ya gecen oyuncunun
-- E satiri U maclari yuzunden bosaliyordu.
--
-- COZUM: PARTITION BY'a yalniz toplama taneciginin eksik kolonlari eklendi
-- (season_label, competition). Baska hicbir sey degismedi: cikti kolonlari ve sirasi,
-- ORDER BY, takim semantigi (oyuncu-takim satiri, oyuncunun o sezon-lig icindeki tum
-- maclarina gore siralanir), indeksler, grant'lar ayni. Ek kolonlar bolum anahtarinin
-- SONUNDA: kume ayni, sort daha ucuz (basa konunca el mat sorgusu 5.1 s, sonda 4.7 s).
-- bb_player_metric_window_roster_v1 zaten roster_season ile bolumlu, dokunulmadi.
--
-- Tanimlar canli katalogdan (pg_get_viewdef, 2026-09-28) alindi; tek fark rn satiri.
-- Grant'lar relacl'dan alindi (information_schema matview grant'larini GOSTERMEZ):
-- authenticated=r, service_role=arwd, sahip postgres -> postgres rolu ile uygula.
-- Iki matview'in bagimlisi yok (pg_depend/pg_rewrite), fonksiyon referansi yok.
--
-- DOGRULAMA (salt-okuma; yeni SELECT govdeleri DDL'siz duz sorgu olarak kosuldu,
-- mevcut nesnelerle karsilastirildi, 2026-09-28):
--   el_player : 10496 satir iki tarafta. Mevcut mat = eski tanimin canli sonucu (EXCEPT 0/0).
--               Yalniz-sezon varyanti mat ile birebir (EXCEPT 0/0). Lig de eklenince 77
--               satir farkli (EXCEPT 77/77): hepsi 2025-26'da E'den U'ya gecen 5 oyuncunun
--               E satiri, yalniz last5/last10 (last5 64 NULL->dolu, last10 31 NULL->dolu;
--               diger kolonlarda 0 fark).
--   el_team   : 480 satir, EXCEPT 0/0 (2025-26'da iki ligde birden oynayan takim yok).
--   bb_player : 7600 satir. 2026-27 (2656 satir) birebir (EXCEPT 0/0). Yalniz bolum degisikligiyle
--               2025-26'da 1082 satir farkli (26/27 maci eski son-5'te yer kapliyordu; points'te
--               73 satir 4->5, 2 satir 3->4 mac); hafta siralamasi da eklenince 2846 satir farkli,
--               hepsi yalniz last5/last10 (pencere disi kolon farki 0). Ornek sehmus-hazer 25/26
--               points last5 = 7.80 = hafta sirali son 5 macin bagimsiz ortalamasi.
--   bb_team   : 384 satir. 2026-27 birebir; 2025-26'da 178 satirda yalniz last10 farkli;
--               besiktas 25/26 points last10 artik sorgu bicimine bagli degil (78.20 iki bicimde).
--   Sure (server exec, eski -> yeni): el mat 4.45 -> 4.7 s, bb mat 0.69 -> 0.79 s,
--   el_team 70 -> 85 ms, bb_team 30 -> 35 ms.
--   (bb_* olcumleri yalniz bolum degisikligi icindir; hafta siralamasi ayrica olculdu, asagida
--   uygulama notunda.)
--
-- BSL SIRALAMASI (ikinci degisiklik, yalniz bb_*): ORDER BY match_date DESC yerine
--   week DESC NULLS LAST, match_date DESC NULLS LAST, id DESC. Sebep: excel_v38 2025-26
--   match_date'lerinde gun/ay takasi var (orn hafta 26 -> 2026-12-04), tarih sirali "son 5"
--   gercek son 5 degildi; ayrica ayni tarihli iki mac (besiktas 2026-06-04) rn 10/11
--   sinirinda esitti ve last10 sorgu bicimine gore degisiyordu. week bos degil (0/6440,
--   0/538), roster matview'i zaten hafta ile siralar; id sirayi TOPLAM yapar (deterministik).
--   EL'e dokunulmadi: game_date dogru ve ayni tarihli tekrar yok.
--
-- UYGULAMA SIRASI: bu dosya EL/EC otomatik akisindan (deploy/run_euro_match_scrape.sh,
--   DEPLOY.md 6c) ONCE uygulanir; aksi halde ilk tur 26/27 maclarini yukleyince 25/26
--   Tools'undaki son-5/10 hemen bozulur. Scrape cron'larinin kosmadigi bir dakikada uygula
--   (BSL */10, EL 5-59/10: orn :02-:03 ya da :07-:08).
-- KILIT: EL ve BSL AYRI islemlerde; her birinde DROP'un ACCESS EXCLUSIVE kilidi COMMIT'e kadar
--   surer (EL ~5 s, BSL ~1 s). lock_timeout 5 s: kosan bir REFRESH'in arkasinda uzun
--   beklenirse PostgREST okuyuculari (authenticator lock_timeout 8 s) kuyrukta takilmasin;
--   zaman asiminda islem geri alinir, bir dakika sonra tekrar calistir.
--
-- BILINEN, BU DOSYANIN KAPSAMI DISI (degistirilmedi):
--   * Ayni sezon-ligde takim degistiren oyuncunun eski takim satiri (BSL 14, EL 5 oyuncu),
--     yeni takimda >=5 maci varsa last5 NULL kalir (takim semantigi bilincli korundu).
--
-- Ayrica refresh gerekmez (create ... as veriyle doldurur). unique indeksler ayni ->
-- REFRESH ... CONCURRENTLY mumkun kalir; loader'larin refresh cagrilari degismez.
-- GERI ALMA: 2026-09-28_metric_window_season_partition_ROLLBACK.sql (onceki canli
-- tanimlar, ayni yapi).
-- ===================== 1. islem: EuroLeague/EuroCup =====================
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
            row_number() OVER (PARTITION BY pu.player_slug, pu.market_key, pu.season_label, pu.competition ORDER BY pu.game_date DESC) AS rn
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
commit;

-- ===================== 2. islem: BSL =====================
begin;
set local lock_timeout = '5s';

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
            e.week,
            e.id,
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
            row_number() OVER (PARTITION BY pu.player_slug, pu.market_key, pu.season_label, pu.competition ORDER BY pu.week DESC NULLS LAST, pu.match_date DESC NULLS LAST, pu.id DESC) AS rn
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

-- analytics.bb_team_metric_form_v1 (VIEW; kolonlar ayni -> or replace, grant'lar korunur)
create or replace view analytics.bb_team_metric_form_v1 as
WITH unp AS (
         SELECT t.season_label,
            t.competition,
            t.team_slug,
            t.team_name,
            t.match_date,
            t.week,
            t.id,
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
            row_number() OVER (PARTITION BY unp.team_slug, unp.market_key, unp.season_label, unp.competition ORDER BY unp.week DESC NULLS LAST, unp.match_date DESC NULLS LAST, unp.id DESC) AS rn
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

commit;

-- ===================== 3. islem: EL takim formu (duz view, kilit anlik) =====================
begin;
set local lock_timeout = '5s';

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
            row_number() OVER (PARTITION BY unp.team_slug, unp.market_key, unp.season_label, unp.competition ORDER BY unp.game_date DESC) AS rn
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

commit;

notify pgrst, 'reload schema';
