-- SofaScore guncel kadro tablosu (2026-08-15)
--
-- Kaynak: api.sofascore.com /api/v1/team/{id}/players — kulubun GUNCEL kadrosu.
-- Mac oynamis olma sarti yok, yani yeni transferler de icinde. Bu yuzden
-- "TM'de var bizde yok" (squad_audit.tm_not_ours) oyuncularini kimliklendirmek
-- ve eksik bilgilerini (foto/uyruk/boy/dogum/mevki/forma no) doldurmak icin
-- dogru kopru bu tablodur; onceki yontem elle yazilmis NAME_OVERRIDES sozluguydu.
--
-- Yazan: pipeline/src/football/fetch_sofascore_squads.py (gunluk kadro zinciri).

create table if not exists football.sofascore_squad_current (
    sofascore_team_id   text not null,
    sofascore_player_id text not null,
    league              text,
    team_slug           text,
    team_name           text,
    player_name         text,
    player_slug         text,
    position            text,          -- G / D / M / F
    shirt_number        text,
    height_cm           integer,
    country             text,
    birth_date          date,
    fetched_at          timestamptz default now(),
    primary key (sofascore_team_id, sofascore_player_id)
);

create index if not exists sofascore_squad_current_player_idx
  on football.sofascore_squad_current (sofascore_player_id);
create index if not exists sofascore_squad_current_team_slug_idx
  on football.sofascore_squad_current (team_slug);

grant select on football.sofascore_squad_current to anon, authenticated, service_role;

-- Sentetik oyuncunun cozulen SofaScore kimligi (koprunun kalici sonucu).
alter table football.squad_synthetic_players
  add column if not exists sofascore_player_id text;
