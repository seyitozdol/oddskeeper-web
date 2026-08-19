-- 2026-08-19: MSM market gorunurluk bayragi + 3 yeni STS marketi (UI-only).
-- (1) market_config.enabled: tiksiz market Model sekmesindeki market dropdown'unda
--     gorunmez (Config tablosunda durur). Mevcut marketler enabled=true baslar.
-- (2) Yeni marketler: Crosses / Interceptions / Long Balls. VERI TARAFI HENUZ YOK;
--     kullanici data bitince tik koyup acacak -> enabled=false, std/split degerleri
--     PLACEHOLDER (kullanici dolduracak). Template'ler sadece FT (Total/Home/Away,
--     sort_order 1-3); yari bloklari template'siz oldugu icin export otomatik atlar.

alter table msm.market_config add column if not exists enabled boolean not null default true;

-- Yeni market_config satirlari (mevcut tum ligler; supremacy boleni ligin global
-- degerinden). where not exists: tekrar kosulabilir.
insert into msm.market_config
  (league, market, std_home_ft, std_away_ft, std_home_1h, std_away_1h, std_home_2h, std_away_2h,
   split_1h, split_2h, supremacy_applies, referee_applies, enabled, supremacy_divisor)
select l.league, m.market, 2, 2, 1.5, 1.5, 1.5, 1.5, 0.5, 0.5, false, false, false,
       coalesce(mc.supremacy_divisor, 5.5)
from (values ('Crosses'), ('Interceptions'), ('Long Balls')) m(market)
cross join (select distinct league from msm.market_config) l
left join msm.model_config mc on mc.league = l.league
where not exists (
  select 1 from msm.market_config x where x.league = l.league and x.market = m.market
);

-- Template'ler (tsl + tff1; cup'ta hic template yok, ayni birakildi).
-- template_code = kisa kod (xlsx Market Template kolonu), details = uzun ad.
insert into msm.template (league, market, template_code, details, sort_order)
select l.league, t.market, t.code, t.details, t.sort_order
from (values
  ('Crosses',       'STSTCM',  'Total Crosses',       1),
  ('Crosses',       'STSHCM',  'Home Crosses',        2),
  ('Crosses',       'STSACM',  'Away Crosses',        3),
  ('Interceptions', 'STSTIM',  'Total Interceptions', 1),
  ('Interceptions', 'STSHIM',  'Home Interceptions',  2),
  ('Interceptions', 'STSAIM',  'Away Interceptions',  3),
  ('Long Balls',    'STSTLBM', 'Total Long Balls',    1),
  ('Long Balls',    'STSHLBM', 'Home Long Balls',     2),
  ('Long Balls',    'STSALBM', 'Away Long Balls',     3)
) t(market, code, details, sort_order)
cross join (values ('tsl'), ('tff1')) l(league)
where not exists (
  select 1 from msm.template x
  where x.league = l.league and x.market = t.market and x.template_code = t.code
);

-- Yazma RPC'si enabled alanini kabul etsin.
create or replace function public.msm_update_market_config(p_league text, p_market text, p_patch jsonb)
returns void language plpgsql security definer set search_path = msm, public as $$
begin
  update msm.market_config set
    std_home_ft       = coalesce((p_patch->>'std_home_ft')::numeric, std_home_ft),
    std_away_ft       = coalesce((p_patch->>'std_away_ft')::numeric, std_away_ft),
    std_home_1h       = coalesce((p_patch->>'std_home_1h')::numeric, std_home_1h),
    std_away_1h       = coalesce((p_patch->>'std_away_1h')::numeric, std_away_1h),
    std_home_2h       = coalesce((p_patch->>'std_home_2h')::numeric, std_home_2h),
    std_away_2h       = coalesce((p_patch->>'std_away_2h')::numeric, std_away_2h),
    split_1h          = coalesce((p_patch->>'split_1h')::numeric, split_1h),
    split_2h          = coalesce((p_patch->>'split_2h')::numeric, split_2h),
    supremacy_applies = coalesce((p_patch->>'supremacy_applies')::boolean, supremacy_applies),
    referee_applies   = coalesce((p_patch->>'referee_applies')::boolean, referee_applies),
    line_count        = coalesce((p_patch->>'line_count')::int, line_count),
    send_halves       = coalesce((p_patch->>'send_halves')::boolean, send_halves),
    mid_only          = coalesce((p_patch->>'mid_only')::boolean, mid_only),
    line_count_1h     = coalesce((p_patch->>'line_count_1h')::int, line_count_1h),
    line_count_2h     = coalesce((p_patch->>'line_count_2h')::int, line_count_2h),
    under_1h          = coalesce((p_patch->>'under_1h')::boolean, under_1h),
    under_2h          = coalesce((p_patch->>'under_2h')::boolean, under_2h),
    payback_1h        = coalesce((p_patch->>'payback_1h')::numeric, payback_1h),
    payback_2h        = coalesce((p_patch->>'payback_2h')::numeric, payback_2h),
    supremacy_divisor = coalesce((p_patch->>'supremacy_divisor')::numeric, supremacy_divisor),
    enabled           = coalesce((p_patch->>'enabled')::boolean, enabled),
    updated_at        = now()
  where league = p_league and market = p_market;
end $$;

revoke execute on function public.msm_update_market_config(text, text, jsonb) from public, anon;
grant execute on function public.msm_update_market_config(text, text, jsonb) to authenticated, service_role;

-- Wrapper view select * kolonlari olusturulma aninda sabitler -> yeniden kur.
create or replace view analytics.msm_market_config_v1 as select * from msm.market_config;
grant select on analytics.msm_market_config_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
