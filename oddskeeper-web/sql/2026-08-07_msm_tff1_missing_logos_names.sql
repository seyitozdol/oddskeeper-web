-- MSM 1. Lig (tff1): logosu görünmeyen + adı küçük harfle gelen 4 takımın düzeltmesi.
-- Etkilenen takımlar (SofaScore team_id): Batman Petrolspor (3099), Bursaspor (3055),
-- Mardin 1969 Spor (296730), Muğlaspor (7034). Bunlar Flashscore kaynağında (tff1_team_logos_v1)
-- yok -> baş harf rozeti; ayrıca ref.team_mapping'te satırları olmadığı için msm_teams_v1
-- display_name slug'a düşüyordu (küçük harf).

-- 1) İsim düzeltmesi: ref.team_mapping'e eksik 4 takımın satırı (msm_teams_v1 buradan okur).
insert into ref.team_mapping (team_slug, display_name, canonical_team_name, source_team_id)
values
  ('batmanspor', 'Batman Petrolspor', 'Batman Petrolspor', '3099'),
  ('bursaspor',  'Bursaspor',         'Bursaspor',         '3055'),
  ('mardinspor', 'Mardin 1969 Spor',  'Mardin 1969 Spor',  '296730'),
  ('muglaspor',  'Muğlaspor',         'Muğlaspor',         '7034')
on conflict (team_slug, source_team_id) do update
  set display_name = excluded.display_name,
      canonical_team_name = excluded.canonical_team_name,
      updated_at = now();

-- 2) Logo düzeltmesi: 4 takım için yerel /images/football_logos/{slug}.png dosyaları repoya
-- eklendi. View'ı, Flashscore kaynağında olmayan bu slug'lar için yerel yolu döndürecek şekilde
-- yeniden kur (INNER -> LEFT join + yerel override).
create or replace view analytics.msm_team_logos_tff1_v1 as
with team_map(team_id, slug) as (values
  ('3056','antalyaspor'), ('44320','bandirmaspor'), ('3099','batmanspor'), ('202390','bodrum'),
  ('6414','boluspor'), ('3055','bursaspor'), ('262480','esenler-erokspor'), ('4954','karagumruk'),
  ('388264','igdir-fk'), ('3066','istanbulspor'), ('3072','kayserispor'), ('6366','keciorengucu'),
  ('202391','manisa-fk'), ('296730','mardinspor'), ('7034','muglaspor'), ('7032','pendikspor'),
  ('4952','sariyer'), ('3076','sivasspor'), ('55625','umraniyespor'), ('24750','vanspor-fk')
),
local_override(slug, logo_url) as (values
  ('batmanspor', '/images/football_logos/batmanspor.png'),
  ('bursaspor',  '/images/football_logos/bursaspor.png'),
  ('mardinspor', '/images/football_logos/mardinspor.png'),
  ('muglaspor',  '/images/football_logos/muglaspor.png')
)
select m.slug, coalesce(o.logo_url, l.logo_url) as logo_url
from team_map m
left join analytics.tff1_team_logos_v1 l on l.team_id = m.team_id
left join local_override o on o.slug = m.slug
where coalesce(o.logo_url, l.logo_url) is not null;

grant select on analytics.msm_team_logos_tff1_v1 to anon, authenticated;

notify pgrst, 'reload schema';
