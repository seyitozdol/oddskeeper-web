-- SofaScore kimlik/bio koprusu (2026-08-15) — profil koprusunun ucuncu parcasi.
-- Bkz. sql/2026-08-15_player_profile_sofascore_bridge.sql ve
--     sql/2026-08-15_player_match_log_sofascore_bridge.sql
--
-- analytics.player_current_info_v1 guncel kadroyu (API-Football) Opta kimligine baglar;
-- Opta karsiligi olmayan oyuncu (sentetik 'ss<sofascore_id>' kimlikli) icinde yok.
-- Sonuc: TSL hub'inda ve profil basliginda bu oyuncularin fotografi, uyrugu ve
-- oyuncu-detay LINKI cikmiyordu (isim duz metin kaliyordu).
--
-- Burada eksik olanlar SofaScore oyuncu bilgisinden (football.sofascore_player_info,
-- foto/dogum/boy/ulke) + kopru profilinden (takim/slug) tamamlanir.

drop view if exists analytics.player_current_info_bridged_v1 cascade;
drop materialized view if exists analytics.player_current_info_bridged_mat cascade;
drop view if exists analytics.player_current_info_bridged_def_v1 cascade;

create view analytics.player_current_info_bridged_def_v1 as
with missing as (
    select p.player_source_id, p.player_slug, p.player_name,
           p.team_slug, p.team_name, p.season_label
    from analytics.player_profile_bridged_mat p
    where not exists (select 1 from analytics.player_current_info_v1 ci
                      where ci.opta_player_id = p.player_source_id)
), latest_match as (
    -- en son macindaki forma numarasi + mevki (SofaScore ham verisi)
    select distinct on (pmap.opta_player_id)
           pmap.opta_player_id                       as player_source_id,
           d.source_player_id                        as sofascore_player_id,
           nullif(d.raw_stats ->> 'jerseyNumber', '')::int as shirt_number,
           upper(nullif(d.position_code, ''))        as position_code
    from football.match_player_stats_details d
    join football.matches m
      on m.source = d.source and m.source_match_id = d.source_match_id
    join ref.sofascore_opta_player_map pmap
      on pmap.sofascore_player_id = d.source_player_id
    where d.source = 'sofascore' and m.competition like 'S%per Lig%'
    order by pmap.opta_player_id, m.match_datetime desc
)
select * from analytics.player_current_info_v1
union all
select
    mi.player_slug,
    mi.player_source_id                              as opta_player_id,
    null::text                                       as apifootball_player_id,
    mi.team_slug                                     as current_team_slug,
    mi.team_name                                     as current_team_name,
    coalesce(spi.player_name, mi.player_name)        as player_name,
    case when spi.birth_date is not null
         then extract(year from age(spi.birth_date))::int end as age,
    lm.shirt_number,
    case lm.position_code
        when 'G' then 'Goalkeeper' when 'D' then 'Defender'
        when 'M' then 'Midfielder' when 'F' then 'Attacker' end as position,
    spi.photo_url,
    spi.updated_at                                   as fetched_at,
    coalesce(spi.player_name, mi.player_name)        as full_name,
    spi.country                                      as nationality,
    spi.height_cm,
    null::int                                        as weight_kg,
    spi.birth_date,
    null::text                                       as birth_place,
    null::text                                       as first_name,
    null::text                                       as last_name
from missing mi
left join latest_match lm on lm.player_source_id = mi.player_source_id
left join football.sofascore_player_info spi on spi.sofascore_player_id = lm.sofascore_player_id;

-- MATERIALIZE: latest_match distinct-on'u her istekte tum SofaScore TSL satirlarini
-- tariyor (~3 sn); TSL hub'i bu view'i sayfa basi bastan sona okudugu icin cok yavas.
-- Tazeleme: pipeline/src/football/refresh_tsl_mats.py (profil mat'indan SONRA).
create materialized view analytics.player_current_info_bridged_mat as
  select * from analytics.player_current_info_bridged_def_v1;
create index player_current_info_bridged_mat_slug_idx
  on analytics.player_current_info_bridged_mat (player_slug);
create index player_current_info_bridged_mat_opta_idx
  on analytics.player_current_info_bridged_mat (opta_player_id);

create view analytics.player_current_info_bridged_v1 as
  select * from analytics.player_current_info_bridged_mat;

grant select on analytics.player_current_info_bridged_def_v1 to anon, authenticated, service_role;
grant select on analytics.player_current_info_bridged_mat    to anon, authenticated, service_role;
grant select on analytics.player_current_info_bridged_v1     to anon, authenticated, service_role;
