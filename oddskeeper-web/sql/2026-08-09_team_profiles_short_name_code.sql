-- 2026-08-09: Takim alias alanlari (ref.team_profiles).
-- Iki yeni alan:
--   short_name : dar alanlarda kullanilan kisa ad ("Besiktas Jimnastik
--                Kulubu" yerine "Besiktas" gibi, Turkce karakterli).
--   code       : fikstur/skor satirlarinda logo yaninda kullanilan kisa kod
--                (BJK, GS, FB...). Kulubun yerlesik kisaltmasi esas alinir;
--                bu yuzden 2-4 harf arasi degisebilir.
-- Frontend bos degerlerde resmi addan sonek kirparak geri duser; bu yuzden
-- kolonlar nullable birakildi.

alter table ref.team_profiles
  add column if not exists short_name text,
  add column if not exists code text;

update ref.team_profiles as tp
set short_name = v.short_name,
    code = v.code
from (
  values
    ('alanyaspor',     'Alanyaspor',     'ALA'),
    ('amed',           'Amed',           'AMD'),
    ('antalyaspor',    'Antalyaspor',    'ANT'),
    ('basaksehir',     'Başakşehir',     'İBFK'),
    ('besiktas',       'Beşiktaş',       'BJK'),
    ('corum',          'Çorum FK',       'ÇFK'),
    ('erzurumspor',    'Erzurumspor',    'ERZ'),
    ('eyupspor',       'Eyüpspor',       'EYP'),
    ('fenerbahce',     'Fenerbahçe',     'FB'),
    ('galatasaray',    'Galatasaray',    'GS'),
    ('gaziantep',      'Gaziantep FK',   'GFK'),
    ('genclerbirligi', 'Gençlerbirliği', 'GB'),
    ('goztepe',        'Göztepe',        'GÖZ'),
    ('karagumruk',     'Karagümrük',     'FKG'),
    ('kasimpasa',      'Kasımpaşa',      'KAS'),
    ('kayserispor',    'Kayserispor',    'KAY'),
    ('kocaelispor',    'Kocaelispor',    'KOC'),
    ('konyaspor',      'Konyaspor',      'KON'),
    ('rizespor',       'Rizespor',       'RİZ'),
    ('samsunspor',     'Samsunspor',     'SAM'),
    ('trabzonspor',    'Trabzonspor',    'TS')
) as v(team_slug, short_name, code)
where tp.team_slug = v.team_slug;

-- Grant tuzagi: tablo yalnizca service role tarafindan okunabiliyordu;
-- alias'lar frontend server bileseninden (anon/authenticated oturum) okunur.
-- Tablo herkese acik referans verisi icerdiginden select grant'i guvenlidir.
grant usage on schema ref to anon, authenticated;
grant select on ref.team_profiles to anon, authenticated;
