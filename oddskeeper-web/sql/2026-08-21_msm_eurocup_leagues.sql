-- Kupa MSM veri katmani (sahip istegi 2026-08-21): CL/EL/Konf icin MSM.
-- League anahtarlari frontend config.source ile birebir: eurocl / euel / euecl.
-- KIMLIK: sofascore team_id (= team_slug kolonunda tasinir; ref.team_mapping'e
-- bagimli degil, kupa takimlarinin cogu mapping'te yok). Isimler histdata
-- team_name + tff1_team_logos_v1 (id-bazli, 294 UEFA takimi) fallback'i.
-- KAYNAK: yalniz sofascore + "gercek istatistik" kapisi (iki tarafta da
-- summary_shots>0 veya xG dolu; yoksa Card COALESCE(0) sahte-0 uretiyordu,
-- olculen: CL 26/27 Card 166 satir vs diger marketler 62).
-- VERI UFKU (sahip karari): yalnizca gecen sezon (2025-2026 histdata seed) +
-- bu sezon (2026-2027 canli log). Weighting s1 (gecen) + s4 (bu sezon);
-- s2/s3 = 0 ve kupa Config UI'inda gizli.
-- Eleme turlari DAHIL (26/27'de cogu takimin tek verisi elemeler; gercek-stat
-- kapisi istatistiksiz eleme maclarini zaten dusurur).
-- UYGULANDI: 2026-08-21 canli (dogrulama sayilari commit mesajinda / memory'de).

-- 1) Kupa takim-mac logu (msm.team_match_log_v1 deseninin sofascore-id'li esi)
create or replace view msm.eurocup_team_match_log_v1 as
with pair as (
  select
    case m.competition
      when 'UEFA Şampiyonlar Ligi' then 'eurocl'
      when 'UEFA Avrupa Ligi'      then 'euel'
      when 'UEFA Konferans Ligi'   then 'euecl'
    end as league,
    replace(coalesce(m.season_label, ''), '/', '-') as season,
    t.source,
    3 as source_rank,
    t.source_match_id,
    m.match_datetime,
    t.source_team_id as team_slug,
    t.team_name,
    t.team_side = 'home' as is_home,
    t.opponent_team_source_id as opp_slug,
    t.opponent_team_name,
    t.summary_shots            as f_shot,   o.summary_shots            as a_shot,
    t.summary_shots_on_target  as f_sot,    o.summary_shots_on_target  as a_sot,
    t.summary_fouls_conceded   as f_foul,   o.summary_fouls_conceded   as a_foul,
    t.summary_corners_won      as f_corner, o.summary_corners_won      as a_corner,
    t.summary_offsides         as f_offside,o.summary_offsides         as a_offside,
    t.summary_saves            as f_saves,  o.summary_saves            as a_saves,
    t.summary_tackles          as f_tackle, o.summary_tackles          as a_tackle,
    coalesce(t.summary_yellow_cards,0) + coalesce(t.summary_red_cards,0)*2 as f_card,
    coalesce(o.summary_yellow_cards,0) + coalesce(o.summary_red_cards,0)*2 as a_card,
    t.details_total_throws     as f_throw,  o.details_total_throws     as a_throw,
    t.details_goal_kicks       as f_gkick,  o.details_goal_kicks       as a_gkick,
    coalesce(t.summary_red_cards,0) + coalesce(o.summary_red_cards,0) as match_red_cards,
    m.referee
  from football.match_team_stats t
  join football.matches m
    on m.source = t.source and m.source_match_id = t.source_match_id
  join football.match_team_stats o
    on o.source = t.source and o.source_match_id = t.source_match_id
   and o.team_side <> t.team_side
  where t.source = 'sofascore'
    and m.competition in ('UEFA Şampiyonlar Ligi','UEFA Avrupa Ligi','UEFA Konferans Ligi')
    and (t.summary_shots > 0 or t.details_expected_goals is not null)
    and (o.summary_shots > 0 or o.details_expected_goals is not null)
), indexed as (
  select p.*,
    dense_rank() over (partition by p.league, p.season, p.team_slug
                       order by p.match_datetime, p.source_match_id) as team_match_index
  from pair p
), unp as (
  select i.league, i.season, i.source, i.source_rank, i.source_match_id,
    i.match_datetime, i.team_slug, i.team_name, i.is_home, i.opp_slug,
    i.opponent_team_name, i.team_match_index, i.match_red_cards,
    v.market, v.for_value, v.against_value, i.referee
  from indexed i
  cross join lateral (values
    ('Shot', i.f_shot, i.a_shot), ('SOT', i.f_sot, i.a_sot),
    ('Foul', i.f_foul, i.a_foul), ('Corner', i.f_corner, i.a_corner),
    ('Offside', i.f_offside, i.a_offside), ('Saves', i.f_saves, i.a_saves),
    ('Tackle', i.f_tackle, i.a_tackle), ('Card', i.f_card, i.a_card),
    ('Throw-in', i.f_throw, i.a_throw), ('Goal Kick', i.f_gkick, i.a_gkick)
  ) v(market, for_value, against_value)
)
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from unp
where team_slug is not null and for_value is not null;

-- 2) Kupa sezon ozetleri (msm.team_season_stats_v1 deseni)
create or replace view msm.eurocup_team_season_stats_v1 as
select league, season, team_slug, market, source,
  min(source_rank) as source_rank,
  count(*) filter (where is_home)     as home_games,
  count(*) filter (where not is_home) as away_games,
  avg(for_value)     filter (where is_home)     as hf,
  avg(against_value) filter (where is_home)     as ha,
  avg(for_value)     filter (where not is_home) as af,
  avg(against_value) filter (where not is_home) as aa
from msm.eurocup_team_match_log_v1
group by league, season, team_slug, market, source;

-- 3) analytics wrapper'lari: eski govde + kupa dallari (UNION ALL).
--    Frontend eq(league) filtreledigi icin davranis tsl/tff1/cup'ta birebir ayni.
create or replace view analytics.msm_team_match_log_v1 as
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from msm.team_match_log_v1
union all
select league, season, source, source_rank, source_match_id, match_datetime,
  team_slug, team_name, is_home, opp_slug, opponent_team_name,
  team_match_index, match_red_cards, market, for_value, against_value, referee
