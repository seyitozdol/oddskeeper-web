-- 2026-07-30: Option A / Asama 2 — TSL SofaScore mac->sezon metrik toplama.
-- SofaScore oyuncu-mac verisini (source='sofascore', competition='Süper Lig')
-- opta id uzayina (ref.sofascore_opta_player_map) esleyip, tsl_ss_metric_catalog_v1'e
-- gore her metrigi sezon x oyuncu x TAKIM bazinda toplar. Cikti semasi Opta'nin
-- player_detailed_metrics_v2_2_mat'i ile AYNI (asama 3 global+ranking view'i bunu okur).
--
-- Dinamik cikarim: raw_stats ->> c.sofa_key (katalog join ile, 50 metrik tek tek yazilmadan).
-- Derived metrikler (appearances/starts/oran/per90/avg_minutes) ayrica hesaplanir.
-- Kart (flashscore) bu asamada YOK — asama 2b overlay olarak eklenecek.
--
-- total_value: agg_kind='sum' -> toplam; 'avg' -> dk>0 ortalama; 'max' -> maksimum.
-- per_match: sayim/sum metriginde toplam/mac; oran/avg/max'ta = total.
-- per90: per90_eligible sum metriginde toplam/dakika*90; digerlerinde NULL.
-- home/away: sum metriginde ev/deplasman toplami; digerlerinde NULL.
-- last5_value: son 5 macin (tarih) mac-basi ortalamasi.

