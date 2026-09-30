-- 2026-09-30: Extra Markets (futbol Extras sekmesi; TSL / 1. Lig / Kupa).
--
-- "Extra_Markets_v3.xlsm" makrosunun web portu icin iki tablo:
--   msm_extra_markets_config   : Profiles tablosu (tek satir, jsonb). Ligler arasi ORTAK
--                                (Excel'de tek Profiles sayfasi). Satir yoksa frontend
--                                koddaki varsayilani (features/extra-markets/engine.ts) kullanir.
--   msm_extra_markets_fixtures : mac basina secilen profil + No Goal orani.
--
-- Erisim: okuma analytics'ten dogrudan (authenticated select). Yazma yalniz service-role
-- ile /api/extra-markets/write route'undan (msm/write deseni; RPC yok, is kurali yok).

create table if not exists analytics.msm_extra_markets_config (
  id smallint primary key default 1 check (id = 1),
  config jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists analytics.msm_extra_markets_fixtures (
  league text not null,
  fixture_id text not null,
  profile text not null default '',
  no_goal numeric,
  updated_at timestamptz not null default now(),
  primary key (league, fixture_id)
);

grant select on analytics.msm_extra_markets_config to authenticated;
grant select on analytics.msm_extra_markets_fixtures to authenticated;
grant all on analytics.msm_extra_markets_config to service_role;
grant all on analytics.msm_extra_markets_fixtures to service_role;

notify pgrst, 'reload schema';
