-- MSM 1. Lig (tff1) fikstür view'ı: analytics.tff1_fixtures_v1 (SofaScore-keyed)
-- -> msm.histdata team_slug uzayına köprüler. MSM fetchFixtures bunu tff1 için okur.
-- Çıktı league_fixtures_v1 alt kümesiyle aynı şekil: fixture_id, round_number,
-- home/away_team_slug, home/away_team_name, fixture_datetime, competition, season_label.
-- Takım id -> slug haritası SofaScore team_id sabit; 2026/2027 20 takım.

create or replace view analytics.msm_fixtures_tff1_v1 as
with team_map(team_id, slug) as (values
  ('3056','antalyaspor'), ('44320','bandirmaspor'), ('3099','batmanspor'), ('202390','bodrum'),
  ('6414','boluspor'), ('3055','bursaspor'), ('262480','esenler-erokspor'), ('4954','karagumruk'),
  ('388264','igdir-fk'), ('3066','istanbulspor'), ('3072','kayserispor'), ('6366','keciorengucu'),
  ('202391','manisa-fk'), ('296730','mardinspor'), ('7034','muglaspor'), ('7032','pendikspor'),
  ('4952','sariyer'), ('3076','sivasspor'), ('55625','umraniyespor'), ('24750','vanspor-fk')
)
select
  f.fixture_id,
  f.round_number,
  '1. Lig'::text            as competition,
  f.season_label,
  hm.slug                   as home_team_slug,
  am.slug                   as away_team_slug,
  f.home_team_name,
  f.away_team_name,
  f.fixture_datetime
from analytics.tff1_fixtures_v1 f
left join team_map hm on hm.team_id = f.home_team_id
left join team_map am on am.team_id = f.away_team_id
where f.season_label = '2026/2027';

grant select on analytics.msm_fixtures_tff1_v1 to anon, authenticated;

notify pgrst, 'reload schema';