from msm.eurocup_team_match_log_v1;

create or replace view analytics.msm_team_season_stats_v1 as
select league, season, team_slug, market, source, source_rank,
  home_games, away_games, hf, ha, af, aa
from msm.team_season_stats_v1
union all
select league, season, team_slug, market, source, source_rank,
  home_games, away_games, hf, ha, af, aa
from msm.eurocup_team_season_stats_v1;

-- 4) Takim listesi: histdata'dan (kupa dahil, seed sonrasi); ad oncelik:
--    team_mapping (tsl/tff1 slug) -> tff1_team_logos_v1 (sofascore id) ->
--    histdata team_name -> slug.
create or replace view analytics.msm_teams_v1 as
select h.league, h.team_slug,
  coalesce(dn.display_name, lg.team_name, h.team_name, h.team_slug) as display_name
from (
  select league, team_slug, max(team_name) as team_name
  from msm.histdata group by league, team_slug
) h
left join lateral (
  select tm.display_name from ref.team_mapping tm
  where tm.team_slug = h.team_slug
  order by tm.is_active desc nulls last, length(tm.display_name) desc
  limit 1
) dn on true
left join analytics.tff1_team_logos_v1 lg on lg.team_id = h.team_slug;

-- 5) Kupa MSM fikstur view'lari (msm_fixtures_tff1_v1 deseni; slug = sofascore id,
--    hard-coded team_map GEREKMEZ)
create or replace view analytics.msm_fixtures_eurocl_v1 as
select f.fixture_id, f.round_number, 'UEFA Şampiyonlar Ligi'::text as competition,
  f.season_label, f.home_team_id as home_team_slug,
  f.away_team_id as away_team_slug, f.home_team_name, f.away_team_name,
  f.fixture_datetime
from analytics.ucl_fixtures_v1 f
where f.season_label = ref.current_season_label();

create or replace view analytics.msm_fixtures_euel_v1 as
select f.fixture_id, f.round_number, 'UEFA Avrupa Ligi'::text as competition,
  f.season_label, f.home_team_id as home_team_slug,
  f.away_team_id as away_team_slug, f.home_team_name, f.away_team_name,
  f.fixture_datetime
from analytics.uel_fixtures_v1 f
where f.season_label = ref.current_season_label();

create or replace view analytics.msm_fixtures_euecl_v1 as
select f.fixture_id, f.round_number, 'UEFA Konferans Ligi'::text as competition,
  f.season_label, f.home_team_id as home_team_slug,
  f.away_team_id as away_team_slug, f.home_team_name, f.away_team_name,
  f.fixture_datetime
from analytics.uecl_fixtures_v1 f
where f.season_label = ref.current_season_label();

grant select on analytics.msm_fixtures_eurocl_v1, analytics.msm_fixtures_euel_v1,
  analytics.msm_fixtures_euecl_v1 to authenticated, service_role;

