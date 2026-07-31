-- TSL (Super Lig) transfer tablosu. Transfermarkt'tan doldurulur.
-- Frontend 4. sablon (resmi) Takimlar sekmesinde transfer tablosu gosterir.

create table if not exists football.tsl_transfers (
  id             bigserial primary key,
  season_label   text not null,               -- ör. "2025/2026"
  transfer_window         text,                         -- "summer" | "winter"
  player_name    text not null,
  player_slug    text,                         -- opta player_slug ile eslesirse link
  player_photo_url text,
  position_code  text,
  age            int,
  nationality    text,
  from_team_name text,
  from_team_logo text,                          -- URL veya /images/... yolu
  to_team_name   text,
  to_team_logo   text,
  fee_text       text,                          -- "€10.00m", "loan", "free transfer"
  fee_eur        bigint,                         -- sayisal (ödünç/bedava = 0/null)
  is_tsl_arrival boolean default true,          -- Super Lig kulübüne gelis mi
  transfer_date  date,
  source         text default 'transfermarkt',
  created_at     timestamptz default now(),
  unique (season_label, player_name, from_team_name, to_team_name)
);

create index if not exists tsl_transfers_season_idx on football.tsl_transfers (season_label);

create or replace view analytics.tsl_transfers_v1 as
select
  season_label,
  transfer_window,
  player_name,
  player_slug,
  player_photo_url,
  position_code,
  age,
  nationality,
  from_team_name,
  from_team_logo,
  to_team_name,
  to_team_logo,
  fee_text,
  fee_eur,
  is_tsl_arrival,
  transfer_date
from football.tsl_transfers;

grant select on analytics.tsl_transfers_v1 to anon, authenticated, service_role;
