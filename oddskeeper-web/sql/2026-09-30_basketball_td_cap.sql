-- 2026-09-30: Triple-double oran tavani 200 (sahip karari). Config > Market Templates (Player)
-- Triple-Double satirindaki "Cap" kolonundan degistirilebilir. Elle girilen orana tavan uygulanmaz.

update analytics.bb_pm_market_config
set odds_cap = 200, updated_at = now()
where market_group = 'player' and market_key = 'td' and league in ('basketball', 'euroleague', 'eurocup');
