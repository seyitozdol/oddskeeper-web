-- Faz 5: kupa oyuncu-basi mac istatistigi (Mackolik statistics-service).
-- Doldurucu: pipeline/src/football/fetch_mackolik_cup_player_stats.py
-- (match_mid=raw.match.mid, player_mid=lineup player.mid). Erken amator turlar
-- oyuncu-stat icermez (takim-stat kapsamiyla ayni); gec turlar tam.

create table if not exists football.mackolik_player_match_stats (
  match_uuid text not null,
  player_id bigint not null,
  player_uuid text,
  player_mid text,
  team_id integer,
  minutes integer,
  goals integer,
  assists integer,
  fetched_at timestamptz not null default now(),
  primary key (match_uuid, player_id)
);

create table if not exists football.mackolik_player_match_metrics (
  match_uuid text not null,
  player_id bigint not null,
  metric_key text not null,   -- shots_total, accurate_pass, xg, tackles, ...
  value numeric,
  primary key (match_uuid, player_id, metric_key)
);
create index if not exists mpmm_player_idx on football.mackolik_player_match_metrics (player_id, metric_key);
