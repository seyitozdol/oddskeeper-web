-- 2026-09-19: Manisa Basket 2026-27'de "Korfez Basket" adiyla oynuyor (sahip karari).
-- Slug (manisa-basket) KORUNUR: gecmis maclar, kadro ve platform id'leri ayni kulube bagli kalir.
-- 2025-26 satirlari tarihsel olarak "Manisa Basket" kalir; yeni sezon satirlari ve yeni
-- yazilacak mac satirlari (identity.resolve_teams kanonik adi basketball.teams'ten alir)
-- "Korfez Basket" olur.
update basketball.teams set team_name = 'Körfez Basket', updated_at = now()
 where team_slug = 'manisa-basket';
update basketball.season_participants set team_name = 'Körfez Basket'
 where team_slug = 'manisa-basket' and season_label = '2026-2027';
