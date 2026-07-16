-- Oyuncu kimlik eşlemesi ve güncel oyuncu bilgisi. 2026-07-16'da canlıya uygulandı.
--
-- Sorun: oyuncu sayfaları Opta oyuncu id'li slug'larla çalışıyor; güncel kadrolar
-- (football.team_squad_current) API-Football oyuncu id'leri taşıyor. İki kimliği
-- ref.player_mapping bağlar; böylece güncel kadrodan oyuncuya tıklanınca mevcut
-- oyuncu sayfası açılır ve oyuncu sayfası güncel kulüp/foto/yaş bilgisi gösterir.
--
-- Eşleme, ad normalizasyonu ile üç geçişte kuruldu (485 oyuncudan 273'ü bağlandı;
-- kalanlar Opta 2025/2026 verisinde hiç oynamamış yeni transferler/kiralıklar):
--   1. team+name: aynı takım + aynı normalize ad (234)
--   2. unique-name: lig genelinde benzersiz normalize ad, takım değiştirenler (29)
--   3. team+surname+initial: aynı takımda soyad + ilk harf, iki tarafta da benzersiz (10)
-- Yeni sezon kadro çekiminden sonra eşleme yeniden koşulmalı (truncate + 3 geçiş).

create table if not exists ref.player_mapping (
    id bigserial primary key,
    apifootball_player_id text not null,
    opta_player_id text not null,
    opta_player_slug text not null,
    player_name text,
    team_slug text,
    match_method text,
    created_at timestamptz not null default now(),
    constraint uq_player_mapping_api unique (apifootball_player_id)
);

-- (Eşleme geçişlerinin tam SQL'i scratch script'te; özet mantık yukarıda.
--  Normalizasyon: team_squad_v1'deki translate tablosuyla aksan temizleme +
--  lower + alfanümerik dışını atma.)

-- Kadro view'ına oyuncu sayfası linki eklendi:
create or replace view analytics.team_current_squad_v1 as
select
    tm.team_slug,
    s.source_team_id as team_source_id,
    tm.display_name as team_name,
    s.source_player_id as player_source_id,
    s.player_name,
    s.age,
    s.shirt_number,
    s.position,
    case
        when s.position = 'Goalkeeper' then 'GOALKEEPER'
        when s.position = 'Defender' then 'DEFENDER'
        when s.position = 'Midfielder' then 'MIDFIELDER'
        when s.position = 'Attacker' then 'FORWARD'
        else 'OTHER'
    end as position_group,
    case
        when s.position = 'Goalkeeper' then 1
        when s.position = 'Defender' then 2
        when s.position = 'Midfielder' then 3
        when s.position = 'Attacker' then 4
        else 5
    end as position_sort,
    s.photo_url,
    s.fetched_at,
    pm.opta_player_slug as player_slug
from football.team_squad_current s
join ref.team_mapping tm
  on tm.source_team_id = s.source_team_id and tm.is_active = true
left join ref.player_mapping pm
  on pm.apifootball_player_id = s.source_player_id;

-- Oyuncu sayfası başlığı için güncel kulüp/foto/yaş/numara bilgisi:
create or replace view analytics.player_current_info_v1 as
select
    pm.opta_player_slug as player_slug,
    pm.opta_player_id,
    s.source_player_id as apifootball_player_id,
    tm.team_slug as current_team_slug,
    tm.display_name as current_team_name,
    s.player_name,
    s.age,
    s.shirt_number,
    s.position,
    s.photo_url,
    s.fetched_at
from ref.player_mapping pm
join football.team_squad_current s on s.source_player_id = pm.apifootball_player_id
join ref.team_mapping tm on tm.source_team_id = s.source_team_id and tm.is_active = true;

grant select on analytics.player_current_info_v1 to anon, authenticated, service_role;
