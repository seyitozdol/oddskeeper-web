-- 2026-08-10: Sentetik kadro kayitlari (API-Football gecikmesi koprusu).
--
-- API-Football yaz transferlerini gec isler (or. Salah gunlerce eksik kaldi).
-- Kuratif liste: Transfermarkt'ta kadroda olup bizde olmayan yuksek degerli
-- oyuncular apply_synthetic_squad.py ile bu tabloya seed edilir ve
-- team_squad_current'a source='synthetic-tm', source_player_id='tm<ID>' ile
-- yazilir. Gunluk kadro tazelemesi yalniz source='apifootball' satirlarini
-- sildigi icin sentetikler yasar; API oyuncuyu ekleyince apply adimi sentetigi
-- OTOMATIK emekli eder (active=false + squad satiri silinir).

create table if not exists football.squad_synthetic_players (
  tm_player_id text primary key,
  team_slug text not null,
  player_name text not null,
  position text,
  birth_date date,
  market_value_eur bigint,
  active boolean not null default true,
  retired_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on football.squad_synthetic_players to service_role;
