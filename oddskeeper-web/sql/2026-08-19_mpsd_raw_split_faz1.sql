-- 2026-08-19: raw_stats yan tablo ayrimi FAZ 1 (sahip karari, mimari inceleme soru 4/B)
--
-- Gerekce: match_player_stats_details (mpsd) 339 MB = DB'nin ~%43'u; icindeki
-- raw_stats jsonb 224 MB ve gelecekte modele girecek 3 yeni metrik (cross,
-- interception, long balls) icin ham veri SAKLANACAK. Hedef: ham jsonb'yi
-- yan tabloya alip sicak tabloyu kucultmek.
--
-- FAZ 1 (bu dosya, okuyucu riski SIFIR):
--   1. football.match_player_stats_raw yan tablosu (dogal anahtar PK).
--   2. mpsd uzerine senkron trigger: raw_stats yazan her insert/update yan
--      tabloya da upsert eder (loader kodu DEGISMEDI; gecis boyunca cift kopya).
--   3. Backfill ayri script'te partili yapilir (tek INSERT..SELECT 224 MB'yi
--      tek transaction'da tasir, micro instance'ta WAL baskisi yapar).
--
-- FAZ 2 (ayri odakli oturum, runbook memory'de): mpsd.raw_stats'i okuyan 22
-- canli view/mat yan tabloya join'lenir, loader'lar dogrudan yan tabloya yazar,
-- trigger + mpsd.raw_stats kolonu dusurulur, sessiz pencerede VACUUM FULL.
--
-- Grant notu: yan tabloya PostgREST rollerinden SELECT gerekmez (view'lar owner
-- uzerinden okur); anon YASAK (lockdown 2026-08-19).

begin;

create table if not exists football.match_player_stats_raw (
  source            text not null,
  source_match_id   text not null,
  source_player_id  text not null,
  raw_stats         jsonb not null,
  updated_at        timestamptz not null default now(),
  primary key (source, source_match_id, source_player_id)
);

comment on table football.match_player_stats_raw is
  'mpsd.raw_stats yan kopyasi (Faz 1, 2026-08-19). Faz 2''de tek dogruluk kaynagi olacak.';

create or replace function football.mpsd_sync_raw() returns trigger
language plpgsql as $$
begin
  -- Degismeyen raw_stats icin olu satir uretme (grace penceresi ayni maci
  -- defalarca upsert ediyor); yalniz gercek degisiklikte yaz.
  if new.raw_stats is not null then
    insert into football.match_player_stats_raw as r
      (source, source_match_id, source_player_id, raw_stats)
    values (new.source, new.source_match_id, new.source_player_id, new.raw_stats)
    on conflict (source, source_match_id, source_player_id)
    do update set raw_stats = excluded.raw_stats, updated_at = now()
    where r.raw_stats is distinct from excluded.raw_stats;
  end if;
  return new;
end $$;

drop trigger if exists trg_mpsd_sync_raw on football.match_player_stats_details;
create trigger trg_mpsd_sync_raw
after insert or update of raw_stats on football.match_player_stats_details
for each row execute function football.mpsd_sync_raw();

commit;
