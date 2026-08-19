-- 2026-08-19: tff1_squad_v1 sezon literalinden kurtuldu (soru 9 devami, sahip karari)
--
-- KARAR: "guncel kadro + gecen sezon istatistigi" kurali KALDIRILDI; kadro
-- istatistik kolonlari HER ZAMAN icinde bulunulan sezondan gelir
-- (ref.current_season_label(), sinir 24 Haziran). Sahibin gerekce sorusu:
-- "yeni sezon verisi baslayinca maclar gelsin nolcak" -> yaz boyunca istatistik
-- kolonlari bos gorunur, maclar oynandikca dolar; bu bilinçli tercih.
--
-- Davranis degisikligi (bugun): istatistikler 25/26 yerine 26/27'den gelir;
-- TM kadrosunda olup bu sezon hic oynamayanlarin kolonlari bos. roster_fallback
-- uyeligi de artik BU sezon maca cikanlardan turer (daha guncel).
-- Frontend tff1_squad_mat uzerinden okur; bu migration sonrasi mat bir kez
-- elle tazelenir (pipeline zaten her FlashScore turunda tazeliyor).

begin;

create or replace view analytics.tff1_squad_v1 as
 with season_stats as (
         select distinct on (s.player_id) s.season_label,
            s.player_id,
            s.player_name,
            s.team_id,
            s.team_name,
            s.position_code,
            s.appearances,
            s.starts,
            s.minutes,
            s.last_match_datetime,
            s.goals,
            s.assists,
            s.shots,
            s.shots_on_target,
            s.total_passes,
            s.accurate_passes,
            s.key_passes,
            s.crosses,
            s.tackles,
            s.interceptions,
            s.clearances,
            s.blocks,
            s.ball_recoveries,
            s.duels_won,
            s.aerials_won,
            s.fouls,
            s.was_fouled,
            s.offsides,
            s.dribbles_won,
            s.touches,
            s.saves
           from analytics.tff1_pm_player_season_v1 s
          where s.season_label = ref.current_season_label()
          order by s.player_id
        ), tm_squad as (
         select cm.sofascore_team_id as team_id,
            cm.team_name,
            mv_1.sofascore_player_id as player_id,
            'tm'::text as membership_source
           from football.tff1_player_market_values mv_1
             join ref.tff1_club_map cm on cm.tm_club = mv_1.tm_club
        ), roster_fallback as (
         select s.team_id,
            s.team_name,
            s.player_id,
            'roster'::text as membership_source
           from season_stats s
             join ref.tff1_club_map cm on cm.sofascore_team_id = s.team_id
          where not (s.player_id in ( select tff1_player_market_values.sofascore_player_id
                   from football.tff1_player_market_values))
        ), membership as (
         select tm_squad.team_id, tm_squad.team_name, tm_squad.player_id, tm_squad.membership_source
           from tm_squad
        union all
         select roster_fallback.team_id, roster_fallback.team_name, roster_fallback.player_id, roster_fallback.membership_source
           from roster_fallback
        )
 select mb.team_id,
    mb.team_name,
    mb.player_id,
    coalesce(i.player_name, ss.player_name, mv.tm_player_name) as player_name,
    coalesce(i."position", ss.position_code) as "position",
    i.photo_url,
    i.birth_date,
    i.country,
    mv.market_value_eur,
    mb.membership_source,
    ss.appearances,
    ss.starts,
    ss.minutes,
        case
            when ss.appearances > 0 then round(100.0 * ss.starts::numeric / ss.appearances::numeric, 1)
            else null::numeric
        end as starter_rate_pct,
    ss.last_match_datetime
   from membership mb
     left join football.sofascore_player_info i on i.sofascore_player_id = mb.player_id
     left join football.tff1_player_market_values mv on mv.sofascore_player_id = mb.player_id
     left join season_stats ss on ss.player_id = mb.player_id;

commit;

refresh materialized view analytics.tff1_squad_mat;

notify pgrst, 'reload schema';
