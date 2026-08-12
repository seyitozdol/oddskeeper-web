-- 2026-08-12: Ayni team_slug'in aktif mapping satirlari farkli display_name
-- tasiyordu (amed: 'Amed' + 'Amed Sportif Faaliyetler'; genclerbirligi ve
-- karagumruk benzer). player_current_info_v1 takim adini team_mapping'ten
-- aldigindan PSM Player List ayni takimi IKI takim gibi gosteriyordu.
-- Slug basina tek gorunen ad (sofascore satirindaki asil/Turkce ad) kullanilir.

update ref.team_mapping set display_name = 'Amed Sportif Faaliyetler', updated_at = now()
 where team_slug = 'amed' and is_active and display_name <> 'Amed Sportif Faaliyetler';

update ref.team_mapping set display_name = 'Gençlerbirliği', updated_at = now()
 where team_slug = 'genclerbirligi' and is_active and display_name <> 'Gençlerbirliği';

update ref.team_mapping set display_name = 'Fatih Karagümrük', updated_at = now()
 where team_slug = 'karagumruk' and is_active and display_name <> 'Fatih Karagümrük';
