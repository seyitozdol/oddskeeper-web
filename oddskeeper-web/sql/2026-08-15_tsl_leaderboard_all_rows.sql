-- Takim "Player Stats" sekmesi icin nitelik filtresiz siralama satirlari (2026-08-15)
--
-- Sorun: analytics.tsl_ss_player_leaderboard_rows_v1 "WHERE is_qualified" ile suzuyor.
-- is_qualified kurali: oyuncunun sezon dakikasi >= sezonun EN YUKSEK dakikasinin %30'u
-- (tsl_ss_player_metric_leaderboard_current icindeki thr CTE'si). Lig genelinde
-- siralama icin makul ("5 dakika oynayan adam per-90 tablosunun tepesine cikmasin"),
-- ama takim sayfasinda kadroyu eksik gosteriyor: 2026/27'nin 1. haftasinda esik
-- 0.30 * 90 = 27 dakika oldugundan Corum'un 36 dk oynayan Diomande'si listede,
-- 22/14/14 dk oynayan Thiam, Sengul ve Ildiz listede DEGILDI (21 kisilik kadrodan 12).
--
-- Bu view ayni satirlari filtresiz verir; nitelik bilgisi kolon olarak tasinir, boylece
-- arayuz isterse "sirasiz" rozetleyebilir. Lig genelindeki Player Rankings sekmesi
-- ESKI (filtreli) view'i kullanmaya devam eder.

create or replace view analytics.tsl_ss_player_leaderboard_all_rows_v1 as
select
    row_number() over (partition by lb.season_label, lb.competition
                       order by cat.category_sort, lb.metric_key,
                                lb.league_rank nulls last, lb.player_name) as row_id,
    lb.competition,
    lb.season_label,
    lb.category_key,
    lb.category_label,
    lb.metric_key,
    lb.metric_label,
    lb.player_source_id,
    lb.player_name,
    null::text as player_slug,
    lb.position_code,
    lb.role_group,
    lb.source_team_id,
    lb.team_slug,
    lb.team_name,
    lb.sample_matches,
    lb.total_value,
    lb.per_match_value,
    lb.per90_value,
    lb.league_avg,
    lb.league_rank,
    lb.vs_league_avg_pct,
    lb.value_format,
    lb.is_higher_better,
    lb.is_qualified,
    lb.qualification_reason,
    -- Siralama icin her zaman dolu bir anahtar: nitelikliler lig sirasiyla, digerleri
    -- kendi metrik degerlerine gore ARKADAN gelir (null sona atilmasin diye).
    coalesce(lb.league_rank,
             1000000 + rank() over (
               partition by lb.season_label, lb.competition, lb.metric_key
               order by case when lb.rank_direction = 'asc' then lb.ranking_value end,
                        case when lb.rank_direction <> 'asc' then lb.ranking_value end
                          desc nulls last)) as sort_rank
from analytics.tsl_ss_player_metric_leaderboard_mat lb
join analytics.tsl_ss_metric_catalog_v1 c
  on c.metric_key = lb.metric_key and c.benchmark_allowed
join (select distinct category_key,
             case category_key
                 when 'playing_time' then 1 when 'attacking' then 2 when 'creation' then 3
                 when 'passing' then 4 when 'defending' then 5 when 'duels' then 6
                 when 'possession' then 7 when 'discipline' then 8 when 'goalkeeping' then 9
                 when 'physical' then 10 when 'overall' then 11 else 99 end as category_sort
      from analytics.tsl_ss_metric_catalog_v1) cat on cat.category_key = lb.category_key;

grant select on analytics.tsl_ss_player_leaderboard_all_rows_v1 to anon, authenticated, service_role;
