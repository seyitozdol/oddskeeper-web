-- 2026-08-19: sezon devri mekanizmasi (mimari inceleme soru 9, sahip karari)
--
-- KARAR: sezon geciyi ELLE degil TAKVIMLE. Sinir: 24 HAZIRAN. Dayanak (DB'deki
-- son 2 sezon olculdu): eski sezonun en gec biten maci CL finali (2026-05-30,
-- 2025-06-01 SL playoff); yeni sezonun ilk maci CL/Konf on elemeleri (2026-07-07,
-- 2025-07-08). 1 Haziran - 6 Temmuz arasi bos; 24 Haziran iki yonde de pay birakir
-- (finallere ~25 gun, elemelere ~13 gun).
--
-- Iki ayri duzeltme sinifi:
--   1) msm_fixtures_tff1_v1 gibi "GUNCEL sezon" isteyen view'lar
--      ref.current_season_label() fonksiyonuna baglanir (yillik elle is biter).
--   2) PSM koprü view'lari aslinda "guncel sezon" degil "OPTA SONRASI CAG" demek
--      istiyordu (Opta job'i 2026-07-19'da durdu; 2026/2027 ve SONRASI tum
--      sezonlar SofaScore koprusunden okunmali). Literal '=' yerine cag siniri
--      '>=' kullanilir ve season_label kaynaktan tasinir: sezon devri isi kalkar
--      VE gelecekte 26/27 "gecmis sezon" olunca PSM tarihsel verisi kopmaz.
--
-- KAPSAM DISI (ayri detayli inceleme, sahip istegi): tff1_squad_v1 ve TSL'deki
-- "guncel kadro + gecen sezon istatistigi" kurali; o gecis veri-esigi/urun karari.
-- Frontend ikizi ayni commit'te: lib/season.ts siniri 24 Haziran'a cekildi,
-- PSM_BRIDGED_SEASONS seti yerine cag karsilastirmasi (s >= '2026/2027').

begin;

-- Takvime gore icinde bulunulan sezon etiketi. 24 Haziran'dan itibaren yeni sezon.
-- Ornek: 2026-06-23 -> '2025/2026', 2026-06-24 -> '2026/2027', 2027-01-05 -> '2026/2027'.
create or replace function ref.current_season_label(p_date date default current_date)
returns text
language sql
stable
as $$
  select case
    when p_date >= make_date(extract(year from p_date)::int, 6, 24)
      then extract(year from p_date)::int::text || '/' || (extract(year from p_date)::int + 1)::text
    else (extract(year from p_date)::int - 1)::text || '/' || extract(year from p_date)::int::text
  end
$$;

comment on function ref.current_season_label(date) is
  'Takvim sezonu; sinir 24 Haziran (sahip karari 2026-08-19; finaller ~30 Mayis biter, on elemeler ~7 Temmuz baslar). Frontend esi: lib/season.ts currentSeasonLabel().';

-- 1) TFF1 MSM fikstur listesi: guncel sezona fonksiyonla baglan
create or replace view analytics.msm_fixtures_tff1_v1 as
 with team_map(team_id, slug) as (
         values ('3056'::text,'antalyaspor'::text), ('44320'::text,'bandirmaspor'::text), ('3099'::text,'batmanspor'::text), ('202390'::text,'bodrum'::text), ('6414'::text,'boluspor'::text), ('3055'::text,'bursaspor'::text), ('262480'::text,'esenler-erokspor'::text), ('4954'::text,'karagumruk'::text), ('388264'::text,'igdir-fk'::text), ('3066'::text,'istanbulspor'::text), ('3072'::text,'kayserispor'::text), ('6366'::text,'keciorengucu'::text), ('202391'::text,'manisa-fk'::text), ('296730'::text,'mardinspor'::text), ('7034'::text,'muglaspor'::text), ('7032'::text,'pendikspor'::text), ('4952'::text,'sariyer'::text), ('3076'::text,'sivasspor'::text), ('55625'::text,'umraniyespor'::text), ('24750'::text,'vanspor-fk'::text)
        )
 select f.fixture_id,
    f.round_number,
    '1. Lig'::text as competition,
    f.season_label,
    hm.slug as home_team_slug,
    am.slug as away_team_slug,
    f.home_team_name,
    f.away_team_name,
    f.fixture_datetime
   from analytics.tff1_fixtures_v1 f
     left join team_map hm on hm.team_id = f.home_team_id
     left join team_map am on am.team_id = f.away_team_id
  where f.season_label = ref.current_season_label();

