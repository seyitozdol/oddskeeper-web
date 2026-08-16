-- MAPPING AUDIT fix (oyuncu, 2. pas): apifootball_sofascore_player_map koprusu
-- OLMAYAN (DOB zinciri kurulamayan) kadro oyuncularini, bridged profile'a
-- NORMALIZE-AD-TABANI + AYNI TAKIM ile bagla. Guvenlik: aday TEK olmali (nc=1) ve
-- ne af ne opta zaten player_mapping'te olmali. Ayni takimda ayni normalize adli
-- iki farkli oyuncu neredeyse imkansiz -> guvenli. (Kisaltmali ad-tabani sapan
-- oyuncular DISARIDA kalir; onlar afs/DOB koprusu gerektirir.)

insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method)
select af_player_id, opta, slug, player_name, team_slug, 'bridge:nameteam'
from (
  with sq as (
    select team_slug, af_player_id, player_name, player_slug, split_part(player_slug,'--',1) base
    from analytics.team_current_squad_profile_v1 t
    where not exists (select 1 from analytics.player_profile_bridged_v1 b where b.player_slug=t.player_slug)
      and af_player_id is not null
  )
  select sq.af_player_id, sq.team_slug, sq.player_name,
    (select b.player_source_id from analytics.player_profile_bridged_v1 b
       where split_part(b.player_slug,'--',1)=sq.base and b.team_slug=sq.team_slug limit 1) opta,
    (select b.player_slug from analytics.player_profile_bridged_v1 b
       where split_part(b.player_slug,'--',1)=sq.base and b.team_slug=sq.team_slug limit 1) slug,
    (select count(distinct b.player_source_id) from analytics.player_profile_bridged_v1 b
       where split_part(b.player_slug,'--',1)=sq.base and b.team_slug=sq.team_slug) nc
  from sq
) cand
where opta is not null and nc = 1
  and not exists (select 1 from ref.player_mapping pm where pm.apifootball_player_id = cand.af_player_id)
  and not exists (select 1 from ref.player_mapping pm where pm.opta_player_id = cand.opta)
on conflict (apifootball_player_id) do nothing;
