-- 2026-09-19: BSL mac verisi icin OTOMATIK kaynak = FlashScore (sahip karari: "manuel is olmasin,
-- futboldaki gibi mac bitince kendiliginden aksin").
--
-- NEDEN: TBF (resmi site) TR-geo + Cloudflare arkasinda; her sezon faaliyetId/seasonId elle
-- bulunmali ve headful tarayici + TR proxy ister. FlashScore ise ayni box-score'u DUZ HTTP ile
-- verir (VPS'ten proxysiz/tarayicisiz; futbol match_scrape kalibi): sonuc sayfasina gomulu feed
-- (mac id + tip-off + durum + tur) + mac basina df_psn (oyuncu) / df_st (takim) beslemesi.
-- Tek eksik alan: fouls_drawn (FlashScore yayinlamiyor) -> NULL kalir.
--
-- Kimlik: FlashScore oyuncu id'si (kalici, /player/<ad>/<id>/) players.fs_player_id'de; takim
-- id'leri kaynak-bagimsiz tek tabloda birikir (team_tbf_ids bunun TBF'ye ozel ilk haliydi).

alter table basketball.players add column if not exists fs_player_id text;
create unique index if not exists uq_bb_players_fs on basketball.players(fs_player_id)
  where fs_player_id is not null;

alter table basketball.player_match_stats
  add column if not exists fs_player_id text,
  add column if not exists fs_match_id  text;
create unique index if not exists uq_bb_pms_fs on basketball.player_match_stats(fs_match_id, fs_player_id)
  where fs_match_id is not null and fs_player_id is not null;

alter table basketball.team_match_stats
  add column if not exists fs_team_id  text,
  add column if not exists fs_match_id text;
create unique index if not exists uq_bb_tms_fs on basketball.team_match_stats(fs_match_id, fs_team_id)
  where fs_match_id is not null and fs_team_id is not null;

-- Kaynak takim id'leri (TBF sezonluk sayisal id, FlashScore kalici metin id) tek yerde.
create table if not exists basketball.team_source_ids (
  source text not null,
  source_team_id text not null,
  team_slug text not null references basketball.teams(team_slug) on update cascade,
  season_label text,
  source_name text,
  created_at timestamptz not null default now(),
  primary key (source, source_team_id)
);
alter table basketball.team_source_ids enable row level security;
revoke all on basketball.team_source_ids from anon, authenticated;

do $$
begin
  if to_regclass('basketball.team_tbf_ids') is not null then
    insert into basketball.team_source_ids (source, source_team_id, team_slug, season_label, source_name)
    select 'tbf', tbf_team_id::text, team_slug, season_label, tbf_name from basketball.team_tbf_ids
    on conflict (source, source_team_id) do nothing;
    drop table basketball.team_tbf_ids;
  end if;
end $$;

-- Inceleme kuyrugu: FlashScore id'leri metin ("htMm729K") -> source_id text.
alter table basketball.identity_review alter column source_id type text using source_id::text;

-- Bir kaynak ayni kisiye birden cok id verebiliyor (FlashScore 25/26: Scoochie Smith, Lynn Kidd,
-- V.J. King, Markel Starks iki ayri id ile; SofaScore'da da goruldu). players.<kaynak>_player_id
-- tek "birincil" id'yi tutar; ek id'ler burada birikir ve kimlik katmani ikisine de bakar.
create table if not exists basketball.player_source_ids (
  source text not null,
  source_player_id text not null,
  player_slug text not null references basketball.players(player_slug) on update cascade,
  source_name text,
  created_at timestamptz not null default now(),
  primary key (source, source_player_id)
);
alter table basketball.player_source_ids enable row level security;
revoke all on basketball.player_source_ids from anon, authenticated;
