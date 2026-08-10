-- 2026-08-10: PSM Config > Market listesi anon-grant boslugu.
-- analytics.pm_markets yalnizca authenticated'a grantliydi; anon istemci
-- (dev DEV_AUTH_BYPASS + suresi dolmus oturum) icin okuma/yazma 42501
-- "permission denied" veriyordu -> Market listesi bos gelir, yeni market
-- kaydi sessizce basarisiz olur. pm_model_config'teki desenle esitlenir.
grant select, insert, update, delete on analytics.pm_markets to anon;

notify pgrst, 'reload schema';
