-- 2026-09-22: Basketbol Match-Player Tools (BSL / EuroLeague / EuroCup)
--   1) Takim metriklerine FT% (ftpct) satiri: Config seed home/away (total anlamsiz,
--      yuzde toplanmaz). Model degeri frontend'de takim mac logundan (ftm/fta)
--      hesaplanir; EL/EC takim logu ftm/fta vermiyordu -> view'a eklendi.
--   2) Fikstur <-> Bets10 bagi (futboldaki fixture_bets10_link'in basketbol kopyasi).
--      Bets10 basketbolda 1X2 yok: MAC KAZANANI (2 yol) + HANDIKAP (cok cizgi) +
--      (varsa) TOPLAM SAYI. Resolver (link_fixtures_bets10.py, basketbol bolumu)
--      SofaScore event -> bizim takim slug'i (BSL: basketball.teams.sofascore_team_id
--      KESIN; EL/EC: euroleague.teams ad varyantlari + alias sozlugu BULANIK) ve
--      ana cizgiyi (en dengeli oran) yazar. Frontend Fixtures sekmesi "Bets10'dan
--      doldur" ile bb_pm_fixtures'a ekler; manuel ekleme aynen kalir.
--   3) bb_pm_fixtures'a total_line + hcp_line kutulari (1X2 yerine).
-- anon'a hicbir grant YOK (2026-08-19 anon lockdown kurali).

-- ---- 3) manuel fikstur: toplam sayi + handikap kutulari ----
alter table analytics.bb_pm_fixtures
  add column if not exists total_line numeric,
  add column if not exists hcp_line   numeric;   -- ev perspektifi (-6.5 = ev 6.5 verir)

-- ---- 2) Bets10 bagi ----
create table if not exists tracker.bb_fixture_bets10_link (
  league           text not null,          -- 'basketball' | 'euroleague' | 'eurocup'
  event_id         bigint not null,        -- SofaScore event_id (tracker.upcoming_events)
  bets10_event_id  text,                   -- Bets10 fixture id 'f-...'
  home_team_slug   text not null,          -- bizim slug uzayi (BSL slug / EL-EC team_code)
  away_team_slug   text not null,
  home_team_name   text,
  away_team_name   text,
  tournament_name  text,
  start_ts         timestamptz,
  home_odds        numeric,                -- Mac Kazanani (2 yol)
  away_odds        numeric,
  hcp_line         numeric,                -- ana handikap cizgisi, ev perspektifi
  hcp_home_odds    numeric,
  hcp_away_odds    numeric,
  total_line       numeric,                -- ana toplam sayi cizgisi (feed'de varsa)
  total_over_odds  numeric,
  total_under_odds numeric,
  match_score      numeric,                -- takim eslesme guveni (BSL sofa id = 1.0)
  updated_at       timestamptz not null default now(),
  primary key (league, event_id)
);
create index if not exists ix_bb_fixture_bets10_link_league_start
  on tracker.bb_fixture_bets10_link (league, start_ts);

grant select on tracker.bb_fixture_bets10_link to authenticated, service_role;

create or replace view analytics.bb_fixture_bets10_link_v1 as
select league, event_id, bets10_event_id, home_team_slug, away_team_slug,
       home_team_name, away_team_name, tournament_name, start_ts,
       home_odds, away_odds, hcp_line, hcp_home_odds, hcp_away_odds,
       total_line, total_over_odds, total_under_odds, match_score, updated_at
from tracker.bb_fixture_bets10_link;

grant select on analytics.bb_fixture_bets10_link_v1 to authenticated, service_role;

-- ---- 1a) FT% takim config satirlari (3 lig x home/away; template kullanici doldurur) ----
insert into analytics.bb_pm_market_config
  (league, market_group, market_key, label, base_metric, side, template_id, std, sort_order)
select lg.league, 'team', s.side || '_ftpct', s.pfx || ' Serbest %', 'ftpct', s.side, null, 7, 85 + s.ord
from (values ('basketball'), ('euroleague'), ('eurocup')) lg(league)
cross join (values ('home','Ev',1), ('away','Dep',2)) s(side, pfx, ord)
on conflict (league, market_group, market_key) do nothing;

-- ---- 1b) EL/EC takim mac logu: ftm/fta (FT% modeli icin). Kolonlar SONA eklenir ----
create or replace view analytics.el_team_match_log_v1 as
select
  season_label, competition,
  team_code as team_slug, team_name,
  (team_code || ' - ' || opponent_code || ' g' || game_code) as match_key,
  game_date::date                                        as match_date,
  round                                                  as week,
  home_away,
  opponent_code as opponent_slug, opponent_name,
  points, opp_points,
  (points - opp_points)                                  as margin,
  case when points > opp_points then 'W' when points < opp_points then 'L' else 'T' end as result,
  (coalesce(fg2m,0)+coalesce(fg3m,0))                    as fgm,
  (coalesce(fg2a,0)+coalesce(fg3a,0))                    as fga,
  fg3m, fg3a, treb, oreb, dreb, assists, turnovers, steals, blocks,
  ((coalesce(fg2a,0)+coalesce(fg3a,0)) - coalesce(oreb,0) + coalesce(turnovers,0) + 0.44*coalesce(fta,0)) as possessions,
  ftm, fta
from euroleague.team_match_stats;

notify pgrst, 'reload schema';
