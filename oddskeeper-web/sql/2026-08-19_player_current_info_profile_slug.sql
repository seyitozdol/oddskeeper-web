-- 2026-08-19: Oyuncu Listesi (player_current_info_v1) kimlik cozumlemesi kadro
-- profiliyle AYNI zincire baglandi + PSM oyuncu id'leri kanonik slug'a tasindi.
--
-- SORUN: PSM'de id kayitli oyuncular Input'a id'siz gidiyordu (Erzurum-GS vakasi:
-- E. Tozlu / M. Fettahoglu / G. Kerk / Martin Rodriguez; lig genelinde 53 oyuncu,
-- 40'inda kayitli id sessizce kopuktu). Kok neden: iki view ayni oyuncuya farkli
-- kimlik veriyordu:
--   - Model kadrosu (team_current_squad_profile_def_v1) player_mapping bulamazsa
--     DOB-dogrulamali af->sofascore->profil zincirini CANLI dener
--     (sql/2026-08-18_squad_profile_af_sofa_fallback.sql) -> kanonik ss-slug.
--   - Oyuncu Listesi (player_current_info_v1) ise SADECE ref.player_mapping'i
--     biliyordu; satir yoksa '<isim>--af<id>' fallback slug'ina dusuyordu.
--   Id'ler Oyuncu Listesi slug'iyla pm_player_ids'e yazildigi icin Model'deki
--   handleAdd (playerIds[squad_slug]) bulamiyordu.
--
-- COZUM (bu dosya 3 is yapar; makine-uygulanabilir, idempotent):
--   1) pm_player_ids (league='tsl') eski info-slug'lu kayitlari kanonik squad
--      slug'ina tasir (hedef doluysa eski satir silinir; ayni oyuncunun iki af
--      kimligi tek kanonige cozulur).
--   2) ref.player_mapping.opta_player_slug'i guncel bridged-profil slug'ina
--      senkronlar (Melih Ibrahimoglu sinifi: mapping slug'i profil slug'indan
--      sapmisti; team_current_squad_v1 ham slug'lari da boylece duzelir).
--   3) player_current_info_v1'i def_v1 ile AYNI COALESCE zincirine gecirir:
--      profil slug > mapping slug > af-fallback. Iki view artik yapisal olarak
--      ayni kimligi uretir; gelecekteki yukselen takim / yeni ss-profil
--      vakalari kendiliginden hizali kalir.
--
-- Uygulama sonrasi: refresh materialized view analytics.team_current_squad_profile_mat;
--                   refresh materialized view analytics.player_current_info_bridged_mat;
--                   notify pgrst, 'reload schema';

-- ─── 1) Re-key ciftlerini ESKI view tanimi uzerinden yakala ───────────────────
-- (view degistikten sonra eski slug'lar turetilemez; once yakala)

create temp table _psm_rekey_all as
select i.player_slug as info_slug, s.player_slug as squad_slug
from analytics.player_current_info_v1 i
join analytics.team_current_squad_profile_v1 s
  on s.af_player_id = i.apifootball_player_id
where i.apifootball_player_id is not null
  and i.player_slug is distinct from s.player_slug;

-- Ayni squad slug'a birden fazla info slug cozulebilir (native + tm af kimligi);
-- id tasima icin kayitli id'si olan (yoksa herhangi biri) tek cift secilir.
create temp table _psm_rekey as
select distinct on (k.squad_slug) k.info_slug, k.squad_slug
from _psm_rekey_all k
left join analytics.pm_player_ids p
  on p.league = 'tsl' and p.player_slug = k.info_slug
order by k.squad_slug, (p.player_slug is not null) desc, p.updated_at desc nulls last;

-- ─── 1a) Id'leri kanonik slug'a tasi ──────────────────────────────────────────

update analytics.pm_player_ids p
set player_slug = k.squad_slug
from _psm_rekey k
where p.league = 'tsl'
  and p.player_slug = k.info_slug
  and not exists (select 1 from analytics.pm_player_ids q
                  where q.league = 'tsl' and q.player_slug = k.squad_slug);

-- Eski slug'da kalan artiklar (hedef zaten doluydu / ikinci af kimligi): sil.
delete from analytics.pm_player_ids p
using _psm_rekey_all k
where p.league = 'tsl'
  and p.player_slug = k.info_slug
  and exists (select 1 from analytics.pm_player_ids q
              where q.league = 'tsl' and q.player_slug = k.squad_slug);

-- ─── 2) Mapping slug'ini guncel profil slug'ina senkronla ─────────────────────

update ref.player_mapping pm
set opta_player_slug = pr.player_slug
from (select distinct on (player_source_id) player_source_id, player_slug
      from analytics.player_profile_bridged_v1
      order by player_source_id, season_label desc, appearances desc) pr
where pr.player_source_id = pm.opta_player_id
  and pr.player_slug is distinct from pm.opta_player_slug;

-- ─── 3) player_current_info_v1: def_v1 ile ayni kimlik zinciri ────────────────
-- Kolon kumesi/sirasi DEGISMEDI (create or replace). Degisen: player_slug artik
-- COALESCE(profil, mapping, af-fallback); opta_player_id sofascore koprusunu de
-- gorur (player_current_info_bridged_v1 union'indaki cift kayitlar da kapanir).

create or replace view analytics.player_current_info_v1 as
 with afs as (
         select distinct on (m.apifootball_player_id) m.apifootball_player_id,
            m.sofascore_player_id
           from ref.apifootball_sofascore_player_map m
        ), prof as (
         select distinct on (b.player_source_id) b.player_source_id,
            b.player_slug
           from analytics.player_profile_bridged_v1 b
          order by b.player_source_id, b.season_label desc, b.appearances desc
        )
 select coalesce(prof.player_slug, pm.opta_player_slug,
           (lower(btrim(regexp_replace(regexp_replace(translate(s.player_name,
             'ÇĞİÖŞÜçğıöşüÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÑñĆćČčŠšŽžŁłŃń'::text,
             'CGIOSUcgiosuAAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcCcSsZzLlNn'::text),
             '[^a-zA-Z0-9]+'::text, '-'::text, 'g'::text), '-{2,}'::text, '-'::text, 'g'::text),
             '-'::text)) || '--af'::text) || s.source_player_id) as player_slug,
    coalesce(pm.opta_player_id, som.opta_player_id) as opta_player_id,
    s.source_player_id as apifootball_player_id,
    tm.team_slug as current_team_slug,
    tm.display_name as current_team_name,
    s.player_name,
    s.age,
    s.shirt_number,
    s."position",
    s.photo_url,
    s.fetched_at,
    b.full_name,
    b.nationality,
    b.height_cm,
    b.weight_kg,
    b.birth_date,
    b.birth_place,
    b.first_name,
    b.last_name
   from football.team_squad_current s
     join ref.team_mapping tm on tm.source_team_id = s.source_team_id and tm.is_active = true
     left join ref.player_mapping pm on pm.apifootball_player_id = s.source_player_id
     left join afs on afs.apifootball_player_id = s.source_player_id
     left join ref.sofascore_opta_player_map som on som.sofascore_player_id = afs.sofascore_player_id
     left join prof on prof.player_source_id = coalesce(pm.opta_player_id, som.opta_player_id)
     left join football.player_bio b on b.source = 'apifootball'::text and b.source_player_id = s.source_player_id;
