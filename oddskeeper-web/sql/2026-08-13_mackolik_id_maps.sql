-- Mackolik kupa verisindeki takim/oyuncu kimliklerini mevcut (Opta) kimlik
-- uzayimiza baglar. KESIF: Mackolik takim/oyuncu UUID'si = Opta UUID'si
-- (ayni Perform/Opta uzayi), o yuzden eslesme UUID ile birebir yapilir;
-- ayrica Mackolik'in APP-ICI SAYISAL id'si (app endpoint'leri bununla calisir)
-- saklanir. Alt lig/amator takim-oyunculari bizde yok -> team_slug/opta null kalir.

create table if not exists ref.mackolik_team_map (
    mackolik_team_id     integer primary key,
    mackolik_team_uuid   text,
    team_name            text,
    team_slug            text,          -- ref.team_mapping eslesmesi (null = bizde yok)
    canonical_team_name  text,
    updated_at           timestamptz not null default now()
);
create index if not exists mackolik_team_map_slug_idx on ref.mackolik_team_map (team_slug);

create table if not exists ref.mackolik_player_map (
    mackolik_player_id   bigint primary key,   -- app-ici sayisal id
    player_uuid          text,                 -- = Opta player id
    player_name          text,
    mackolik_team_id     integer,
    team_slug            text,                 -- takim map uzerinden (null = bizde yok)
    is_opta_matched      boolean not null default false,  -- uuid Opta veri evreninde var mi
    opta_player_slug     text,                 -- ref.player_mapping'ten (varsa)
    apifootball_player_id text,                -- ref.player_mapping'ten (varsa)
    updated_at           timestamptz not null default now()
);
create index if not exists mackolik_player_map_uuid_idx on ref.mackolik_player_map (player_uuid);
create index if not exists mackolik_player_map_slug_idx on ref.mackolik_player_map (team_slug);
create index if not exists mackolik_player_map_matched_idx on ref.mackolik_player_map (is_opta_matched);
