-- MSM 1. Lig (tff1) takım logoları: analytics.tff1_team_logos_v1 (SofaScore team_id
-- + Flashscore logo_url) -> msm slug uzayına köprü. Model bunu tff1 için okur.
-- 20 takımın 16'sında logo var; 4'ü (batman/bursa/mardin/mugla) kaynakta yok -> baş harf.

create or replace view analytics.msm_team_logos_tff1_v1 as
with team_map(team_id, slug) as (values
  ('3056','antalyaspor'), ('44320','bandirmaspor'), ('3099','batmanspor'), ('202390','bodrum'),
  ('6414','boluspor'), ('3055','bursaspor'), ('262480','esenler-erokspor'), ('4954','karagumruk'),
  ('388264','igdir-fk'), ('3066','istanbulspor'), ('3072','kayserispor'), ('6366','keciorengucu'),
  ('202391','manisa-fk'), ('296730','mardinspor'), ('7034','muglaspor'), ('7032','pendikspor'),
  ('4952','sariyer'), ('3076','sivasspor'), ('55625','umraniyespor'), ('24750','vanspor-fk')
)
select m.slug, l.logo_url
from analytics.tff1_team_logos_v1 l
join team_map m on m.team_id = l.team_id;

grant select on analytics.msm_team_logos_tff1_v1 to anon, authenticated;

notify pgrst, 'reload schema';
