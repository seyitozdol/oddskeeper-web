-- 2026-07-29: Player Market kalici tablolarina lig ayrimi.
-- TFF 1. Lig player market sayfasi ayni pm_* tablolarini kullanacak;
-- mevcut satirlar 'tsl' sayilir, TFF1 satirlari league='tff1' ile yazilir.
-- Frontend sorgulari artik league filtresi + bilesik onConflict kullanir.

alter table analytics.pm_markets        add column if not exists league text not null default 'tsl';
alter table analytics.pm_fixture_inputs add column if not exists league text not null default 'tsl';
alter table analytics.pm_player_ids     add column if not exists league text not null default 'tsl';

alter table analytics.pm_markets        drop constraint pm_markets_pkey;
alter table analytics.pm_markets        add primary key (league, market_key);

alter table analytics.pm_fixture_inputs drop constraint pm_fixture_inputs_pkey;
alter table analytics.pm_fixture_inputs add primary key (league, fixture_id);

alter table analytics.pm_player_ids     drop constraint pm_player_ids_pkey;
alter table analytics.pm_player_ids     add primary key (league, player_slug);
