-- Oyuncu ROL etiketi (İlk 5 / Rotasyon / Sınırlı / Bitiş / Ayrıldı) + pozisyon,
-- Match-Player Tools "Player Dist" panelinde gösterilir. Kural model_config'ten
-- (key/value) okunur → eşikler Config sekmesinden değiştirilebilir.
--
-- ROL KURALI (öncelik sırası):
--   Ayrıldı  : games <= role_early_games_max VE son_hafta <= takım_son_hafta - role_gap_weeks
--              (sezon başı birkaç maç oynayıp kadrodan düşen: transfer/sakatlık)
--   İlk 5    : ort_dakika >= role_starter_min VE games >= role_avail_share * takım_maçı
--   Rotasyon : ort_dakika >= role_rotation_min
--   Sınırlı  : ort_dakika >= role_bench_min
--   Bitiş    : diğer (maç sonu 3-4 dk giren)

-- ============================================================
-- 1) Eşikler → model_config (varsa dokunma; yoksa varsayılan ekle)
-- ============================================================
insert into basketball.model_config (key, value, note) values
  ('role_starter_min',    22,  'Rol: İlk 5 için min ortalama dakika'),
  ('role_rotation_min',   14,  'Rol: Rotasyon için min ortalama dakika'),
  ('role_bench_min',       8,  'Rol: Sınırlı için min ortalama dakika (altı = Bitiş)'),
  ('role_avail_share',   0.5,  'Rol: İlk 5 için oynanan maç / takım maçı oranı'),
  ('role_early_games_max', 6,  'Rol: Ayrıldı için maksimum oynanan maç'),
  ('role_gap_weeks',       5,  'Rol: Ayrıldı için son hafta ile takım son haftası farkı')
on conflict (key) do nothing;

-- ============================================================
-- 2) Rol + pozisyon view'ı (sezon x takım x oyuncu)
-- ============================================================
create or replace view analytics.bb_player_role_v1 as
with cfg as (
  select
    coalesce(max(value) filter (where key='role_starter_min'),    22)  as starter_min,
    coalesce(max(value) filter (where key='role_rotation_min'),   14)  as rotation_min,
    coalesce(max(value) filter (where key='role_bench_min'),       8)  as bench_min,
    coalesce(max(value) filter (where key='role_avail_share'),   0.5)  as avail_share,
    coalesce(max(value) filter (where key='role_early_games_max'), 6)  as early_games_max,
    coalesce(max(value) filter (where key='role_gap_weeks'),       5)  as gap_weeks
  from basketball.model_config
),
tg as (
  select season_label, team_slug, count(*) as team_games, max(week) as team_last_week
  from basketball.team_match_stats group by season_label, team_slug
),
pp as (
  select season_label, team_slug, player_slug,
         max(player_name)                    as player_name,
         count(*)                            as games,
         round(avg(coalesce(minutes,0)), 1)  as avg_minutes,
         min(week)                           as first_week,
         max(week)                           as last_week
  from basketball.player_match_stats
  group by season_label, team_slug, player_slug
)
select
  pp.season_label, pp.team_slug, pp.player_slug, pp.player_name,
  pl.position,
  pp.games, pp.avg_minutes, pp.first_week, pp.last_week,
  tg.team_games, tg.team_last_week,
  exists (select 1 from euroleague.team_bsl_link tl where tl.bsl_team_slug = pp.team_slug) as euro_team,
  case
    when pp.games <= cfg.early_games_max and pp.last_week <= tg.team_last_week - cfg.gap_weeks then 'departed'
    when pp.avg_minutes >= cfg.starter_min and pp.games >= cfg.avail_share * tg.team_games   then 'starter'
    when pp.avg_minutes >= cfg.rotation_min then 'rotation'
    when pp.avg_minutes >= cfg.bench_min    then 'limited'
    else 'garbage'
  end as role
from pp
join tg on tg.season_label = pp.season_label and tg.team_slug = pp.team_slug
cross join cfg
left join basketball.players pl on pl.player_slug = pp.player_slug;

grant select on analytics.bb_player_role_v1 to anon, authenticated;

-- ============================================================
-- 3) model_config düzenlenebilir view (Config sekmesi: rol eşikleri)
--    Basit tek-tablo view → auto-updatable. anon/authenticated UPDATE alır.
-- ============================================================
create or replace view analytics.bb_model_config as
select key, value, note from basketball.model_config;

grant select, update on analytics.bb_model_config to anon, authenticated;
