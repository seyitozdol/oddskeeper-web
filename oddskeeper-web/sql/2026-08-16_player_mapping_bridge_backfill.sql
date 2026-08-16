-- MAPPING AUDIT fix (oyuncu): ref.player_mapping 312 satirdi, guncel kadro ~684.
-- Koprusu olmayan oyuncuda kadro paneli oyuncuyu apifootball slug'i (--af/--aftm)
-- ile linkliyor; profil verisi ise sentetik-opta (--ss) ya da gercek opta slug'inda
-- -> profil sayfasi BOS aciliyordu ( or. John Lundstram Trabzonspor: kadroda #5 ama
-- profil bos; veri john-lundstram--ss149815'te). Kok: apifootball<->opta koprusu eksik.
--
-- Cozum: DOB+isim dogrulamali koprulerden (apifootball_sofascore_player_map +
-- sofascore_opta_player_map) eksik satirlari uret. opta_player_id + slug DOGRUDAN
-- bridged profilden (player_profile_bridged_v1) alinir; boylece kadro prof-join'i
-- (Faz B: bridged'e cevrildi) profil slug'ini bulur. af id UNIQUE oldugundan
-- distinct on(af) + not exists ile guvenli; ayni opta'yi 2 af'a baglayan durum
-- (ayni oyuncunun tm/native iki af id'si) kasitli/dogru.

insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method, sofascore_player_id)
select distinct on (afs.apifootball_player_id)
  afs.apifootball_player_id,
  ppb.player_source_id,
  ppb.player_slug,
  ppb.player_name,
  ppb.team_slug,
  'bridge:af-sofa-opta',
  afs.sofascore_player_id
from ref.apifootball_sofascore_player_map afs
join ref.sofascore_opta_player_map som on som.sofascore_player_id = afs.sofascore_player_id
join analytics.player_profile_bridged_v1 ppb on ppb.player_source_id = som.opta_player_id
where not exists (
  select 1 from ref.player_mapping pm where pm.apifootball_player_id = afs.apifootball_player_id
)
order by afs.apifootball_player_id, ppb.last_match_datetime desc nulls last
on conflict (apifootball_player_id) do nothing;
