-- Voleybol mac sonuclari (skor + setler). Kaynak: en-live.volleyballworld.com JSON
-- feed (/api/v1/live/matches/bytournaments/{tids}/{date}/{date}) + takvim
-- (/api/v1/volley-tournament/matchdays/{year}/{utcOffset}/{tids}).
-- Takim kimligi feed'in noTeamA/noTeamB (edition id) -> volleyball.teams.edition_team_id.

create table if not exists volleyball.matches (
    competition_id int  not null references volleyball.competitions(id) on delete cascade,
    match_no       int  not null,              -- feed 'no' (kalici mac id)
    match_date     date,
    home_team_id   int,                          -- feed noTeamA (edition id)
    away_team_id   int,                          -- feed noTeamB
    home_code      text,                         -- volleyball.teams'ten cozulen 3-harf
    away_code      text,
    home_sets      int,                          -- kazanilan set (0-3)
    away_sets      int,
    set_scores     jsonb,                        -- [{a,b}, ...] gercek setler (padding haric)
    status         text,                         -- statusLabel (Results/Live/Scheduled)
    updated_at     timestamptz default now(),
    primary key (competition_id, match_no)
);

create index if not exists idx_vb_matches_comp_date
  on volleyball.matches(competition_id, match_date);

grant select on volleyball.matches to anon, authenticated;
grant all on volleyball.matches to service_role;
