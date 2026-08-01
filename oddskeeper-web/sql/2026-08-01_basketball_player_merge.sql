-- Basketbol oyuncu birleştirme (mükerrer isim → tek kanonik oyuncu).
-- Aynı oyuncu maç verisinde iki farklı yazımla (dolayısıyla iki player_slug'la)
-- göründüğünde ("Vincent Poirier" vs "Vincent Yann Poirier"), bu tablo alias
-- slug'ı kanonik slug'a haritalar. Temel view bb_player_game_enriched_v1 slug/isim
-- alanlarını kanonik değerle değiştirir → TÜM türev view'lar (windows, share, season
-- stats, leaderboard, profil) otomatik tekleşir. Frontend Oyuncu Listesi'nden yazılır.

-- ============================================================
-- Birleştirme tablosu (frontend-writable; bb_pm_* kalıbı: RLS + permissive policy)
-- ============================================================
create table if not exists analytics.bb_pm_player_merges (
  league          text not null default 'basketball',
  alias_slug      text not null,              -- tekleşecek (kaybolacak) slug
  canonical_slug  text not null,              -- kalıcı (kanonik) slug
  canonical_name  text,                       -- kanonik görünen isim
  updated_at      timestamptz not null default now(),
  primary key (league, alias_slug),
  constraint bb_pm_player_merges_not_self check (alias_slug <> canonical_slug)
);

alter table analytics.bb_pm_player_merges enable row level security;
drop policy if exists bb_pm_player_merges_all on analytics.bb_pm_player_merges;
create policy bb_pm_player_merges_all on analytics.bb_pm_player_merges
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on analytics.bb_pm_player_merges to anon, authenticated;

-- ============================================================
-- Temel view'ı kanonikleştir (additive: tablo boşken hiçbir şey değişmez).
-- Kolon adı/sırası/tipi korunur → create or replace güvenli, türev view'lar bozulmaz.
-- ============================================================
create or replace view analytics.bb_player_game_enriched_v1 as
with tg as (
  select season_label, match_key, match_date, team_name,
         home_away, opponent_name, opponent_slug,
         points as team_points, opp_points as team_opp_points,
         (coalesce(fg2a,0)+coalesce(fg3a,0))                                         as team_fga,
         coalesce(fta,0)                                                             as team_fta,
         coalesce(turnovers,0)                                                       as team_tov,
         ((coalesce(fg2a,0)+coalesce(fg3a,0)) - coalesce(oreb,0)
            + coalesce(turnovers,0) + 0.44*coalesce(fta,0))                          as team_poss
  from basketball.team_match_stats
),
tgm as (
  select season_label, match_key, match_date, team_name, sum(coalesce(minutes,0)) as team_minutes
  from basketball.player_match_stats
  group by 1,2,3,4
)
select
  p.id, p.source, p.season_label, p.competition, p.match_key, p.match_date, p.week,
  coalesce(mrg.canonical_slug, p.player_slug) as player_slug,
  coalesce(mrg.canonical_name, p.player_name) as player_name,
  p.team_slug, p.team_name, p.jersey_no,
  p.seconds_played, p.minutes, p.points,
  p.fg2m, p.fg2a, p.fg2_pct, p.fg3m, p.fg3a, p.fg3_pct, p.ftm, p.fta, p.ft_pct,
  p.oreb, p.dreb, p.treb, p.assists, p.turnovers, p.steals, p.blocks, p.blocks_against,
  p.fouls_drawn, p.fouls_committed,
  (coalesce(p.fg2m,0)+coalesce(p.fg3m,0)) as fgm,
  (coalesce(p.fg2a,0)+coalesce(p.fg3a,0)) as fga,
  tg.home_away, tg.opponent_name, tg.opponent_slug,
  tg.team_points, tg.team_opp_points, tg.team_fga, tg.team_fta, tg.team_tov, tg.team_poss,
  tgm.team_minutes
from basketball.player_match_stats p
left join analytics.bb_pm_player_merges mrg
       on mrg.league = 'basketball' and mrg.alias_slug = p.player_slug
left join tg  on tg.season_label=p.season_label and tg.match_key=p.match_key and tg.match_date=p.match_date and tg.team_name=p.team_name
left join tgm on tgm.season_label=p.season_label and tgm.match_key=p.match_key and tgm.match_date=p.match_date and tgm.team_name=p.team_name;
