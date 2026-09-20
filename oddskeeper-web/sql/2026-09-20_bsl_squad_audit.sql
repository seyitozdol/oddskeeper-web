-- 2026-09-20: BSL kadro denetimi (futbol football.squad_audit'in basketbol karsiligi).
-- Ayni sayfa (/dashboard/squad-audit?sport=basketball), ayni uc liste + fotograf listesi:
--   ours_not_ref      : 26/27 kadromuzda var, RealGM'in o takim kadrosunda yok VE henuz o takimda
--                       maca cikmadi (maca cikan oyuncu dogrulanmis sayilir; RealGM genc Turk
--                       oyunculari listelemiyor). RealGM'in kapsamadigi takim (< 8 oyuncu) atlanir.
--   ref_not_ours      : RealGM kadrosunda var, bizim o takim kadromuzda yok
--   no_participant_id : platform participant id'si (analytics.bb_pm_player_ids) olmayan kadro oyuncusu
--   no_photo          : profil fotografi kaynagi (sofascore id / EuroLeague headshot) olmayan oyuncu
-- Referans = RealGM (transferi en iyi bilen kaynak; futbolda Transfermarkt'in yeri).
-- RealGM, sunucu IP'sine Cloudflare dogrulamasi gosterdiginden goruntu ev IP'sinden tazelenir
-- (fetch_realgm_bsl_rosters.py); denetim her sabah VPS'te SON goruntuden yeniden kurulur
-- (build_bsl_squad_audit.py), goruntu tarihi satirlarda tasinir.

create table if not exists basketball.realgm_roster_snapshot (
  season_label text not null,
  team_slug text not null,
  realgm_player_id bigint not null,
  player_name text not null,
  birth_date date,
  position text,
  fetched_at timestamptz not null default now(),
  primary key (season_label, team_slug, realgm_player_id)
);
alter table basketball.realgm_roster_snapshot enable row level security;
revoke all on basketball.realgm_roster_snapshot from anon, authenticated;

create table if not exists basketball.squad_audit (
  id bigserial primary key,
  section text not null check (section in ('ours_not_ref', 'ref_not_ours', 'no_participant_id', 'no_photo')),
  season_label text not null,
  team_slug text not null,
  team_name text not null,
  player_slug text,
  player_name text not null,
  detail text,
  ref_fetched_at timestamptz,
  run_at timestamptz not null default now()
);
alter table basketball.squad_audit enable row level security;
revoke all on basketball.squad_audit from anon, authenticated;

create or replace view analytics.bb_squad_audit_v1 as
select section, season_label, team_slug, team_name, player_slug, player_name, detail, ref_fetched_at, run_at
from basketball.squad_audit;

grant select on analytics.bb_squad_audit_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
