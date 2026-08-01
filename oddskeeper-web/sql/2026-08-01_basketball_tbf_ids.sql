-- Basketbol TBF (tbf.org.tr) canlı feed için STABİL KİMLİK kolonları.
-- TBF JSON API her oyuncu/takım/maç için numerik id verir (playerId/teamId/matchId).
-- Kimlik id ÜZERİNDEN kurulur → isim varyasyonundan doğan mükerrer-oyuncu sorunu
-- ([[basketball-model]] elle-birleştirme) KAYNAKTA çözülür, fuzzy-match GEREKMEZ.
-- Additive/güvenli: kolonlar nullable, mevcut Excel v38 verisi etkilenmez.

alter table basketball.players
  add column if not exists tbf_player_id bigint;
create unique index if not exists uq_bb_players_tbf on basketball.players(tbf_player_id)
  where tbf_player_id is not null;

alter table basketball.teams
  add column if not exists tbf_team_id bigint,
  add column if not exists logo_url text;
create unique index if not exists uq_bb_teams_tbf on basketball.teams(tbf_team_id)
  where tbf_team_id is not null;

alter table basketball.player_match_stats
  add column if not exists tbf_player_id bigint,
  add column if not exists tbf_match_id  bigint;
-- API kaynağı için mükerrersizlik: bir maçta bir oyuncu tek satır (id bazlı upsert)
create unique index if not exists uq_bb_pms_tbf on basketball.player_match_stats(tbf_match_id, tbf_player_id)
  where tbf_match_id is not null and tbf_player_id is not null;

alter table basketball.team_match_stats
  add column if not exists tbf_team_id  bigint,
  add column if not exists tbf_match_id bigint;
create unique index if not exists uq_bb_tms_tbf on basketball.team_match_stats(tbf_match_id, tbf_team_id)
  where tbf_match_id is not null and tbf_team_id is not null;
