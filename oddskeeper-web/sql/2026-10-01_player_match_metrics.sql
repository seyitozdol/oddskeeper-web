-- 2026-10-01: Oyuncu profili Detailed Stats icin mac bazli metrik kaynagi.
--
-- Sorun: Detailed Stats yalniz tsl_ss_player_detailed_metrics_global_mat'i
-- (Super Lig, tek sezon) okuyordu; oyuncunun milli takim / Avrupa kupasi
-- maclari ve gecmis sezonlari gorunmuyor, birbiriyle kiyaslanamiyordu.
--
-- Cozum: oyuncunun OYNADIGI her macin (Super Lig + Avrupa kupalari + milli
-- takim; SofaScore) metrikleri tek satirda. Frontend turnuva/sezon secimine
-- gore toplar ve yan yana kiyaslar; yeni kapsam = yeni sorgu gerekmez.
-- Metrik seti ve ham anahtar eslesmesi tsl_ss_metric_catalog_v1'den (Detailed
-- Stats ile ayni katalog); kartlar match_player_cards'tan (sahada gorulen).
-- Kimlik: ref.sofascore_opta_player_map (profilin player_source_id'si).
-- Kapsam, mac logunun (player_match_log_sofascore_def_v1) kapsamiyla ayni.

create or replace view analytics.player_match_metrics_v1 as
select pmap.opta_player_id as player_source_id,
  d.source_match_id,
  m.competition,
  m.season_label,
  m.match_datetime,
  (m.home_team_source_id = d.source_team_id) as is_home,
  d.lineup_status,
  d.team_name,
  case when m.home_team_source_id = d.source_team_id then m.away_team_name else m.home_team_name end as opponent_name,
  coalesce((d.raw_stats ->> 'minutesPlayed')::numeric, 0) as minutes,
  (
    select jsonb_object_agg(c.metric_key, (d.raw_stats ->> c.sofa_key)::numeric)
    from analytics.tsl_ss_metric_catalog_v1 c
    where c.source_note = 'sofascore'
      and c.agg_kind in ('sum', 'avg', 'max')
      and c.sofa_key is not null
      and d.raw_stats ? c.sofa_key
  ) as metrics,
  coalesce(pc.yellow, 0) as cards_yellow,
  coalesce(pc.red, 0) as cards_red
from football.mpsd_with_raw d
join football.matches m on m.source = d.source and m.source_match_id = d.source_match_id
join ref.sofascore_opta_player_map pmap on pmap.sofascore_player_id = d.source_player_id
left join lateral (
  select count(*) filter (where pc0.card_class = 'yellow') as yellow,
    count(*) filter (where pc0.card_class in ('red', 'yellowRed')) as red
  from football.match_player_cards pc0
  where pc0.source = 'sofascore'
    and pc0.source_match_id = d.source_match_id
    and pc0.source_player_id = d.source_player_id
    and pc0.on_pitch and not pc0.rescinded
) pc on true
where d.source = 'sofascore'
  and m.season_label is not null
  and coalesce((d.raw_stats ->> 'minutesPlayed')::numeric, 0) > 0
  and (
    m.competition like 'S%per Lig%'
    or m.competition in ('UEFA Şampiyonlar Ligi', 'UEFA Avrupa Ligi', 'UEFA Konferans Ligi')
    or exists (select 1 from ref.national_competitions nc where nc.competition = m.competition)
  );

grant select on analytics.player_match_metrics_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
