-- 2026-08-12: PSM oyuncu durum override'lari.
-- Model sekmesinde elle degistirilen Starter/Sub/Out durumu sayfadan cikip
-- girince kayboluyordu (yalniz local state). Bu tablo manuel secimi league +
-- player_key bazinda kalici yapar; loader durum cikariminin USTUNE bindirir.
-- Yazma yalniz service-role (/api/player-market/write), okuma anon+auth
-- (dev bypass anon rolu ile okur; pm_* okuma kaliplariyla ayni).

create table if not exists analytics.pm_player_status_overrides (
  league text not null,
  player_key text not null,
  status text not null check (status in ('Pos. Starter', 'Pos. Sub', 'Out')),
  updated_at timestamptz not null default now(),
  primary key (league, player_key)
);

grant select on analytics.pm_player_status_overrides to anon, authenticated, service_role;
grant insert, update, delete on analytics.pm_player_status_overrides to service_role;

notify pgrst, 'reload schema';
