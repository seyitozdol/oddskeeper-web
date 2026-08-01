-- Hub Fixtures/Results sekmeleri icin mac-seviyesinde (bir satir = bir mac) view'lar.
-- EL/EC: euroleague.games (oynanmis + program). BSL: team_match_stats (ev perspektifi).
-- Results = played, tarih desc (son mac ustte: final -> playoff -> regular season).
-- Fixtures = played=false, tarih asc (en yakin mac ustte).

-- ============================================================
-- EuroLeague / EuroCup mac listesi (played + program)
-- ============================================================
create or replace view analytics.el_games_v1 as
select
  g.competition,
  case g.competition when 'E' then 'EuroLeague' when 'U' then 'EuroCup' else g.competition end as competition_name,
  g.season_code, g.season_label, g.game_code, g.round,
  g.phase_code, g.phase_name, g.game_date, g.played,
  -- faz siralamasi (tarih esitliginde playoff/final ustte kalsin)
  case g.phase_code
    when 'RS' then 0 when 'PI' then 1 when '8F' then 2 when 'PO' then 3
    when '4F' then 4 when '2F' then 5 when 'FF' then 6 when 'Final' then 7 else 0 end as phase_order,
  g.home_team_code,
  coalesce(hbt.team_name, g.home_team_name) as home_team_name,
  ht.crest_url as home_crest, hlnk.bsl_team_slug as home_bsl_slug,
  g.away_team_code,
  coalesce(abt.team_name, g.away_team_name) as away_team_name,
  at.crest_url as away_crest, albk.bsl_team_slug as away_bsl_slug,
  g.home_score, g.away_score
from euroleague.games g
left join euroleague.teams ht on ht.competition=g.competition and ht.season_code=g.season_code and ht.team_code=g.home_team_code
left join euroleague.teams at on at.competition=g.competition and at.season_code=g.season_code and at.team_code=g.away_team_code
left join euroleague.team_bsl_link hlnk on hlnk.team_code=g.home_team_code
left join euroleague.team_bsl_link albk on albk.team_code=g.away_team_code
left join basketball.teams hbt on hbt.team_slug=hlnk.bsl_team_slug
left join basketball.teams abt on abt.team_slug=albk.bsl_team_slug;

-- ============================================================
-- BSL mac listesi (mac-seviyesi: ev perspektifi = bir satir/mac)
-- BSL'de tek faz (playoff isareti yok); tur = week. Tumu oynanmis.
-- ============================================================
create or replace view analytics.bb_games_v1 as
select
  season_label, competition, match_key, match_date, week,
  team_slug     as home_team_slug, team_name     as home_team_name,
  opponent_slug as away_team_slug, opponent_name as away_team_name,
  points        as home_score,     opp_points    as away_score
from basketball.team_match_stats
where home_away = 'Home';

grant select on analytics.el_games_v1, analytics.bb_games_v1 to anon, authenticated;
