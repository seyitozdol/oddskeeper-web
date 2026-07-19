create schema if not exists football;

create table if not exists football.match_team_stats (
    id bigserial primary key,
    source text not null,
    source_match_id text not null,
    source_team_id text not null,
    team_name text not null,
    team_side text not null,
    opponent_team_source_id text,
    opponent_team_name text,
    competition text,
    match_datetime timestamptz,
    match_date_text text,
    score_for integer,
    score_against integer,
    result_code text,
    summary_goals integer,
    summary_assists integer,
    summary_red_cards integer,
    summary_yellow_cards integer,
    summary_corners_won integer,
    summary_shots integer,
    summary_shots_on_target integer,
    summary_blocked_shots integer,
    summary_passes integer,
    summary_crosses integer,
    summary_tackles integer,
    summary_offsides integer,
    summary_fouls_conceded integer,
    summary_fouls_won integer,
    summary_saves integer,
    details_accurate_pass integer,
    details_hit_woodwork integer,
    details_attempts_ibox integer,
    details_attempts_obox integer,
    details_headed_shots integer,
    details_expected_goals numeric,
    details_goal_kicks integer,
    details_total_throws integer,
    details_out_of_box_goals integer,
    details_right_foot_goals integer,
    details_left_foot_goals integer,
    details_headed_goals integer,
    details_penalty_goals integer,
    details_freekick_goals integer,
    details_fantasy_assist integer,
    opta_player_count integer,
    opta_starter_count integer,
    opta_substitute_count integer,
    opta_points_total numeric,
    opta_minutes_total integer,
    opta_goals_total integer,
    opta_shots_on_target_total integer,
    opta_shots_off_target_total integer,
    opta_shots_blocked_total integer,
    opta_own_goals_total integer,
    opta_assists_total integer,
    opta_passes_total numeric,
    opta_crosses_total numeric,
    opta_tackles_total integer,
    opta_interceptions_total integer,
    opta_fouls_won_total integer,
    opta_fouls_conceded_total integer,
    opta_offsides_total integer,
    opta_cards_yellow_total integer,
    opta_cards_red_total integer,
    opta_goals_conceded_total integer,
    opta_penalties_won_total integer,
    opta_saves_total integer,
    opta_penalties_saved_total integer,
    raw_summary_totals jsonb,
    raw_details_totals jsonb,
    raw_opta_totals jsonb,
    payload_last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_match_team_stats_key
    on football.match_team_stats (source, source_match_id, source_team_id);

create index if not exists ix_match_team_stats_match
    on football.match_team_stats (source_match_id);

create index if not exists ix_match_team_stats_team
    on football.match_team_stats (source_team_id);

grant usage on schema football to service_role;
grant select, insert, update, delete on all tables in schema football to service_role;
grant usage, select on all sequences in schema football to service_role;

alter default privileges in schema football
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema football
grant usage, select on sequences to service_role;
