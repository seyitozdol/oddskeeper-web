-- 2026-08-18: Tek-profil Faz 4 — takim sonuc view'larinda kaynak-dedup.
--
-- SORUN: team_results_v1 / team_recent_form_v1, ref.team_mapping'in AYNI slug'a
-- bagli COKLU kaynak satirlari (opta + apifootball + sofascore source_team_id'leri)
-- uzerinden football.matches'e katildigi icin ayni gercek mac IKI KEZ listeleniyordu
-- (or. Galatasaray 25/26 Super Lig: 34 opta + 34 sofascore satiri). Kupa maclari
-- (sofascore) da bu view'a zaten dusuyordu ama mukerrer SL satirlariyla karisikti.
--
-- COZUM: (team_slug, season_label, competition) basina EN IYI kaynak secilir:
-- opta > apifootball > sofascore. Boylece:
--   - Super Lig 25/26 = yalniz opta satirlari (eski davranisla ayni icerik, tek kopya)
--   - Super Lig 24/25 ve oncesi = yalniz apifootball
--   - Super Lig 26/27 (opta yok) = sofascore
--   - Avrupa kupalari = sofascore (tek kaynak) — dual takimlarin (GS/FB/BJK/...)
--     kupa maclari TEK football takim profilinin sonuc listesinde competition
--     etiketiyle gorunur (tek-profil ilkesi).
-- Kolon kumesi/sirasi DEGISMEDI (create or replace).

create or replace view analytics.team_results_v1 as
with base as (
    select tm.team_slug,
        tm.source_team_id as team_source_id,
        tm.display_name as team_name,
        m.source_match_id,
        m.competition,
        m.match_datetime,
        case when m.home_team_source_id = tm.source_team_id then true else false end as is_home,
        case when m.away_team_source_id = tm.source_team_id then true else false end as is_away,
        case when m.home_team_source_id = tm.source_team_id then m.away_team_name
             else m.home_team_name end as opponent_name,
        case when m.home_team_source_id = tm.source_team_id then m.away_team_source_id
             else m.home_team_source_id end as opponent_source_team_id,
        case when m.home_team_source_id = tm.source_team_id then m.home_score
             else m.away_score end as team_score,
        case when m.home_team_source_id = tm.source_team_id then m.away_score
             else m.home_score end as opponent_score,
        case when m.home_score is null or m.away_score is null then null::text
             when m.home_team_source_id = tm.source_team_id then concat(m.home_score, '-', m.away_score)
             else concat(m.away_score, '-', m.home_score) end as score_display,
        case when m.home_score is null or m.away_score is null then null::text
             when m.winner_team_source_id = tm.source_team_id then 'W'::text
             when m.winner_team_source_id is null then 'D'::text
             else 'L'::text end as result_code,
        case when m.home_score is null or m.away_score is null then null::integer
             when m.winner_team_source_id = tm.source_team_id then 3
             when m.winner_team_source_id is null then 1
             else 0 end as result_points,
        m.venue,
        case when m.home_team_source_id = tm.source_team_id then away_map.team_slug
             else home_map.team_slug end as opponent_team_slug,
        m.season_label,
        case m.source when 'opta' then 0 when 'apifootball' then 1
                      when 'sofascore' then 2 else 3 end as src_rank
    from ref.team_mapping tm
    join football.matches m
      on m.home_team_source_id = tm.source_team_id or m.away_team_source_id = tm.source_team_id
    left join ref.team_mapping home_map
      on home_map.source_team_id = m.home_team_source_id and home_map.is_active = true
    left join ref.team_mapping away_map
      on away_map.source_team_id = m.away_team_source_id and away_map.is_active = true
    where tm.source_team_id is not null and tm.is_active = true
), best as (
    select team_slug, season_label, competition, min(src_rank) as src_rank
    from base
    group by team_slug, season_label, competition
)
select b.team_slug,
    b.team_source_id,
    b.team_name,
    b.source_match_id,
    b.competition,
    b.match_datetime,
    b.is_home,
    b.is_away,
    b.opponent_name,
    b.opponent_source_team_id,
    b.team_score,
    b.opponent_score,
    b.score_display,
    b.result_code,
    b.result_points,
    b.venue,
    b.opponent_team_slug,
    b.season_label
from base b
join best bs
  on bs.team_slug = b.team_slug
 and bs.season_label is not distinct from b.season_label
 and bs.competition is not distinct from b.competition
 and bs.src_rank = b.src_rank;

-- Ayni dedup team_recent_form_v1'de (son 5 mac formu; rekabet-bazli partition zaten vardi).
create or replace view analytics.team_recent_form_v1 as
with team_match_base as (
    select tm.team_slug,
        tm.source_team_id as team_source_id,
        tm.display_name as team_name,
        m.competition,
        m.season_label,
        m.source_match_id,
        m.match_datetime,
        case when m.home_team_source_id = tm.source_team_id then true else false end as is_home,
        case when m.home_team_source_id = tm.source_team_id then m.away_team_name
             else m.home_team_name end as opponent_name,
        case when m.home_team_source_id = tm.source_team_id then m.home_score
             else m.away_score end as team_score,
        case when m.home_team_source_id = tm.source_team_id then m.away_score
             else m.home_score end as opponent_score,
        case when m.home_score is null or m.away_score is null then null::text
             when m.home_team_source_id = tm.source_team_id then concat(m.home_score, '-', m.away_score)
             else concat(m.away_score, '-', m.home_score) end as score_display,
        case when m.home_score is null or m.away_score is null then null::text
             when m.winner_team_source_id = tm.source_team_id then 'W'::text
             when m.winner_team_source_id is null then 'D'::text
             else 'L'::text end as result_code,
        case when m.home_score is null or m.away_score is null then null::integer
             when m.winner_team_source_id = tm.source_team_id then 3
             when m.winner_team_source_id is null then 1
             else 0 end as result_points,
        case m.source when 'opta' then 0 when 'apifootball' then 1
                      when 'sofascore' then 2 else 3 end as src_rank
    from ref.team_mapping tm
    join football.matches m
      on m.home_team_source_id = tm.source_team_id or m.away_team_source_id = tm.source_team_id
    where tm.is_active = true and tm.source_team_id is not null
      and m.season_label is not null and m.home_score is not null and m.away_score is not null
), best as (
    select team_slug, season_label, competition, min(src_rank) as src_rank
    from team_match_base
    group by team_slug, season_label, competition
), deduped as (
    select b.*
    from team_match_base b
    join best bs
      on bs.team_slug = b.team_slug
     and bs.season_label = b.season_label
     and bs.competition is not distinct from b.competition
     and bs.src_rank = b.src_rank
), ranked as (
    select deduped.team_slug,
        deduped.team_source_id,
        deduped.team_name,
        deduped.competition,
        deduped.season_label,
        deduped.source_match_id,
        deduped.match_datetime,
        deduped.is_home,
        deduped.opponent_name,
        deduped.team_score,
        deduped.opponent_score,
        deduped.score_display,
        deduped.result_code,
        deduped.result_points,
        row_number() over (partition by deduped.team_slug, deduped.competition, deduped.season_label
                           order by deduped.match_datetime desc, deduped.source_match_id desc) as recent_rank
    from deduped
)
select team_slug,
    team_source_id,
    team_name,
    competition,
    season_label,
    recent_rank,
    source_match_id,
    match_datetime,
    is_home,
    opponent_name,
    team_score,
    opponent_score,
    score_display,
    result_code,
    result_points
from ranked
where recent_rank <= 5;
