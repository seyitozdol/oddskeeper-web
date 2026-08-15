-- SofaScore profil koprusu (2026-08-15)
--
-- Sorun: profil zinciri (team_squad_v1 -> player_profile_def_v1 -> player_profile_mat
-- -> player_profile_v1) TAMAMEN Opta verisine dayali. 2026/27'de Opta verisi yok,
-- dolayisiyla yeni transferlerin ve yukselen takim oyuncularinin profil satiri da yok:
-- leaderboard'da isimleri duz metin, profil sayfalari acilmiyor.
-- (Bu oyuncular 2026-08-15'te sentetik 'ss<sofascore_id>' kimligi aldi; bkz.
--  build_sofascore_opta_player_map.py.)
--
-- Cozum: SofaScore mac verisinden AYNI SEKILDE profil satiri ureten bir view +
-- Opta onculuklu birlesim. Mevcut player_profile_* zinciri DEGISTIRILMEDI (Player
-- Market'in team_current_squad_profile_def_v1'i ve player_match_log_v1 ondan besleniyor);
-- yalnizca yeni view'lar eklendi, frontend'de sadece getPlayerProfile ve
-- getPlayerSlugMap buna bakiyor.
--
-- SIRA: bu dosya once, sonra 2026-08-15_player_match_log_sofascore_bridge.sql,
-- sonra 2026-08-15_player_current_info_sofascore_bridge.sql (ikisi de buna dayali).

drop materialized view if exists analytics.player_profile_bridged_mat cascade;
drop view if exists analytics.player_profile_bridged_def_v1 cascade;
drop view if exists analytics.player_profile_sofascore_v1 cascade;

create view analytics.player_profile_sofascore_v1 as
with base as (
    select
        tm.team_slug,
        tm.source_team_id                              as team_source_id,
        tm.display_name                                as team_name,
        m.competition,
        m.season_label,
        m.match_datetime,
        d.source_match_id,
        pmap.opta_player_id                            as player_source_id,
        d.player_name,
        d.lineup_status,
        upper(nullif(d.position_code, ''))             as position_code,
        coalesce((d.raw_stats ->> 'minutesPlayed')::int, 0)  as minutes_played,
        coalesce((d.raw_stats ->> 'goals')::int, 0)          as goals,
        coalesce((d.raw_stats ->> 'goalAssist')::int, 0)     as assists
    from football.match_player_stats_details d
    join football.matches m
      on m.source = d.source and m.source_match_id = d.source_match_id
    join ref.sofascore_opta_player_map pmap
      on pmap.sofascore_player_id = d.source_player_id
    join ref.team_mapping tm
      on tm.source_team_id = d.source_team_id and tm.is_active = true
    where d.source = 'sofascore'
      and m.competition like 'S%per Lig%'
      and m.season_label is not null
), pos_ranked as (
    -- oyuncunun en cok oynadigi mevki (kaleci > defans > orta saha > forvet onceligi
    -- esitlikte); opta zinciriyle ayni mantik.
    select team_slug, season_label, player_source_id, position_code,
           row_number() over (
             partition by team_slug, season_label, player_source_id
             order by case position_code when 'G' then 1 when 'D' then 2
                                         when 'M' then 3 when 'F' then 4 else 100 end,
                      count(*) desc) as rn
    from base
    where position_code is not null
    group by team_slug, season_label, player_source_id, position_code
), agg as (
    select
        team_slug, team_source_id, team_name, competition, season_label,
        player_source_id,
        (array_agg(player_name order by match_datetime desc))[1] as player_name,
        count(distinct source_match_id) filter (where minutes_played > 0)::int as appearances,
        count(distinct source_match_id) filter (where lineup_status = 'starter')::int as starts,
        count(distinct source_match_id) filter (where lineup_status = 'substitute'
                                                 and minutes_played > 0)::int as sub_appearances,
        sum(minutes_played)::int as total_minutes,
        sum(goals)::int   as goals,
        sum(assists)::int as assists,
        min(match_datetime) as first_match_datetime,
        max(match_datetime) as last_match_datetime
    from base
    group by team_slug, team_source_id, team_name, competition, season_label, player_source_id
)
select
    a.team_slug,
    a.team_source_id,
    a.team_name,
    a.competition,
    a.season_label,
    a.player_source_id,
    a.player_name,
    -- slug bicimi Opta zinciriyle AYNI: '<normalize-ad>--<player_source_id>'
    lower(trim(both '-' from regexp_replace(regexp_replace(
        translate(a.player_name,
                  'ÇĞİÖŞÜçğıöşüÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÑñĆćČčŠšŽžŁłŃń',
                  'CGIOSUcgiosuAAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcCcSsZzLlNn'),
        '[^a-zA-Z0-9]+', '-', 'g'), '-{2,}', '-', 'g'))) || '--' || a.player_source_id
        as player_slug,
    case pr.position_code
        when 'G' then 'GK' when 'D' then 'DF' when 'M' then 'MF' when 'F' then 'FW'
        else 'OTHER' end as primary_position_code,
    case pr.position_code
        when 'G' then 'GOALKEEPER' when 'D' then 'DEFENDER'
        when 'M' then 'MIDFIELDER' when 'F' then 'FORWARD'
        else 'OTHER' end as position_group,
    a.appearances,
    a.starts,
    a.sub_appearances,
    round(a.starts::numeric / nullif(a.appearances, 0)::numeric * 100, 2) as starter_rate_pct,
    a.total_minutes,
    round(a.total_minutes::numeric / nullif(a.appearances, 0)::numeric, 2) as avg_minutes,
    a.goals,
    a.assists,
    a.first_match_datetime,
    a.last_match_datetime
