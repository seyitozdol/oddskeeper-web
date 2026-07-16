-- 2026-27 sezonu hazırlığı. 2026-07-16 tarihinde canlı veritabanına uygulandı.
-- Veri kaynağı: API-Football (season=2026, league=203).
--
-- Yapılanlar:
--   1. football.team_squad_current tablosu: API-Football /players/squads'tan
--      güncel (transfer sonrası) kadrolar. 18 takım, 485 oyuncu yüklendi.
--      Yenilemek için: oddskeeper/data/apifootball/squads cache'ini silip
--      squads endpoint'inden tekrar çekmek yeterli (delete + insert).
--   2. analytics.team_current_squad_v1 view'ı: kadro + team_mapping (slug).
--   3. ref.team_mapping'e 2026-27'nin yeni takımları eklendi:
--      amed (3579), corum (6343), erzurumspor (1009, 2018-2021 arası
--      apifootball geçmişi otomatik bağlanır), kocaelispor (7411).
--      Düşen takımların (antalyaspor, karagumruk, kayserispor) mapping
--      kayıtları geçmiş veri için duruyor; sadece logoları listeden kalktı.
--   4. football.fixtures'a 2026/2027 sezonunun 306 maçlık fikstürü yüklendi
--      (source='apifootball', fixture_id = API fixture id, saatler TR).

create table if not exists football.team_squad_current (
    id bigserial primary key,
    source text not null default 'apifootball',
    source_team_id text not null,
    team_name text not null,
    source_player_id text not null,
    player_name text not null,
    age integer,
    shirt_number integer,
    position text,
    photo_url text,
    fetched_at timestamptz not null default now(),
    constraint uq_team_squad_current unique (source, source_team_id, source_player_id)
);

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
    s.fetched_at
from football.team_squad_current s
join ref.team_mapping tm
  on tm.source_team_id = s.source_team_id and tm.is_active = true;

grant select on analytics.team_current_squad_v1 to anon, authenticated, service_role;

insert into ref.team_mapping (team_slug, display_name, canonical_team_name, logo_path, is_active, source_team_id, created_at, updated_at)
values
  ('amed', 'Amed', 'Amed Sportif Faaliyetler', '/images/football_logos/amed.png', true, '3579', now(), now()),
  ('corum', 'Çorum FK', 'Çorum Futbol Kulübü', '/images/football_logos/corum.png', true, '6343', now(), now()),
  ('erzurumspor', 'Erzurumspor FK', 'Erzurumspor Futbol Kulübü', '/images/football_logos/erzurumspor.png', true, '1009', now(), now())
on conflict (team_slug, source_team_id) do nothing;

insert into ref.team_mapping (team_slug, display_name, canonical_team_name, logo_path, is_active, source_team_id, created_at, updated_at)
select team_slug, display_name, canonical_team_name, logo_path, true, '7411', now(), now()
from ref.team_mapping where team_slug = 'kocaelispor' limit 1
on conflict (team_slug, source_team_id) do nothing;

-- Kadro satırları ve 2026/2027 fikstürü API cache'inden script ile yüklendi
-- (bkz. yukarıdaki not); DDL dışı DML burada tekrarlanmıyor.
