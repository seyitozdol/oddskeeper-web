-- Oyuncu bio verileri, güncel takım bilgileri ve view performans düzeltmeleri.
-- 2026-07-18'de canlı veritabanına uygulandı. Kaynak: API-Football.
--
-- 1) football.player_bio: /players/profiles'tan 481 oyuncunun kişisel bilgileri
--    (uyruk, boy, kilo, doğum tarihi/yeri, tam ad, foto). Kadro yenilendiğinde
--    oddskeeper/data/apifootball/player_profiles cache'i ile birlikte tazelenir.
-- 2) analytics.player_current_info_v1 view'ına bio alanları eklendi.
-- 3) ref.team_profiles: /teams (stadyum, kapasite, kuruluş yılı) ve /coachs
--    (teknik direktör) ile güncellendi; amed/corum/erzurumspor profilleri eklendi.
--    market_value_* alanlarına dokunulmadı (API-Football'da yok).
-- 4) PERFORMANS: apifootball backfill'i sonrası match_player_stats_details 8.5k
--    satırdan 127k satıra çıktı. Opta kimlikleriyle çalışan view'lar bu tabloyu
--    filtresiz dedup'luyordu; team_squad_v1 7 sn'ye kadar çıkmıştı. Aşağıdaki
--    view'lara source='opta' filtresi eklendi (opta ve apifootball id uzayları
--    kesişmediği için sonuç birebir aynı, sadece hızlı):
--      - analytics.v_player_match_details_base  (WHERE d.source='opta')
--      - analytics.team_squad_v1                (details_dedup CTE'sinde)
--      - analytics.player_match_log_v1          (LEFT JOIN koşulunda)
--      - analytics.player_match_metrics_base_v1 (FULL JOIN alt sorgusunda)
--    Ölçüm: team_squad_v1 7074ms -> ~670ms; player_profile_v1 498ms -> ~200ms;
--    player_match_log_v1 562ms -> ~215ms. Ardından ilgili tablolara ANALYZE çekildi.
--    NOT: İleride apifootball geçmiş oyuncu istatistikleri oyuncu sayfalarına
--    bağlanmak istenirse bu filtreler yeniden ele alınmalı.

create table if not exists football.player_bio (
    id bigserial primary key,
    source text not null default 'apifootball',
    source_player_id text not null,
    full_name text,
    first_name text,
    last_name text,
    birth_date date,
    birth_place text,
    birth_country text,
    nationality text,
    height_cm integer,
    weight_kg integer,
    photo_url text,
    fetched_at timestamptz not null default now(),
    constraint uq_player_bio unique (source, source_player_id)
);

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
    s.fetched_at,
    b.full_name,
    b.nationality,
    b.height_cm,
    b.weight_kg,
    b.birth_date,
    b.birth_place
from ref.player_mapping pm
join football.team_squad_current s on s.source_player_id = pm.apifootball_player_id
join ref.team_mapping tm on tm.source_team_id = s.source_team_id and tm.is_active = true
left join football.player_bio b
  on b.source = 'apifootball' and b.source_player_id = s.source_player_id;

-- (4. maddedeki view gövdeleri mevcut tanımlarının WHERE/JOIN koşullarına
--  source='opta' eklenmiş halleridir; tam gövdeler pg_views'tan alınabilir.)