from agg a
left join pos_ranked pr
  on pr.team_slug = a.team_slug and pr.season_label = a.season_label
 and pr.player_source_id = a.player_source_id and pr.rn = 1;

-- Birlesim: oyuncu basina EN GUNCEL sezon satiri kazanir (Opta ya da SofaScore),
-- ama slug ve ad Opta profilinden SABIT kalir (mevcut linkler/bookmark'lar bozulmasin).
-- Opta profili olmayan oyuncuda ikisi de SofaScore'dan gelir.
-- Sezon geciste onemli: Opta 2026/27'yi hic beslemedigi icin, kilitlemezsek Opta
-- gecmisi olan herkes tum sezon boyunca profilinde "2025/2026" gorunurdu.
create view analytics.player_profile_bridged_def_v1 as
with canon as (
    select distinct on (player_source_id)
           player_source_id, player_slug, player_name
    from analytics.player_profile_v1
    where player_source_id is not null and player_slug is not null
    order by player_source_id, last_match_datetime desc nulls last
), cand as (
    select team_slug, team_source_id, team_name, competition, season_label,
           player_source_id, player_name, player_slug, primary_position_code, position_group,
           appearances, starts, sub_appearances, starter_rate_pct, total_minutes, avg_minutes,
           goals, assists, first_match_datetime, last_match_datetime,
           0 as src_rank                       -- esitlikte Opta kazansin
    from analytics.player_profile_v1
    union all
    select team_slug, team_source_id, team_name, competition, season_label,
           player_source_id, player_name, player_slug, primary_position_code, position_group,
           appearances, starts, sub_appearances, starter_rate_pct, total_minutes, avg_minutes,
           goals, assists, first_match_datetime, last_match_datetime,
           1 as src_rank
    from analytics.player_profile_sofascore_v1
), ranked as (
    select c.*, row_number() over (
             partition by c.player_source_id
             order by c.last_match_datetime desc nulls last, c.appearances desc,
                      c.src_rank) as rn
    from cand c
)
select
    r.team_slug, r.team_source_id, r.team_name, r.competition, r.season_label,
    r.player_source_id,
    coalesce(cn.player_name, r.player_name) as player_name,
    coalesce(cn.player_slug, r.player_slug) as player_slug,
    r.primary_position_code, r.position_group,
    r.appearances, r.starts, r.sub_appearances, r.starter_rate_pct,
    r.total_minutes, r.avg_minutes, r.goals, r.assists,
    r.first_match_datetime, r.last_match_datetime
from ranked r
left join canon cn on cn.player_source_id = r.player_source_id
where r.rn = 1;

-- MATERIALIZE: birlesim pencere fonksiyonu + iki buyuk kaynak icerdiginden her
-- istekte hesaplanirsa profil sayfasi statement timeout'a takiliyor (yasandi).
-- Tazeleme: pipeline/src/football/refresh_tsl_mats.py (mac-sonrasi job).
create materialized view analytics.player_profile_bridged_mat as
  select * from analytics.player_profile_bridged_def_v1;
create unique index player_profile_bridged_mat_slug_idx
  on analytics.player_profile_bridged_mat (player_slug);
create index player_profile_bridged_mat_src_idx
  on analytics.player_profile_bridged_mat (player_source_id);

create view analytics.player_profile_bridged_v1 as
  select * from analytics.player_profile_bridged_mat;

-- Grant tuzagi: yeni view'lar varsayilan olarak anon/authenticated'a KAPALI gelir,
-- site (PostgREST) okuyamaz.
grant select on analytics.player_profile_sofascore_v1   to anon, authenticated, service_role;
grant select on analytics.player_profile_bridged_def_v1 to anon, authenticated, service_role;
grant select on analytics.player_profile_bridged_mat    to anon, authenticated, service_role;
grant select on analytics.player_profile_bridged_v1     to anon, authenticated, service_role;
