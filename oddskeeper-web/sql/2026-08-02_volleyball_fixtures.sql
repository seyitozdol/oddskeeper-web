-- Yaklasan maclar (Fixtures). volleyball.matches oynanmis maclari (Results) tutar;
-- bu tablo Turkiye'nin YAKLASAN maclarini (henuz oynanmamis) tutar. Turnuva-toggle'dan
-- BAGIMSIZ (EuroVolley gibi ayri turnuvalar competitions/toggle'a girmesin diye ayri tablo).
-- Kaynak: takvim aciklandiginda elle/scrape ile doldurulur (su an EuroVolley 2026 Pool A).

create table if not exists volleyball.fixtures (
    id               serial primary key,
    competition_name text not null,          -- "EuroVolley 2026"
    stage            text,                     -- "Pool A"
    match_date       date not null,
    match_time       text,                     -- "19:00" (yerel)
    home_code        text,
    away_code        text,
    home_name        text,
    away_name        text,
    venue            text,
    status           text default 'Scheduled',
    unique (competition_name, match_date, home_code, away_code)
);

grant select on volleyball.fixtures to anon, authenticated;
grant all on volleyball.fixtures to service_role;
grant usage, select on sequence volleyball.fixtures_id_seq to service_role;

-- EuroVolley 2026 - Turkiye Pool A (Istanbul, Sinan Erdem Dome; Turkiye ev sahibi).
insert into volleyball.fixtures
  (competition_name, stage, match_date, match_time, home_code, away_code, home_name, away_name, venue)
values
  ('EuroVolley 2026', 'Pool A', '2026-08-21', '19:00', 'TUR', 'LAT', 'Türkiye', 'Latvia',   'Sinan Erdem Dome, İstanbul'),
  ('EuroVolley 2026', 'Pool A', '2026-08-23', '19:00', 'TUR', 'SLO', 'Türkiye', 'Slovenia', 'Sinan Erdem Dome, İstanbul'),
  ('EuroVolley 2026', 'Pool A', '2026-08-24', '19:00', 'TUR', 'HUN', 'Türkiye', 'Hungary',  'Sinan Erdem Dome, İstanbul'),
  ('EuroVolley 2026', 'Pool A', '2026-08-26', '19:00', 'TUR', 'GER', 'Türkiye', 'Germany',  'Sinan Erdem Dome, İstanbul'),
  ('EuroVolley 2026', 'Pool A', '2026-08-28', '19:00', 'TUR', 'POL', 'Türkiye', 'Poland',   'Sinan Erdem Dome, İstanbul')
on conflict (competition_name, match_date, home_code, away_code) do nothing;

-- Sadece yaklasan (bugunden ileri) maclari veren view.
create or replace view analytics.vb_fixtures_v1 as
select id, competition_name, stage, match_date, match_time,
       home_code, away_code, home_name, away_name, venue, status
from volleyball.fixtures
where status = 'Scheduled';

grant select on analytics.vb_fixtures_v1 to anon, authenticated;
