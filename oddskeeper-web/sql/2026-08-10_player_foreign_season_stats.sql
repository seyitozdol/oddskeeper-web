-- 2026-08-10: Yurt disi (TSL/1.Lig disinda oynanmis) gecmis sezon oyuncu verisi.
--
-- Amac: yeni transferlerin (Greenwood, Salah, ...) PSM'de LY Avg gosterebilmesi.
-- Kaynak: SofaScore oyuncu-sezon istatistikleri
-- (/player/{id}/unique-tournament/{ut}/season/{sid}/statistics/overall);
-- turnuva basina TOPLAM degerler saklanir, view sezon bazinda toplayip
-- mac-basi ortalama doner. Yukleyici: fetch_foreign_player_history.py.
-- Not: sot_ibox/sot_obox yurt disi icin YOK (SofaScore oyuncu-sezon shotmap
-- endpoint'i bulunmuyor); attempts ibox/obox VAR.

create table if not exists football.player_foreign_season_stats (
  sofascore_player_id text not null,
  apifootball_player_id text not null,  -- team_squad_current baglantisi ('tm...' sentetik olabilir)
  player_name text not null,
  season_label text not null,           -- '2025/2026' formati
  tournament_id int not null,           -- sofascore unique-tournament id
  tournament_name text,
  appearances int not null default 0,
  minutes_played int,
  goals numeric, assists numeric,
  shots_total numeric, shots_on_target numeric, shots_off_target numeric, shots_blocked numeric,
  attempts_ibox numeric, attempts_obox numeric,
  expected_goals numeric,
  passes numeric, accurate_pass numeric,
  tackles numeric, fouls_conceded numeric, fouls_won numeric,
  offsides numeric, cards_yellow numeric, cards_red numeric,
  saves_total numeric,
  fetched_at timestamptz not null default now(),
  primary key (sofascore_player_id, tournament_id, season_label)
);

grant select, insert, update, delete on football.player_foreign_season_stats to service_role;

-- Sezon bazinda birlesik (lig+kupa+Avrupa) mac-basi ortalamalar.
-- player_key = PSM'in kullandigi kimlik (opta varsa o, yoksa 'af-<apif_id>').
create or replace view analytics.player_foreign_season_v1 as
select
  f.apifootball_player_id,
  coalesce(pm.opta_player_id, 'af-' || f.apifootball_player_id) as player_key,
  max(f.player_name) as player_name,
  f.season_label,
  sum(f.appearances) as appearances,
  sum(f.minutes_played) as minutes_played,
  sum(f.goals)            / nullif(sum(f.appearances), 0) as goals,
  sum(f.assists)          / nullif(sum(f.appearances), 0) as assists,
  sum(f.shots_total)      / nullif(sum(f.appearances), 0) as shots_total,
  sum(f.shots_on_target)  / nullif(sum(f.appearances), 0) as shots_on_target,
  sum(f.shots_off_target) / nullif(sum(f.appearances), 0) as shots_off_target,
  sum(f.shots_blocked)    / nullif(sum(f.appearances), 0) as shots_blocked,
  sum(f.attempts_ibox)    / nullif(sum(f.appearances), 0) as attempts_ibox,
  sum(f.attempts_obox)    / nullif(sum(f.appearances), 0) as attempts_obox,
  sum(f.expected_goals)   / nullif(sum(f.appearances), 0) as expected_goals,
  sum(f.passes)           / nullif(sum(f.appearances), 0) as passes,
  sum(f.accurate_pass)    / nullif(sum(f.appearances), 0) as accurate_pass,
  sum(f.tackles)          / nullif(sum(f.appearances), 0) as tackles,
  sum(f.fouls_conceded)   / nullif(sum(f.appearances), 0) as fouls_conceded,
  sum(f.fouls_won)        / nullif(sum(f.appearances), 0) as fouls_won,
  sum(f.offsides)         / nullif(sum(f.appearances), 0) as offsides,
  sum(f.cards_yellow)     / nullif(sum(f.appearances), 0) as cards_yellow,
  sum(f.cards_red)        / nullif(sum(f.appearances), 0) as cards_red,
  sum(f.saves_total)      / nullif(sum(f.appearances), 0) as saves_total
from football.player_foreign_season_stats f
left join ref.player_mapping pm on pm.apifootball_player_id = f.apifootball_player_id
group by f.apifootball_player_id, pm.opta_player_id, f.season_label;

grant select on analytics.player_foreign_season_v1 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
