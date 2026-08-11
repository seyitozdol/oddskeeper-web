-- 2026-08-11: Player Market yazma yuzeyi service-role route'a tasindi.
-- pm_* / bb_pm_* kalici tablolarina yazma artik dogrudan anon/authenticated
-- ile degil, /api/player-market/write ve /api/basketball/pm-write route'lari
-- uzerinden (getNavAccess ile oturum dogrulanir, createAdminClient ile yazilir)
-- yapiliyor. Bu tablolarda anon/authenticated icin INSERT/UPDATE/DELETE geri
-- cekilir; SELECT (panolar/editorler okumaya devam eder) korunur.
--
-- ONEMLI SIRA: bu migration YALNIZ yeni kod (route + wired editorler) canliya
-- deploy edildikten SONRA calistirilmali. Once calistirilirsa canlidaki eski
-- istemci (dogrudan anon/authenticated yazan) editorleri bozar.
--
-- Geri onceki durum: 2026-08-10_pm_markets_anon_grant.sql (bu grant'i vermisti).

revoke insert, update, delete, truncate on
  analytics.pm_markets,
  analytics.pm_model_config,
  analytics.pm_player_ids,
  analytics.pm_fixture_inputs,
  analytics.bb_pm_markets,
  analytics.bb_pm_market_config,
  analytics.bb_pm_fixtures,
  analytics.bb_pm_player_ids,
  analytics.bb_pm_player_merges
from anon, authenticated;

-- bb_model_config bir VIEW; yalniz UPDATE grant'i vardi (rol esikleri kaydi).
revoke update on analytics.bb_model_config from anon, authenticated;

notify pgrst, 'reload schema';
