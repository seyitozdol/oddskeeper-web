-- 2026-07-30: Option A / Asama 4c-2 — TSL SofaScore LIG OYUNCU LEADERBOARD'u.
-- Lig sayfasi "Oyuncu Liderleri" paneli: metrik menusu (Meta katalog) + secilen
-- metrik icin siralanmis qualified oyuncular. Kaynak: metric_leaderboard_mat (qualif'li).
-- player_leaderboard_metric_catalog_v1 (menu) + player_leaderboard_rows_v1 (satirlar) esdegeri.
-- Frontend getLeaguePlayerLeaderboardMeta + getLeaguePlayerLeaderboard bunlari okur.
-- player_slug NULL (SofaScore->slug eslemesi ayri is; team_slug gibi ertelendi).

-- ── Metrik menusu (kategori grupli) ──
create or replace view analytics.tsl_ss_player_leaderboard_metric_catalog_v1 as
select
  s.competition,
  s.season_label,
  c.category_key,
  c.category_label,
  case c.category_key
    when 'playing_time' then 1 when 'attacking' then 2 when 'creation' then 3
    when 'passing' then 4 when 'defending' then 5 when 'duels' then 6
    when 'possession' then 7 when 'discipline' then 8 when 'goalkeeping' then 9
    when 'physical' then 10 when 'overall' then 11 else 99 end as category_sort,
  c.metric_key,
  c.metric_label,
  c.display_priority as metric_sort,
  c.value_format,
  c.is_higher_better,
  c.value_basis as default_basis,
  true as is_active
from (select distinct competition, season_label
        from analytics.tsl_ss_player_detailed_metrics_global_mat) s
cross join (select * from analytics.tsl_ss_metric_catalog_v1 where benchmark_allowed) c;

grant select on analytics.tsl_ss_player_leaderboard_metric_catalog_v1 to anon, authenticated, service_role;

-- ── Siralanmis satirlar (qualified oyuncular, metrik basina) ──
create or replace view analytics.tsl_ss_player_leaderboard_rows_v1 as
select
  row_number() over (
    partition by lb.season_label, lb.competition
    order by cat.category_sort, lb.metric_key, lb.league_rank
  )                                                as row_id,
  lb.competition, lb.season_label,
  lb.category_key, lb.category_label,
  lb.metric_key, lb.metric_label,
  lb.player_source_id, lb.player_name,
  null::text                                       as player_slug,
  lb.position_code, lb.role_group,
  lb.source_team_id, lb.team_slug, lb.team_name,
  lb.sample_matches, lb.total_value, lb.per_match_value, lb.per90_value,
  lb.league_avg, lb.league_rank, lb.vs_league_avg_pct,
  lb.value_format, lb.is_higher_better
from analytics.tsl_ss_player_metric_leaderboard_mat lb
join analytics.tsl_ss_metric_catalog_v1 c
  on c.metric_key = lb.metric_key and c.benchmark_allowed
join ( select distinct category_key,
         case category_key
           when 'playing_time' then 1 when 'attacking' then 2 when 'creation' then 3
           when 'passing' then 4 when 'defending' then 5 when 'duels' then 6
           when 'possession' then 7 when 'discipline' then 8 when 'goalkeeping' then 9
           when 'physical' then 10 when 'overall' then 11 else 99 end as category_sort
       from analytics.tsl_ss_metric_catalog_v1 ) cat
  on cat.category_key = lb.category_key
where lb.is_qualified and lb.league_rank is not null;

grant select on analytics.tsl_ss_player_leaderboard_rows_v1 to anon, authenticated, service_role;
