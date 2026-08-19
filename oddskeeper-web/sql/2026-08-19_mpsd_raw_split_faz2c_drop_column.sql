-- 2026-08-19: mpsd raw_stats yan tablo ayrimi FAZ 2 / ADIM C (kolon drop + kucultme)
--
-- ONKOSULLAR (hepsi saglanmadan CALISTIRMA):
--   1. ADIM A + B uygulandi: mpsd.raw_stats kolonuna bagimli nesne SIFIR olmali.
--      Kontrol:
--        select count(*) from pg_depend d join pg_rewrite rw on rw.oid=d.objid
--        join pg_attribute a on a.attrelid=d.refobjid and a.attnum=d.refobjsubid
--        where d.refobjid='football.match_player_stats_details'::regclass
--          and a.attname='raw_stats';           -- 0 bekleniyor
--   2. Writer gecisi CANLI ve DOGRULANDI: loader'lar ham jsonb'yi dogrudan
--      football.match_player_stats_raw'a yaziyor (commit: mpsd Faz 2 writer).
--      En az bir gercek mac isleme turu sonrasi kontrol:
--        select max(updated_at) from football.match_player_stats_raw;  -- taze olmali
--        select count(*) from football.match_player_stats_details
--          where raw_stats is not null and updated_at > now() - interval '6 hours';
--        -- 0 bekleniyor (yeni satirlar artik mpsd'ye ham yazmiyor)
--   3. Sessiz pencere: mac grace penceresi disi (TR 09:00-14:00 guvenli),
--      match_scrape turu arasi.
--
-- GERI ALINAMAZ: kolonu dusurmeden once yan tablonun butunlugunu son kez dogrula
-- (asagidaki ilk sorgu 0 donmeli), yedek icin gerekirse pg_dump al.

-- 0) SON BUTUNLUK KONTROLU (0 donmeli; donmuyorsa DURDUR)
select count(*) as uyusmayan
from football.match_player_stats_details d
left join football.match_player_stats_raw r
  on (r.source, r.source_match_id, r.source_player_id)
   = (d.source, d.source_match_id, d.source_player_id)
where d.raw_stats is not null
  and (r.raw_stats is null or r.raw_stats <> d.raw_stats);

-- 1) Senkron trigger artik gereksiz (writer dogrudan yan tabloya yaziyor)
drop trigger if exists trg_mpsd_sync_raw on football.match_player_stats_details;
drop function if exists football.mpsd_sync_raw();

-- 2) Kolonu dusur. Compat view (football.mpsd_with_raw) ACIK kolon listesiyle
--    tanimli oldugu icin bu drop view'i ETKILEMEZ; raw_stats'i zaten yan
--    tablodan (r.raw_stats) veriyor.
alter table football.match_player_stats_details drop column raw_stats;

-- 3) Fiziksel kucultme. TERCIH: pg_repack (kilitsiz).
--    create extension if not exists pg_repack;
--    -- kabuktan: pg_repack -h <host> -U postgres -d postgres -t football.match_player_stats_details
--    pg_repack yoksa YEDEK PLAN (ACCESS EXCLUSIVE, ~1 dk, sessiz pencerede):
vacuum full football.match_player_stats_details;
analyze football.match_player_stats_details;

-- 4) Dogrulama
select pg_size_pretty(pg_total_relation_size('football.match_player_stats_details')) as mpsd,
       pg_size_pretty(pg_total_relation_size('football.match_player_stats_raw'))     as yan,
       pg_size_pretty(pg_database_size(current_database()))                          as db;
-- Beklenen: mpsd ~340 MB -> ~110-120 MB; DB ~1047 MB -> ~800 MB civari.
