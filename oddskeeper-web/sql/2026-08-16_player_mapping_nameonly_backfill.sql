-- MAPPING AUDIT fix (oyuncu, 3. pas): takim degistiren oyuncular (profil verisi
-- eski takimda). Normalize-ad-tabani GLOBAL TEK aday (nc=1) ise takim sarti
-- olmadan bagla. Su an: Emre Bilgin (Besiktas->Eyupspor), F. Soyalp (Kayseri->Amed).
insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method)
select af_player_id, opta, slug, player_name, null, 'bridge:nameonly'
from (
  with sq as (
    select af_player_id, player_name, player_slug, split_part(player_slug,'--',1) base
    from analytics.team_current_squad_profile_v1 t
    where not exists (select 1 from analytics.player_profile_bridged_v1 b where b.player_slug=t.player_slug)
      and af_player_id is not null
  )
  select sq.af_player_id, sq.player_name,
    (select b.player_source_id from analytics.player_profile_bridged_v1 b where split_part(b.player_slug,'--',1)=sq.base limit 1) opta,
    (select b.player_slug from analytics.player_profile_bridged_v1 b where split_part(b.player_slug,'--',1)=sq.base limit 1) slug,
    (select count(distinct b.player_source_id) from analytics.player_profile_bridged_v1 b where split_part(b.player_slug,'--',1)=sq.base) nc
  from sq
) cand
where opta is not null and nc=1
  and not exists (select 1 from ref.player_mapping pm where pm.apifootball_player_id=cand.af_player_id)
  and not exists (select 1 from ref.player_mapping pm where pm.opta_player_id=cand.opta)
on conflict (apifootball_player_id) do nothing;