create or replace view analytics.tsl_ss_player_detailed_metrics_v1 as
with pm_match as (
  select
    pmap.opta_player_id                                    as player_source_id,
    m.season_label,
    d.source_match_id,
    d.source_team_id,
    d.team_name,
    d.player_name,
    d.position_code,
    m.match_datetime,
    coalesce((d.raw_stats->>'minutesPlayed')::numeric, 0)  as minutes,
    (d.lineup_status = 'starter')                          as is_start,
    (m.home_team_source_id = d.source_team_id)             as is_home,
    d.raw_stats
  from football.match_player_stats_details d
  join football.matches m
    on m.source = d.source and m.source_match_id = d.source_match_id
  join ref.sofascore_opta_player_map pmap
    on pmap.sofascore_player_id = d.source_player_id
  where d.source = 'sofascore' and m.competition = 'Süper Lig'
),
-- oyuncu x takim x sezon ozet (derived metrikler + ortak alanlar icin)
psum as (
  select
    player_source_id, season_label, source_team_id,
    (array_agg(team_name    order by match_datetime desc))[1] as team_name,
    (array_agg(player_name  order by match_datetime desc))[1] as player_name,
    mode() within group (order by position_code)             as position_code,
    count(distinct source_match_id) filter (where minutes > 0) as apps,
    count(distinct source_match_id) filter (where is_start)    as starts,
    sum(minutes)                                              as tot_min,
    sum((raw_stats->>'onTargetScoringAttempt')::numeric)      as sot,
    sum((raw_stats->>'totalShots')::numeric)                  as sh,
    sum((raw_stats->>'accuratePass')::numeric)                as acc_pass,
    sum((raw_stats->>'totalPass')::numeric)                   as tot_pass,
    sum((raw_stats->>'expectedGoals')::numeric)               as xg
  from pm_match
  group by player_source_id, season_label, source_team_id
),
-- dinamik cikarim: her (oyuncu-mac x direct metrik) icin ham deger
direct as (
  select
    b.player_source_id, b.season_label, b.source_team_id,
    b.source_match_id, b.match_datetime, b.minutes, b.is_home,
    c.metric_key, c.agg_kind, c.per90_eligible,
    -- sum metriklerinde eksik anahtar=0 (SofaScore gol/asist gibi kolonlari 0 iken yazmaz);
    -- avg/max (rating/top_speed) icin eksik=NULL kalir (0 sayilmamali).
    case when c.agg_kind = 'sum'
         then coalesce((b.raw_stats ->> c.sofa_key)::numeric, 0)
         else (b.raw_stats ->> c.sofa_key)::numeric end as val
  from pm_match b
  join analytics.tsl_ss_metric_catalog_v1 c
    on c.source_note = 'sofascore' and c.agg_kind in ('sum','avg','max')
),
direct_agg as (
  select
    player_source_id, season_label, source_team_id, metric_key,
    max(agg_kind) as agg_kind,
    bool_or(per90_eligible) as per90_eligible,
    count(distinct source_match_id) filter (where minutes > 0)     as apps,
    count(distinct source_match_id) filter (where val is not null and minutes > 0) as sample_matches,
    sum(val)                                                       as sum_all,
    sum(val) filter (where is_home)                                as home_sum,
    sum(val) filter (where not is_home)                            as away_sum,
    sum(minutes) filter (where val is not null and minutes > 0)    as min_all,
    round(avg(val) filter (where minutes > 0), 2)                  as avg_val,
    max(val)                                                       as max_val
  from direct
  group by player_source_id, season_label, source_team_id, metric_key
),
last5 as (
  select player_source_id, season_label, source_team_id, metric_key,
         round(avg(val), 2) as last5_value
  from (
    select d.*, row_number() over (
      partition by player_source_id, season_label, source_team_id, metric_key
      order by match_datetime desc) as rn
    from direct d where minutes > 0
  ) t
  where rn <= 5
  group by 1, 2, 3, 4
),
-- direct metrik satirlari (mat semasinda)
direct_rows as (
  select
    a.season_label,
    'Süper Lig'::text                        as competition,
    a.player_source_id,
    a.metric_key,
    p.player_name,
    p.position_code,
    case left(coalesce(p.position_code,''),1)
      when 'G' then 'goalkeeper' when 'D' then 'defender'
      when 'M' then 'midfielder' when 'F' then 'forward' end as role_group,
    a.source_team_id,
    null::text as team_slug,   -- TODO: SofaScore takim id -> team_slug eslemesi (ayri asama)
    p.team_name,
    c.metric_label, c.category_key, c.category_label, c.display_priority,
    case a.agg_kind when 'sum' then a.sum_all when 'avg' then a.avg_val when 'max' then a.max_val end as total_value,
    a.sample_matches,
    case a.agg_kind
      when 'sum' then case when a.apps > 0 then round(a.sum_all / a.apps, 2) end
      else case a.agg_kind when 'avg' then a.avg_val else a.max_val end
    end as per_match_value,
    case when a.agg_kind = 'sum' and a.per90_eligible and a.min_all > 0
         then round(a.sum_all / a.min_all * 90, 3) end as per90_value,
    case when a.agg_kind = 'sum' then a.home_sum end   as home_value,
    case when a.agg_kind = 'sum' then a.away_sum end   as away_value,
    l.last5_value,
    c.is_higher_better, c.rank_direction, c.value_format,
    (a.sample_matches > 0)                             as coverage_flag
  from direct_agg a
  join psum p using (player_source_id, season_label, source_team_id)
  join analytics.tsl_ss_metric_catalog_v1 c using (metric_key)
  left join last5 l using (player_source_id, season_label, source_team_id, metric_key)
),
-- derived metrik satirlari
derived_rows as (
  select
    p.season_label,
    'Süper Lig'::text as competition,
    p.player_source_id,
    c.metric_key,
    p.player_name,
    p.position_code,
    case left(coalesce(p.position_code,''),1)
      when 'G' then 'goalkeeper' when 'D' then 'defender'
      when 'M' then 'midfielder' when 'F' then 'forward' end as role_group,
    p.source_team_id,
    null::text as team_slug,   -- TODO: SofaScore takim id -> team_slug eslemesi (ayri asama)
    p.team_name,
    c.metric_label, c.category_key, c.category_label, c.display_priority,
    case c.metric_key
      when 'appearances'       then p.apps::numeric
      when 'starts'            then p.starts::numeric
      when 'starter_rate_pct'  then case when p.apps > 0 then round(100.0 * p.starts / p.apps, 1) end
      when 'total_minutes'     then p.tot_min
      when 'avg_minutes'       then case when p.apps > 0 then round(p.tot_min / p.apps, 1) end
      when 'shot_accuracy_pct' then case when p.sh > 0 then round(100.0 * p.sot / p.sh, 1) end
      when 'pass_accuracy_pct' then case when p.tot_pass > 0 then round(100.0 * p.acc_pass / p.tot_pass, 1) end
      when 'xg_per90'          then case when p.tot_min > 0 then round(p.xg / p.tot_min * 90, 2) end
    end as total_value,
    p.apps as sample_matches,
    case c.metric_key
      when 'appearances' then p.apps::numeric
      when 'starts' then p.starts::numeric
      when 'starter_rate_pct'  then case when p.apps > 0 then round(100.0 * p.starts / p.apps, 1) end
      when 'total_minutes' then p.tot_min
      when 'avg_minutes'   then case when p.apps > 0 then round(p.tot_min / p.apps, 1) end
      when 'shot_accuracy_pct' then case when p.sh > 0 then round(100.0 * p.sot / p.sh, 1) end
      when 'pass_accuracy_pct' then case when p.tot_pass > 0 then round(100.0 * p.acc_pass / p.tot_pass, 1) end
      when 'xg_per90' then case when p.tot_min > 0 then round(p.xg / p.tot_min * 90, 2) end
    end as per_match_value,
    null::numeric as per90_value,
    null::numeric as home_value,
    null::numeric as away_value,
    null::numeric as last5_value,
    c.is_higher_better, c.rank_direction, c.value_format,
    true as coverage_flag
  from psum p
  join analytics.tsl_ss_metric_catalog_v1 c on c.agg_kind = 'derived'
),
-- ── Kart overlay: SADECE sahada gorulen kartlar (SofaScore incident'lerinden) ──
-- SofaScore oyuncu istatistiginde kart YOK. Kartlar football.match_player_cards'tan
-- gelir; on_pitch=true (bench/oyun-disi kartlar HARIC) ve rescinded=false. Kimlik
-- ref.sofascore_opta_player_map ile (diger tum sofascore metrikleriyle AYNI harita).
-- Taban = pm_match (sofascore appearance'lar) -> apps/dakika direct yolla birebir
-- ayni; kart sayimlari LEFT JOIN ile, kartsiz macta 0. Katalogda source_note hala
-- 'flashscore' -> bu metrikleri direct yolundan (source_note='sofascore') dislar.
fs_match as (
  select
    b.player_source_id,
    b.season_label,
    b.source_match_id,
    b.source_team_id,
    b.team_name,
    b.player_name,
    b.match_datetime,
    b.minutes,
    b.is_home,
    coalesce(pc.yellow, 0)                                       as yellow,
    coalesce(pc.red, 0)                                          as red
  from pm_match b
  left join (
    select m.season_label, smap.opta_player_id, pc0.source_match_id,
           count(*) filter (where pc0.card_class = 'yellow')             as yellow,
           count(*) filter (where pc0.card_class in ('red','yellowRed')) as red
    from football.match_player_cards pc0
    join football.matches m
      on m.source = pc0.source and m.source_match_id = pc0.source_match_id
    join ref.sofascore_opta_player_map smap
      on smap.sofascore_player_id = pc0.source_player_id and smap.opta_player_id is not null
    where pc0.source = 'sofascore' and pc0.on_pitch and not pc0.rescinded
      and m.competition = 'Süper Lig'
    group by m.season_label, smap.opta_player_id, pc0.source_match_id
  ) pc
    on pc.source_match_id = b.source_match_id
   and pc.opta_player_id = b.player_source_id
),
fs_card_long as (
  select player_source_id, season_label, source_team_id, team_name, player_name,
         source_match_id, match_datetime, minutes, is_home, x.metric_key, x.val
  from fs_match
  cross join lateral (values
    ('cards_yellow_total', yellow),
    ('cards_red_total',    red)
  ) as x(metric_key, val)
),
fs_card_agg as (
  select
    player_source_id, season_label, source_team_id, metric_key,
    (array_agg(team_name   order by match_datetime desc))[1] as team_name,
    (array_agg(player_name order by match_datetime desc))[1] as player_name,
    count(distinct source_match_id) filter (where minutes > 0) as apps,
    count(distinct source_match_id) filter (where minutes > 0) as sample_matches,
    sum(val)                                                   as sum_all,
    sum(val) filter (where is_home)                            as home_sum,
    sum(val) filter (where not is_home)                        as away_sum,
    sum(minutes) filter (where minutes > 0)                    as min_all
  from fs_card_long
  group by player_source_id, season_label, source_team_id, metric_key
),
fs_card_last5 as (
  select player_source_id, season_label, source_team_id, metric_key,
         round(avg(val), 2) as last5_value
  from (
    select fcl.*, row_number() over (
      partition by player_source_id, season_label, source_team_id, metric_key
      order by match_datetime desc) as rn
    from fs_card_long fcl where minutes > 0
  ) t where rn <= 5
  group by 1, 2, 3, 4
),
fs_card_rows as (
  select
    a.season_label,
    'Süper Lig'::text as competition,
    a.player_source_id,
    a.metric_key,
    a.player_name,
    null::text as position_code,
    null::text as role_group,
    a.source_team_id,
    null::text as team_slug,
    a.team_name,
    c.metric_label, c.category_key, c.category_label, c.display_priority,
    a.sum_all as total_value,
    a.sample_matches,
    case when a.apps > 0 then round(a.sum_all / a.apps, 2) end       as per_match_value,
    case when a.min_all > 0 then round(a.sum_all / a.min_all * 90, 3) end as per90_value,
    a.home_sum as home_value,
    a.away_sum as away_value,
    l.last5_value,
    c.is_higher_better, c.rank_direction, c.value_format,
    (a.sample_matches > 0) as coverage_flag
  from fs_card_agg a
  join analytics.tsl_ss_metric_catalog_v1 c using (metric_key)
  left join fs_card_last5 l using (player_source_id, season_label, source_team_id, metric_key)
)
select * from direct_rows
union all
select * from derived_rows
union all
select * from fs_card_rows;

grant select on analytics.tsl_ss_player_detailed_metrics_v1 to anon, authenticated, service_role;
