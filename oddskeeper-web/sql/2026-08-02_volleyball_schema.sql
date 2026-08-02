-- Voleybol veri semasi (izole: football/basketball/euroleague'e GIRMEZ)
-- Kaynak: en.volleyballworld.com (FIVB) - server-render HTML, kalici FIVB oyuncu/takim id'leri.
-- Kimlik kaynak-native FIVB id uzerinden -> fuzzy-match GEREKMEZ, idempotent upsert.
-- Kapsam (bu tur): VNL 2024/2025/2026 (W) + Dunya Sampiyonasi 2025 (W).
-- Olimpiyat 2024 + Avrupa Sampiyonasi 2026 ayri kaynak/adaptor (sonra).

create schema if not exists volleyball;

-- Turnuva basina bir satir (edition)
create table if not exists volleyball.competitions (
    id         serial primary key,
    comp_slug  text not null,               -- volleyball-nations-league | women-world-championship
    year       int  not null,               -- 2024 / 2025 / 2026
    gender     text not null default 'W',    -- W | M
    name       text,                         -- "VNL 2024"
    source     text not null default 'volleyballworld',
    created_at timestamptz default now(),
    unique (comp_slug, year, gender)
);

-- Oyuncu bio (turnuvadan BAGIMSIZ, kalici FIVB id). Turnuvalar arasi tek satir.
create table if not exists volleyball.players (
    fivb_id     int primary key,             -- volleyballworld /players/{id}
    full_name   text,
    short_name  text,                         -- tablodaki kisa ad (Vargas)
    position    text,                         -- Opposite spiker / OH / MB / S / L ...
    birth_date  date,
    height_cm   int,
    nationality text,
    updated_at  timestamptz default now()
);

-- Takim (edition basina; ulke kodu TUR turnuvalar arasi sabit kimlik, numeric id edition'a ozel)
create table if not exists volleyball.teams (
    competition_id  int not null references volleyball.competitions(id) on delete cascade,
    team_code       text not null,           -- TUR / BRA / ITA ...
    team_name       text,                     -- Turkiye
    edition_team_id int,                       -- 8632 (o edition'daki numeric id)
    primary key (competition_id, team_code)
);

-- Kadro: o turnuvada takimda kimler vardi
create table if not exists volleyball.roster (
    competition_id int not null references volleyball.competitions(id) on delete cascade,
    team_code      text not null,
    fivb_id        int  not null references volleyball.players(fivb_id),
    shirt_number   int,
    position       text,
    primary key (competition_id, fivb_id)
);

-- Turnuva-oyuncu TOPLAM istatistikleri: 7 kategori tek satirda (istatistik siralama tablolarindan)
create table if not exists volleyball.player_competition_stats (
    competition_id int not null references volleyball.competitions(id) on delete cascade,
    fivb_id        int not null references volleyball.players(fivb_id),
    team_code      text,
    -- scoring (best-scorers)
    points         int, attack_points int, block_points int, serve_points int, scorer_rank int,
    -- attack (best-attackers): points=basarili hucum, errors, attempts, avg, success%, total
    atk_points int, atk_errors int, atk_attempts int, atk_avg numeric, atk_success numeric, atk_total int, atk_rank int,
    -- block (best-blockers): blocks, errors, rebounds, avg, efficiency%, total
    blk_blocks int, blk_errors int, blk_rebounds int, blk_avg numeric, blk_eff numeric, blk_total int, blk_rank int,
    -- serve (best-servers)
    srv_points int, srv_errors int, srv_attempts int, srv_avg numeric, srv_success numeric, srv_total int, srv_rank int,
    -- set (best-setters): successful, errors, attempts, avg, success%, total
    set_successful int, set_errors int, set_attempts int, set_avg numeric, set_success numeric, set_total int, set_rank int,
    -- dig (best-diggers): digs, errors, receptions, avg, success%, total
    dig_digs int, dig_errors int, dig_receptions int, dig_avg numeric, dig_success numeric, dig_total int, dig_rank int,
    -- reception (best-receivers): successful, errors, attempts, avg, success%, total
    rec_successful int, rec_errors int, rec_attempts int, rec_avg numeric, rec_success numeric, rec_total int, rec_rank int,
    updated_at timestamptz default now(),
    primary key (competition_id, fivb_id)
);

-- Maç-maç oyuncu kırılımı (profil sayfalarından; kategori basina jsonb -> heterojen kolonlar esnek)
create table if not exists volleyball.player_match_stats (
    competition_id int not null references volleyball.competitions(id) on delete cascade,
    fivb_id        int not null references volleyball.players(fivb_id),
    match_date     date,
    home_team      text,   -- Team A (3 harf kod)
    away_team      text,   -- Team B
    category       text not null,  -- scoring | attack | block | serve | reception | dig | set
    data           jsonb,          -- {points, attack_points, ...} kategoriye gore
    primary key (competition_id, fivb_id, match_date, category)
);

-- Grant tuzagi: ileride frontend anon ile okuyacak (bkz. euroleague/basketball paterni)
grant usage on schema volleyball to anon, authenticated, service_role;
grant select on all tables in schema volleyball to anon, authenticated;
grant all on all tables in schema volleyball to service_role;
grant usage, select on all sequences in schema volleyball to service_role;
alter default privileges in schema volleyball grant select on tables to anon, authenticated;
alter default privileges in schema volleyball grant all on tables to service_role;

create index if not exists idx_vb_pcs_comp on volleyball.player_competition_stats(competition_id);
create index if not exists idx_vb_pcs_team on volleyball.player_competition_stats(competition_id, team_code);
create index if not exists idx_vb_pms_player on volleyball.player_match_stats(fivb_id);
create index if not exists idx_vb_roster_team on volleyball.roster(competition_id, team_code);
