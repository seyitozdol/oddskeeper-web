-- Oyuncu-bazli kart olaylari (SofaScore incidents'ten; dakika + oyuncu id + tur).
-- Amac: bir oyuncunun kartini SADECE sahadayken gordugunde saymak. Bench/oyun-
-- disi (henuz girmemis ya da cikmis) kartlar on_pitch=false ile isaretlenir.
-- Kaynak: /event/<id>/incidents (card + substitution + injuryTime). source_player_id
-- SofaScore oyuncu id'si -> ref.sofascore_opta_player_map ile opta id'ye baglanir.
-- Overlay (tsl_ss / tff1) FlashScore ozet sayimi yerine burayi okur.

create table if not exists football.match_player_cards (
    id               bigserial primary key,
    source           text    not null,               -- 'sofascore'
    source_match_id  text    not null,               -- football.matches.source_match_id
    source_team_id   text    not null,               -- macin kendi takim id'si (isHome'dan)
    side             text    not null,               -- 'home' | 'away'
    source_player_id text    not null,               -- card.player.id (string)
    player_name      text,
    card_class       text    not null,               -- 'yellow' | 'red' | 'yellowRed'
    minute           integer,                         -- card.time (temel dakika)
    added_time       integer,                         -- card.addedTime (uzatma)
    reason           text,
    rescinded        boolean not null default false,  -- VAR ile iptal
    on_pitch         boolean,                         -- sahada gorulen kart mi (null=belirsiz)
    payload_last_seen_at timestamptz not null default now(),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

-- Ayni kartin tekrar upsert'inde cakismasin: mac + oyuncu + tur + dakika.
create unique index if not exists uq_match_player_cards_key
    on football.match_player_cards (source, source_match_id, side, source_player_id, card_class, minute);

create index if not exists ix_match_player_cards_match
    on football.match_player_cards (source_match_id);

create index if not exists ix_match_player_cards_player
    on football.match_player_cards (source_player_id);

grant usage on schema football to service_role;
grant select, insert, update, delete on all tables in schema football to service_role;
grant usage, select on all sequences in schema football to service_role;
