-- MSM: 26-27 (güncel sezon) 4. sezon ağırlığı — elle 4 sezonluk harman.
-- Önceki mantık: 3 geçmiş sezon (weight_s1/s2/s3) + ayrı Etki% (default_etki) ile güncel harman.
-- Yeni mantık: 26-27 dördüncü sezon olarak DOĞRUDAN ağırlıklandırma harmanına girer (weight_s4).
--   26-27 değeri güncel sezon maç-logu penceresinden (hafta/son-x/Big4/RedC) gelir.
--   Etki% kaldırıldı; default_etki kolonu geriye dönük duruyor ama artık kullanılmıyor.

alter table msm.model_config add column if not exists weight_s4 numeric not null default 0; -- 2026-2027 (güncel), sezon başında 0

-- ── Yazma RPC'sine weight_s4 patch desteği ekle (diğer alanlar aynı) ──────────
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
    weight_s4             = coalesce((p_patch->>'weight_s4')::numeric, weight_s4),
    default_etki          = coalesce((p_patch->>'default_etki')::numeric, default_etki),
    updated_at            = now()
  where league = p_league;
end $$;

grant execute on function public.msm_update_model_config(text, jsonb) to anon, authenticated;

-- ── Wrapper view yeni kolonu görsün (select * kolonları oluşturma anında sabitler) ──
create or replace view analytics.msm_model_config_v1 as select * from msm.model_config;
grant select on analytics.msm_model_config_v1 to anon, authenticated;

notify pgrst, 'reload schema';
