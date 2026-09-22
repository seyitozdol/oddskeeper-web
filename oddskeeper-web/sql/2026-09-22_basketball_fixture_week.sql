-- 2026-09-22 (2): Basketbol fiksturlerine HAFTA (futboldaki Round dropdown karsiligi).
-- Kaynak: SofaScore upcoming_events.round_info ('Round N'); kupa finali vb. null.
-- Resolver artik Bets10 orani OLMAYAN yaklasan lig maclarini da yazar (bets10 alanlari
-- null) -> Fixtures sekmesi haftayi tam listeler, id'si olanlarda Bets10 rozeti/doldur.
-- basketball.fixtures (Excel fikstur tablosu) BOS, o yuzden kaynak SofaScore.

alter table tracker.bb_fixture_bets10_link add column if not exists week int;
alter table analytics.bb_pm_fixtures add column if not exists week int;

-- create or replace view kolonu SONA ekler (mevcut kolon sirasi degismez)
create or replace view analytics.bb_fixture_bets10_link_v1 as
select league, event_id, bets10_event_id, home_team_slug, away_team_slug,
       home_team_name, away_team_name, tournament_name, start_ts,
       home_odds, away_odds, hcp_line, hcp_home_odds, hcp_away_odds,
       total_line, total_over_odds, total_under_odds, match_score, updated_at,
       week
from tracker.bb_fixture_bets10_link;

grant select on analytics.bb_fixture_bets10_link_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
