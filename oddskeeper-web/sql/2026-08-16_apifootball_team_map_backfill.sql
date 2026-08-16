-- MAPPING AUDIT fix: 20 apifootball takim id'si ref.team_mapping'te yoktu.
-- Sonuc: msm.team_match_log_v1 (source_team_id join) o takimlarin apifootball-
-- kaynakli mac verisini team_slug=null birakip DUSURUYORDU (2015-2024 arasi;
-- ozellikle 2024/2025 Super Lig apifootball-only: Sivasspor/Adana Demirspor/
-- Hatayspor/Bodrum FK tamamen kayipti). Antalyaspor/Kayserispor ile ayni sinif.
-- Grup 1: mevcut slug'a bagli (dogrulanmis, normalize display_name eslesmesi).
-- Grup 2: artik yok olan (defunct) takimlar; tarihsel veri gorunsun diye slug uret.

-- Grup 1 — mevcut slug'lar
insert into ref.team_mapping (team_slug, display_name, canonical_team_name, is_active, source_team_id)
values
  ('sivasspor',        'Sivasspor',        'Sivasspor',        true, '1002'),
  ('yeni-malatyaspor', 'Yeni Malatyaspor', 'Yeni Malatyaspor', true, '999'),
  ('hatayspor',        'Hatayspor',        'Hatayspor',        true, '3575'),
  ('adana-demirspor',  'Adana Demirspor',  'Adana Demirspor',  true, '3563'),
  ('bursaspor',        'Bursaspor',        'Bursaspor',        true, '1003'),
  ('istanbulspor',     'İstanbulspor',     'İstanbulspor',     true, '3578'),
  ('pendikspor',       'Pendikspor',       'Pendikspor',       true, '3601'),
  ('bodrum',           'Bodrum FK',        'Bodrum FK',        true, '3583'),
  ('umraniyespor',     'Ümraniyespor',     'Ümraniyespor',     true, '3577'),
  ('adanaspor',        'Adanaspor',        'Adanaspor',        true, '3564'),
  ('mke-ankaragucu',   'MKE Ankaragücü',   'MKE Ankaragücü',   true, '1010')
on conflict (team_slug, source_team_id) do nothing;

-- Grup 2 — defunct takimlar (onceden slug yok; tarihsel MSM baseline'i icin)
insert into ref.team_mapping (team_slug, display_name, canonical_team_name, is_active, source_team_id)
values
  ('akhisarspor',          'Akhisarspor',           'Akhisarspor',           true, '995'),
  ('osmanlispor',          'Osmanlıspor',           'Osmanlıspor',           true, '780'),
  ('denizlispor',          'Denizlispor',           'Denizlispor',           true, '3570'),
  ('giresunspor',          'Giresunspor',           'Giresunspor',           true, '3574'),
  ('kardemir-karabukspor', 'Kardemir Karabükspor',  'Kardemir Karabükspor',  true, '1000'),
  ('gaziantepspor',        'Gaziantepspor',         'Gaziantepspor',         true, '1008'),
  ('altay',                'Altay',                 'Altay',                 true, '3566'),
  ('eskisehirspor',        'Eskişehirspor',         'Eskişehirspor',         true, '3572'),
  ('mersin-talimyurdu',    'Mersin Talımyurdu SK',  'Mersin Talımyurdu SK',  true, '13382')
on conflict (team_slug, source_team_id) do nothing;