-- 2) PSM koprüleri: guncel-sezon literali -> Opta-sonrasi cag (>= '2026/2027')
create or replace view analytics.psm_id_bridge_v1 as
 select distinct g.player_source_id as player_key,
    g.player_source_id as tslss_id
   from analytics.tsl_ss_player_detailed_metrics_global_mat g
  where g.season_label >= '2026/2027'::text
union
 select distinct 'af-'::text || m.apifootball_player_id as player_key,
    so.opta_player_id as tslss_id
   from ref.apifootball_sofascore_player_map m
     join ref.sofascore_opta_player_map so on so.sofascore_player_id = m.sofascore_player_id;

create or replace view analytics.psm_player_season_avg_bridge_v1 as
 with im as (
         select b.player_key, b.tslss_id from analytics.psm_id_bridge_v1 b
        ), plain as (
         select im.player_key,
            g.season_label,
            g.metric_key,
            g.per_match_value
           from analytics.tsl_ss_player_detailed_metrics_global_mat g
             join im on im.tslss_id = g.player_source_id
          where g.season_label >= '2026/2027'::text and (g.metric_key = any (array['goals_total'::text, 'assists_total'::text, 'expected_goals_total'::text, 'passes_total'::text, 'accurate_pass_total'::text, 'tackles_total'::text, 'fouls_conceded_total'::text, 'fouls_won_total'::text, 'cards_yellow_total'::text, 'cards_red_total'::text, 'offsides_total'::text, 'saves_total_total'::text, 'shots_total'::text, 'shots_on_target_total'::text]))
        ), zones as (
         select im.player_key,
            z.season_label,
            k.metric_key,
            k.val as per_match_value
           from analytics.player_shot_zones_season_v1 z
             join im on im.tslss_id = z.opta_player_id
             cross join lateral ( values ('attempts_ibox_total'::text,z.shots_ibox), ('attempts_obox_total'::text,z.shots_obox), ('shots:sot_ibox'::text,z.sot_ibox), ('shots:sot_obox'::text,z.sot_obox)) k(metric_key, val)
          where z.season_label >= '2026/2027'::text
        ), outcomes as (
         select im.player_key,
            o.season_label,
            k.metric_key,
            k.val as per_match_value
           from analytics.player_shot_outcomes_season_v1 o
             join im on im.tslss_id = o.opta_player_id
             cross join lateral ( values ('log:shots_off_target'::text,o.shots_off_target), ('log:shots_blocked'::text,o.shots_blocked)) k(metric_key, val)
          where o.season_label >= '2026/2027'::text
        )
 select plain.player_key as player_source_id,
    plain.season_label,
    plain.metric_key,
    plain.per_match_value
   from plain
  where plain.per_match_value is not null
union all
 select zones.player_key as player_source_id,
    zones.season_label,
    zones.metric_key,
    zones.per_match_value
   from zones
  where zones.per_match_value is not null
union all
 select outcomes.player_key as player_source_id,
    outcomes.season_label,
    outcomes.metric_key,
    outcomes.per_match_value
   from outcomes
  where outcomes.per_match_value is not null;

create or replace view analytics.psm_player_appearances_bridge_v1 as
 select im.player_key as player_source_id,
    g.season_label,
    g.total_value::integer as appearances
   from analytics.tsl_ss_player_detailed_metrics_global_mat g
     join analytics.psm_id_bridge_v1 im on im.tslss_id = g.player_source_id
  where g.season_label >= '2026/2027'::text and g.metric_key = 'appearances'::text and g.total_value is not null;

commit;

notify pgrst, 'reload schema';
