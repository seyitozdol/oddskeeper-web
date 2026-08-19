-- 2026-08-19: MSM supremacy boleni (LVL) market bazina tasindi.
-- Onceden model_config.supremacy_divisor tum marketlere ayni etki yapiyordu;
-- kullanici Shot ve SOT icin farkli deger girmek istiyor. Yeni kolon
-- market_config.supremacy_divisor ligin mevcut global degerinden seed edilir;
-- sonrasi bagimsizdir. model_config.supremacy_divisor kolonu durur ve motorda
-- yalniz market degeri bos olan eski satirlar icin fallback olarak kullanilir.

alter table msm.market_config add column if not exists supremacy_divisor numeric not null default 5.5;

update msm.market_config mc
set supremacy_divisor = m.supremacy_divisor
from msm.model_config m
where m.league = mc.league;

-- Yazma RPC'si yeni alani kabul etsin. CREATE OR REPLACE mevcut grant'leri
-- korur; yine de guvenlik durusu (2026-08-19 anon revoke) acikca yinelenir.
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
    updated_at        = now()
  where league = p_league and market = p_market;
end $$;

revoke execute on function public.msm_update_market_config(text, text, jsonb) from public, anon;
grant execute on function public.msm_update_market_config(text, text, jsonb) to authenticated, service_role;

-- Wrapper view select * kolonlari olusturulma aninda sabitler -> yeniden kur.
create or replace view analytics.msm_market_config_v1 as select * from msm.market_config;
grant select on analytics.msm_market_config_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
