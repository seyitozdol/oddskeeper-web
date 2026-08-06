-- MSM okuma yüzeyi: msm.* base tabloları PostgREST'e expose DEĞİL (msm exposed listede yok).
-- Frontend anon client zaten 'analytics' şemasını okuyor → ince wrapper view'lar analytics'te.
-- Base veri msm'de kalır (verbatim depo); analytics = API yüzeyi.

create or replace view analytics.msm_market_config_v1 as select * from msm.market_config;
create or replace view analytics.msm_model_config_v1  as select * from msm.model_config;
create or replace view analytics.msm_referee_v1       as select * from msm.referee;
create or replace view analytics.msm_histdata_v1      as select * from msm.histdata;
create or replace view analytics.msm_team_season_stats_v1 as select * from msm.team_season_stats_v1;

-- Takım listesi (dropdown): league başına distinct slug + tek görünen ad.
create or replace view analytics.msm_teams_v1 as
select h.league, h.team_slug,
       coalesce(dn.display_name, h.team_slug) as display_name
from (select distinct league, team_slug from msm.histdata) h
left join lateral (
  select tm.display_name
  from ref.team_mapping tm
  where tm.team_slug = h.team_slug
  order by tm.is_active desc nulls last, length(tm.display_name) desc
  limit 1
) dn on true;

grant select on analytics.msm_market_config_v1,
                analytics.msm_model_config_v1,
                analytics.msm_referee_v1,
                analytics.msm_histdata_v1,
                analytics.msm_team_season_stats_v1,
                analytics.msm_teams_v1
  to anon, authenticated;
