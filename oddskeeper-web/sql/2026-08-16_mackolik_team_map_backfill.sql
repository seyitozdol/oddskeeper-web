-- MAPPING AUDIT fix: ref.mackolik_team_map'te 150/168 satirin team_slug'u nulldu.
-- analytics.cup_matches_v1 home/away_team_slug bundan geldiginden kupa maclarinda
-- takim logosu/profili cozulmuyordu (ad coalesce ile gorunuyor, VERI DUSMUYOR).
-- TSL/1.Lig'de zaten slug'i olan 29 takimi normalize (Turkce-fold) ad eslesmesiyle
-- doldur. Ambiguity=0 dogrulandi. Kalan ~112 alt-lig/amator kupa takimi null kalir.

update ref.mackolik_team_map mm
set team_slug = tm.team_slug,
    canonical_team_name = coalesce(mm.canonical_team_name, tm.canonical_team_name),
    updated_at = now()
from ref.team_mapping tm
where mm.team_slug is null
  and lower(translate(mm.team_name,'ÇĞİÖŞÜçğıöşü','CGIOSUcgiosu'))
    = lower(translate(tm.display_name,'ÇĞİÖŞÜçğıöşü','CGIOSUcgiosu'));
