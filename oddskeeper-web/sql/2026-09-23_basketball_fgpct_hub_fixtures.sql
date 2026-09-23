-- 2026-09-23: (1) Takim FG% (fgmadepct) config satirlari ev+dep, 3 lig. Onceden yalniz
--     BSL'de kullanicinin '3333' etiketli test satiri (home_custom_fgmadepct_310853,
--     template '1111111', std 1) vardi -> deplasmanda FG% yoktu. Test satiri silinir
--     (yeni ev satiriyla ayni base_metric; kalsa Model'de gizli ama export'a cop line
--     uretirdi), yerine duzgun home/away seed (std 7, template kullanici doldurur).
-- (2) BSL hub Results&Fixtures: bb_fixtures_v1 artik SofaScore upcoming_events'ten
--     (basketball.fixtures Excel tablosu BOS). Takim slug'i basketball.teams.sofascore_team_id
--     ile; hafta 'Round N'; ertelenen/iptal/bitmis maclar disarida. Kolon tipi degistigi
--     icin (fixture_id integer -> bigint) drop + create. anon grant YOK (lockdown).

-- ---- 1) FG% takim satirlari ----
delete from analytics.bb_pm_market_config
 where league = 'basketball' and market_group = 'team' and market_key = 'home_custom_fgmadepct_310853';

insert into analytics.bb_pm_market_config
  (league, market_group, market_key, label, base_metric, side, template_id, std, sort_order)
select lg.league, 'team', s.side || '_fgmadepct', s.pfx || ' İsabet %', 'fgmadepct', s.side, null, 7, 87 + s.ord
from (values ('basketball'), ('euroleague'), ('eurocup')) lg(league)
cross join (values ('home','Ev',1), ('away','Dep',2)) s(side, pfx, ord)
on conflict (league, market_group, market_key) do nothing;

-- ---- 2) BSL hub fiksturu (SofaScore) ----
drop view if exists analytics.bb_fixtures_v1;

create view analytics.bb_fixtures_v1 as
with ev as (
  select u.*, (u.start_ts at time zone 'Europe/Istanbul') as local_ts
  from tracker.upcoming_events u
  where u.sport = 'basketball'
    and u.category_name = 'Turkey'
    and (u.tournament_name = 'Turkish Basketball Super League'
         or u.tournament_name ilike '%Basketball Super Cup%'
         or u.tournament_name ilike 'Turkish Cup%'
         or u.tournament_name ilike 'Turkish Basketball Cup%')
    and u.tournament_name not ilike '%women%'
    and coalesce(u.status_type, 'notstarted') in ('notstarted', 'inprogress')
    and u.start_ts >= now() - interval '6 hours'
)
select
  e.event_id                                                       as fixture_id,
  case when extract(month from e.local_ts) >= 8
       then extract(year from e.local_ts)::int || '-' || (extract(year from e.local_ts)::int + 1)
       else (extract(year from e.local_ts)::int - 1) || '-' || extract(year from e.local_ts)::int
  end                                                              as season_label,
  case when e.tournament_name = 'Turkish Basketball Super League' then 'BSL' else e.tournament_name end as competition,
  case when e.round_info ~ '^Round [0-9]+$' then substring(e.round_info from '[0-9]+')::int end as week,
  e.round_info                                                     as round_label,
  e.home_team_name || ' - ' || e.away_team_name                    as match_text,
  th.team_slug                                                     as home_team_slug,
  coalesce(th.team_name, e.home_team_name)                         as home_team_name,
  ta.team_slug                                                     as away_team_slug,
  coalesce(ta.team_name, e.away_team_name)                         as away_team_name,
  e.start_ts,
  e.status_type
from ev e
left join basketball.teams th on th.sofascore_team_id = e.home_team_id
left join basketball.teams ta on ta.sofascore_team_id = e.away_team_id
where th.team_slug is not null or ta.team_slug is not null;

grant select on analytics.bb_fixtures_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
