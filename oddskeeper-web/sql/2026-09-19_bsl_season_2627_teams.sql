-- 2026-09-19: BSL 2026-2027 gercek katilimci listesi + takim kaynak id'leri.
--
-- 2026-08-01 seed'i 26/27'ye 25/26 takimlarini YER TUTUCU olarak kopyalamisti. Gercek lig:
--   dusen  : Buyukcekmece, Mersin BSB
--   cikan  : Cayirova Belediyespor (TBL sampiyonu), Bandirma Bordo
-- Kaynak: SofaScore 26/27 sezonu (unique-tournament 519, season 100208) + RealGM lig 7
-- + tr.wikipedia 2026-27 Basketbol Super Ligi. Hub puan durumu bu tablodan beslenir
-- (analytics.bb_team_standings_v1); Tools takim listesi mac oynaninca kendiliginden dolar.
--
-- Yeni takim slug'lari KALICI kimliktir; TBF'nin sponsorlu adi ne olursa olsun scraper
-- bu slug'a baglar (pipeline/src/basketball/identity.py TEAM_KEYWORDS).
-- NOT: manisa-basket 2026'da "Korfez Basket" adini aldi (SofaScore 268256 ve RealGM 2017
-- ayni kulup kimligini suruduruyor). Slug gecmis icin KORUNDU; gorunen ad karari ayri.

insert into basketball.teams (team_slug, team_name, season_label) values
  ('bandirma-bordo',      'Bandırma Bordo',      '2026-2027'),
  ('cayirova-belediyesi', 'Çayırova Belediyesi', '2026-2027')
on conflict (team_slug) do nothing;

delete from basketball.season_participants
 where season_label = '2026-2027' and team_slug in ('buyukcekmece', 'mersin-bsb');

insert into basketball.season_participants (season_label, team_slug, team_name)
select '2026-2027', team_slug, team_name from basketball.teams
 where team_slug in ('bandirma-bordo', 'cayirova-belediyesi')
on conflict (season_label, team_slug) do nothing;

update basketball.teams t set sofascore_team_id = v.sofa, realgm_team_id = v.rgm, updated_at = now()
from (values
  ('anadolu-efes',            3515,   55),
  ('bahcesehir-koleji',       265894, 1882),
  ('besiktas',                6678,   339),
  ('bandirma-bordo',          830362, 2702),
  ('bursaspor',               253781, 1788),
  ('cayirova-belediyesi',     414752, 2629),
  ('erokspor',                460132, 2630),
  ('fenerbahce',              3514,   10),
  ('galatasaray',             25426,  338),
  ('karsiyaka',               25430,  661),
  ('manisa-basket',           268256, 2017),
  ('merkezefendi-belediyesi', 304491, 2097),
  ('aliaga-petkim-spor',      234214, 1626),
  ('tofas',                   37760,  126),
  ('trabzonspor',             45022,  662),
  ('turk-telekom',            24085,  353),
  ('mersin-bsb',              25428,  null),
  ('buyukcekmece',            204719, null)
) as v(slug, sofa, rgm)
where t.team_slug = v.slug;
