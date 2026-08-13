-- Mackolik uygulama API'sinden cekilen kupa (Turkiye Kupasi) maclari + takim istatistikleri.
-- Izole tablolar: mevcut football.matches / match_team_stats (Opta) tablolarina DOKUNMAZ,
-- boylece SL analytics view'lari etkilenmez. Kaynak: api.mackolikfeeds.com/api/match (Perform LiveScores).

create table if not exists football.mackolik_matches (
    match_uuid          text        primary key,
    source              text        not null default 'mackolik_app',
    competition_uuid    text        not null,
    competition_name    text,
    season_id           integer     not null,
    season_name         text,
    match_numeric_id    bigint,
    rb_id               bigint,
    round_id            integer,
    round_name          text,
    match_datetime      timestamptz,
    status              text,
    team_a_id           integer,
    team_a_uuid         text,
    team_a_name         text,
    team_b_id           integer,
    team_b_uuid         text,
    team_b_name         text,
    score_a             integer,
    score_b             integer,
    ht_score_a          integer,
    ht_score_b          integer,
    round_winner_id     integer,
    raw                 jsonb,          -- tam /api/match cevabi (oyuncu stat, shot_map, momentum, lineup, events buradan cikarilabilir)
    created_at          timestamptz     not null default now(),
    updated_at          timestamptz     not null default now()
);
create index if not exists mackolik_matches_season_idx      on football.mackolik_matches (season_id);
create index if not exists mackolik_matches_competition_idx on football.mackolik_matches (competition_uuid);
create index if not exists mackolik_matches_datetime_idx    on football.mackolik_matches (match_datetime);

-- Takim mac istatistikleri (stat_team ile birebir; A/B tek satirda).
create table if not exists football.mackolik_team_stats (
    match_uuid          text        not null references football.mackolik_matches(match_uuid) on delete cascade,
    stat_type           text        not null,   -- possession, shots, throw_in, fouls, expected_goals ...
    value_a             numeric,
    value_b             numeric,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    primary key (match_uuid, stat_type)
);
create index if not exists mackolik_team_stats_match_idx on football.mackolik_team_stats (match_uuid);
