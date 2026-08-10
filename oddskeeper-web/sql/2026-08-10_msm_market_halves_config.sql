-- 2026-08-10: MSM Config "Markets" alt-sekmesi - yari-bazli derin kontrol.
-- Her market icin 1H/2H ayri ayri: acilacak cizgi sayisi, Under gonderilsin mi,
-- payback (marj). FT cizgi sayisi mevcut line_count; FT payback global margin
-- (model_config.margin) kalir. payback_1h/2h mevcut margin'den seed edilir;
-- sonrasi bagimsizdir (global margin degisse de yarilar kendi degerini korur).

alter table msm.market_config add column if not exists line_count_1h int     not null default 3;
alter table msm.market_config add column if not exists line_count_2h int     not null default 3;
alter table msm.market_config add column if not exists under_1h      boolean not null default true;
alter table msm.market_config add column if not exists under_2h      boolean not null default true;
alter table msm.market_config add column if not exists payback_1h    numeric not null default 0.93;
alter table msm.market_config add column if not exists payback_2h    numeric not null default 0.93;

-- Seed: yari payback'leri ligin mevcut global margin'iyle esitle (davranis
-- degismeden baslasin).
update msm.market_config mc
set payback_1h = m.margin, payback_2h = m.margin
from msm.model_config m
where m.league = mc.league;

-- Yazma RPC'si yeni alanlari kabul etsin.
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
    updated_at        = now()
  where league = p_league and market = p_market;
end $$;

grant execute on function public.msm_update_market_config(text, text, jsonb) to anon, authenticated;

-- Wrapper view select * kolonlari olusturulma aninda sabitler -> yeniden kur.
create or replace view analytics.msm_market_config_v1 as select * from msm.market_config;
grant select on analytics.msm_market_config_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
