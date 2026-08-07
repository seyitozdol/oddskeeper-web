-- 2026-08-07: SofaScore takim-mac stat scrape'i (GSheet + MSM guncel-sezon feed).
-- Mevcut summary_/details_ kolonlari 10 MSM marketini + skor + kart + woodwork'u
-- karsilar (Goal Kick=details_goal_kicks, Throw-in=details_total_throws).
-- possession / added-time (1./2.Y) / VAR / penalty / own-goal SofaScore'a ozgu ve
-- match_team_stats semasinda kolon yok -> tek jsonb alanda tutulur.
alter table football.match_team_stats
  add column if not exists sofascore_extras jsonb;