-- 6) SEED: model_config (tsl kopyasi, agirlik s1=0.5 gecen sezon + s4=0.5 bu sezon)
insert into msm.model_config (league, margin, referee_weight, supremacy_divisor,
  xmatrix_w_own_for, xmatrix_w_own_alt, xmatrix_w_opp_alt, xmatrix_w_opp_against,
  su_low, su_high, engine, mc_samples, weight_s1, weight_s2, weight_s3,
  default_etki, weight_s4, referee_min_matches)
select l.league, m.margin, m.referee_weight, m.supremacy_divisor,
  m.xmatrix_w_own_for, m.xmatrix_w_own_alt, m.xmatrix_w_opp_alt, m.xmatrix_w_opp_against,
  m.su_low, m.su_high, m.engine, m.mc_samples, 0.5, 0, 0, m.default_etki, 0.5,
  m.referee_min_matches
from msm.model_config m
cross join (values ('eurocl'),('euel'),('euecl')) l(league)
where m.league = 'tsl'
on conflict (league) do nothing;

-- 7) SEED: market_config (tsl kopyasi; hakem verisi kupada yok -> referee_applies=false)
insert into msm.market_config (league, market, std_home_ft, std_away_ft,
  std_home_1h, std_away_1h, std_home_2h, std_away_2h, split_1h, split_2h,
  supremacy_applies, referee_applies, line_count, send_halves, mid_only,
  line_count_1h, line_count_2h, under_1h, under_2h, payback_1h, payback_2h,
  supremacy_divisor, enabled)
select l.league, m.market, m.std_home_ft, m.std_away_ft,
  m.std_home_1h, m.std_away_1h, m.std_home_2h, m.std_away_2h, m.split_1h, m.split_2h,
  m.supremacy_applies, false, m.line_count, m.send_halves, m.mid_only,
  m.line_count_1h, m.line_count_2h, m.under_1h, m.under_2h, m.payback_1h, m.payback_2h,
  m.supremacy_divisor, m.enabled
from msm.market_config m
cross join (values ('eurocl'),('euel'),('euecl')) l(league)
where m.league = 'tsl'
on conflict (league, market) do nothing;

-- 8) SEED: template (tsl kopyasi; Config'ten duzenlenebilir)
insert into msm.template (league, market, template_code, details, sort_order)
select l.league, t.market, t.template_code, t.details, t.sort_order
from msm.template t
cross join (values ('eurocl'),('euel'),('euecl')) l(league)
where t.league = 'tsl'
on conflict do nothing;

-- 9) SEED: histdata. Once 2025-2026 gercek ortalamalari (venue eksikse genel
--    ortalamaya duser), sonra yalniz 26/27'de gorunen takimlar icin 26/27
--    ortalamalarindan estimated=true satirlar (frontend 'estimated' rozetini
--    zaten gosteriyor).
insert into msm.histdata (league, season, market, team_name, team_slug, hf, ha, af, aa, estimated)
select s.league, '2025-2026', s.market, nm.team_name, s.team_slug,
  coalesce(s.hf, ov.f), coalesce(s.ha, ov.a), coalesce(s.af, ov.f), coalesce(s.aa, ov.a),
  false
from msm.eurocup_team_season_stats_v1 s
join lateral (
  select max(team_name) as team_name from msm.eurocup_team_match_log_v1 e
  where e.league = s.league and e.team_slug = s.team_slug
) nm on true
join lateral (
  select avg(for_value) as f, avg(against_value) as a
  from msm.eurocup_team_match_log_v1 e
  where e.league = s.league and e.season = s.season
    and e.team_slug = s.team_slug and e.market = s.market
) ov on true
where s.season = '2025-2026'
on conflict (league, season, market, team_name) do nothing;

insert into msm.histdata (league, season, market, team_name, team_slug, hf, ha, af, aa, estimated)
select s.league, '2025-2026', s.market, nm.team_name, s.team_slug,
  coalesce(s.hf, ov.f), coalesce(s.ha, ov.a), coalesce(s.af, ov.f), coalesce(s.aa, ov.a),
  true
from msm.eurocup_team_season_stats_v1 s
join lateral (
  select max(team_name) as team_name from msm.eurocup_team_match_log_v1 e
  where e.league = s.league and e.team_slug = s.team_slug
) nm on true
join lateral (
  select avg(for_value) as f, avg(against_value) as a
  from msm.eurocup_team_match_log_v1 e
  where e.league = s.league and e.season = s.season
    and e.team_slug = s.team_slug and e.market = s.market
) ov on true
where s.season = '2026-2027'
  and not exists (
    select 1 from msm.eurocup_team_season_stats_v1 p
    where p.league = s.league and p.team_slug = s.team_slug and p.season = '2025-2026'
  )
on conflict (league, season, market, team_name) do nothing;

notify pgrst, 'reload schema';
