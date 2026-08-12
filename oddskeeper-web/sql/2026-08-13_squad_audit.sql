-- 2026-08-13: Kadro denetim listeleri (header'daki herkese acik 3 sekmeli sayfa).
-- Sabah TM cron zincirinin sonunda build_squad_audit.py tabloyu bastan yazar:
--   ours_not_tm       : bizde var, Transfermarkt kadrosunda yok (tsl + tff1)
--   tm_not_ours       : TM'de var, bizde yok (tsl + tff1)
--   no_participant_id : PSM participant id'si olmayan oyuncular (futbol)
-- Okuma herkese acik (anon + authenticated), yazma yalniz service_role/pipeline.

create table if not exists football.squad_audit (
  id bigserial primary key,
  section text not null check (section in ('ours_not_tm', 'tm_not_ours', 'no_participant_id')),
  league text not null check (league in ('tsl', 'tff1')),
  team_name text not null,
  player_name text not null,
  detail text,
  run_at timestamptz not null default now()
);

grant select, insert, update, delete on football.squad_audit to service_role;
grant usage, select on sequence football.squad_audit_id_seq to service_role;

create or replace view analytics.squad_audit_v1 as
select section, league, team_name, player_name, detail, run_at
from football.squad_audit
order by section, league, team_name, player_name;

grant select on analytics.squad_audit_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
