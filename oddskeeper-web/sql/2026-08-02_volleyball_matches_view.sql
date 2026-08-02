-- vb_matches_v1'i gercek mac sonuclarindan (volleyball.matches: skor+set) okut.
-- Onceki surum player_match_stats'tan sadece tarih+takim turetiyordu; artik skor/set var.

-- kolon yapisi degisti (match_no + skor/set eklendi) -> once DROP.
drop view if exists analytics.vb_matches_v1;
create view analytics.vb_matches_v1 as
select
  m.competition_id,
  m.match_no,
  m.match_date,
  m.home_code,
  m.away_code,
  -- geriye-donuk uyum: eski frontend home_team/away_team okuyordu (yayin regresyonu olmasin)
  m.home_code as home_team,
  m.away_code as away_team,
  th.team_name as home_name,
  ta.team_name as away_name,
  m.home_sets,
  m.away_sets,
  m.set_scores,
  m.status
from volleyball.matches m
left join volleyball.teams th
  on th.competition_id = m.competition_id and th.team_code = m.home_code
left join volleyball.teams ta
  on ta.competition_id = m.competition_id and ta.team_code = m.away_code;

grant select on analytics.vb_matches_v1 to anon, authenticated;
