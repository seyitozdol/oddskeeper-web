-- MSM Config sekmesi: şema genişletme + yazma RPC'leri.
-- market_config'e line_count / send_halves / mid_only; model_config'e sezon ağırlıkları + etki.
-- msm PostgREST'e expose DEĞİL → yazma public şema SECURITY DEFINER RPC'leri ile (anon çağırır).

-- ── market_config genişletme ──────────────────────────────────────────────
alter table msm.market_config add column if not exists line_count  int     not null default 3;   -- FT bloklarında açılacak çizgi sayısı (3 | 5)
alter table msm.market_config add column if not exists send_halves boolean not null default true; -- 1H/2H marketleri export edilsin mi
alter table msm.market_config add column if not exists mid_only    boolean not null default false;-- sadece orta çizgi (Offside/Saves)

-- Makrodaki gömülü kurallar seed:
update msm.market_config set line_count = 5 where market in ('Shot','Foul','Throw-in');
update msm.market_config set mid_only   = true where market in ('Offside','Saves');

-- ── model_config genişletme (ağırlıklandırma) ────────────────────────────
alter table msm.model_config add column if not exists weight_s1    numeric not null default 0.5; -- 2025-2026
alter table msm.model_config add column if not exists weight_s2    numeric not null default 0.3; -- 2024-2025
alter table msm.model_config add column if not exists weight_s3    numeric not null default 0.2; -- 2023-2024
alter table msm.model_config add column if not exists default_etki numeric not null default 0;   -- güncel/geçmiş harman varsayılanı

-- ── Yazma RPC'leri (public şema, SECURITY DEFINER; anon çağırır) ──────────
create or replace function public.msm_update_model_config(p_league text, p_patch jsonb)
returns void language plpgsql security definer set search_path = msm, public as $$
begin
  update msm.model_config set
    margin                = coalesce((p_patch->>'margin')::numeric, margin),
    referee_weight        = coalesce((p_patch->>'referee_weight')::numeric, referee_weight),
    supremacy_divisor     = coalesce((p_patch->>'supremacy_divisor')::numeric, supremacy_divisor),
    xmatrix_w_own_for     = coalesce((p_patch->>'xmatrix_w_own_for')::numeric, xmatrix_w_own_for),
    xmatrix_w_own_alt     = coalesce((p_patch->>'xmatrix_w_own_alt')::numeric, xmatrix_w_own_alt),
    xmatrix_w_opp_alt     = coalesce((p_patch->>'xmatrix_w_opp_alt')::numeric, xmatrix_w_opp_alt),
    xmatrix_w_opp_against = coalesce((p_patch->>'xmatrix_w_opp_against')::numeric, xmatrix_w_opp_against),
    su_low                = coalesce((p_patch->>'su_low')::numeric, su_low),
    su_high               = coalesce((p_patch->>'su_high')::numeric, su_high),
    engine                = coalesce(p_patch->>'engine', engine),
    mc_samples            = coalesce((p_patch->>'mc_samples')::int, mc_samples),
    weight_s1             = coalesce((p_patch->>'weight_s1')::numeric, weight_s1),
    weight_s2             = coalesce((p_patch->>'weight_s2')::numeric, weight_s2),
    weight_s3             = coalesce((p_patch->>'weight_s3')::numeric, weight_s3),
    default_etki          = coalesce((p_patch->>'default_etki')::numeric, default_etki),
    updated_at            = now()
  where league = p_league;
end $$;

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
    updated_at        = now()
  where league = p_league and market = p_market;
end $$;

grant execute on function public.msm_update_model_config(text, jsonb)          to anon, authenticated;
grant execute on function public.msm_update_market_config(text, text, jsonb)   to anon, authenticated;
