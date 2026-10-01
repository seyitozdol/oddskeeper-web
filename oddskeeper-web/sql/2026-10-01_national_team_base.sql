-- 2026-10-01: Turkiye A Milli Futbol Takimi (header "TR") - taban tablolar.
--
-- Kaynak SofaScore (takim id 4700). Mac verisi mevcut football.* tablolarina
-- source='sofascore' ile yazilir (kupa deseni); bu dosya yalniz milli takima
-- ozel uc kucuk tabloyu kurar:
--   ref.national_competitions      : izinli turnuvalar (ut id -> DB etiketi).
--                                    Hazirlik maclari (ut 851) BILEREK yok.
--   football.national_editions     : turnuva baskisi (ut + sezon id) ve gorunen ad.
--   football.national_event_meta   : event (mac/fikstur) -> baski + grup.
--   football.national_standings    : baskinin grup tablosu (SofaScore standings).
--
-- SEZON ETIKETI KURALI (football.matches.season_label): kulup ligleriyle ayni,
-- tarih bazli (sinir 24 Haziran). Tek istisna yaz turnuvalari (EURO, Dunya
-- Kupasi): turnuva 24 Haziran'i astigi icin tum maclari biten sezona yazilir
-- (season_shift_days kadar geri kaydirilmis tarihle etiketlenir).
--
-- FlashScore notu: FlashScore Dunya Kupasi'ni isim hakki yuzunden
-- "World Championship" diye adlandirir; SofaScore "FIFA World Cup" der.
-- Ileride FlashScore eslestirmesi yapilirsa flashscore_name kolonu kullanilir.

create table if not exists ref.national_competitions (
  unique_tournament_id integer primary key,
  competition text not null unique,          -- football.matches.competition etiketi
  name_en text not null,
  name_tr text not null,
  short_en text not null,
  short_tr text not null,
  flashscore_name text,
  season_shift_days integer not null default 0,
  sort_order integer not null default 0
);

insert into ref.national_competitions
  (unique_tournament_id, competition, name_en, name_tr, short_en, short_tr, flashscore_name, season_shift_days, sort_order)
values
  (10783, 'UEFA Uluslar Ligi',       'UEFA Nations League',        'UEFA Uluslar Ligi',        'Nations League', 'Uluslar Ligi', 'UEFA Nations League',             0, 1),
  (16,    'FIFA Dünya Kupası',       'FIFA World Cup',             'FIFA Dünya Kupası',        'World Cup',      'Dünya Kupası', 'World Championship',             45, 2),
  (11,    'Dünya Kupası Elemeleri',  'World Cup Qualification',    'Dünya Kupası Elemeleri',   'WC Qualifiers',  'DK Elemeleri', 'World Championship Qualification', 0, 3),
  (1,     'EURO',                    'EURO',                       'EURO',                     'EURO',           'EURO',         'Euro',                           45, 4),
  (27,    'EURO Elemeleri',          'EURO Qualification',         'EURO Elemeleri',           'EURO Qualifiers','EURO Elemeleri','Euro Qualification',              0, 5)
on conflict (unique_tournament_id) do nothing;

create table if not exists football.national_editions (
  unique_tournament_id integer not null references ref.national_competitions(unique_tournament_id),
  season_id integer not null,
  competition text not null,
  season_name text,            -- SofaScore sezon adi ('UEFA Nations League 26/27')
  year_text text,              -- '26/27' | '2026'
  updated_at timestamptz not null default now(),
  primary key (unique_tournament_id, season_id)
);

create table if not exists football.national_event_meta (
  event_id text primary key,   -- sofascore event id (= matches.source_match_id = fixtures.fixture_id)
  unique_tournament_id integer not null,
  season_id integer not null,
  tournament_id integer,       -- grup/asama duzeyi tournament id
  tournament_name text,        -- 'UEFA Nations League, League A, Gr. 1'
  updated_at timestamptz not null default now()
);
create index if not exists ix_national_event_meta_edition
  on football.national_event_meta (unique_tournament_id, season_id);

create table if not exists football.national_standings (
  unique_tournament_id integer not null,
  season_id integer not null,
  tournament_id integer not null,   -- grup duzeyi
  group_name text,
  position integer not null,
  team_source_id text not null,
  team_name text not null,
  played integer, wins integer, draws integer, losses integer,
  goals_for integer, goals_against integer, points integer,
  note text,                        -- SofaScore promotion metni ('Playoffs', 'Relegation' ...)
  updated_at timestamptz not null default now(),
  primary key (season_id, tournament_id, team_source_id)
);

-- RLS: tablolar PostgREST'e analytics view'lari uzerinden acilir; dogrudan
-- erisim yalniz service_role (pipeline). Anon'a hicbir sey yok (anon lockdown).
alter table ref.national_competitions enable row level security;
alter table football.national_editions enable row level security;
alter table football.national_event_meta enable row level security;
alter table football.national_standings enable row level security;
revoke all on ref.national_competitions, football.national_editions,
  football.national_event_meta, football.national_standings from anon, authenticated;
grant select, insert, update, delete on ref.national_competitions, football.national_editions,
  football.national_event_meta, football.national_standings to service_role;
