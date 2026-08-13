-- MSM (Match Stats Model) kupa takim logolari: slug -> Mackolik CDN URL.
-- MSM logoFor() cup icin yerel /images/football_logos/{slug}.png'e dusuyordu ama
-- amator kupa takimlarinin yerel logosu YOK (404 -> kirik). Bu view slug'i (histdata
-- ile ayni: matched football slug VEYA isimden slug) Mackolik CDN'e baglar.
-- fetchTeamLogos('cup') bunu okur; TeamCrest/watermark img'leri referrerPolicy=no-referrer.

create or replace view analytics.cup_msm_team_logos_v1 as
select distinct on (slug) slug, logo_url from (
  select coalesce(tm.team_slug,
      regexp_replace(lower(translate(tm.team_name,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) as slug,
    'https://api.mackolikfeeds.com/soccer/images/teams/150x150/' || tm.mackolik_team_uuid || '.png' as logo_url
  from ref.mackolik_team_map tm where tm.mackolik_team_uuid is not null
) t order by slug, logo_url;

grant select on analytics.cup_msm_team_logos_v1 to anon, authenticated;
