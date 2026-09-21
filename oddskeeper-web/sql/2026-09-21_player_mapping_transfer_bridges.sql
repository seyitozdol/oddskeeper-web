-- 2026-09-21: mapping health FAIL (HIGH=2) kapama; haftalik transfer koprusu bakimi.
-- squad_profile_broken_link 2: Emir Yasar (Besiktas) + Sinan Alkas (Kasimpasa),
--   kadro af-id'li, profil ss kimliginde; ikisinde de pm'de FARKLI af id'ye kopru
--   zaten vardi (544926 / tm1018802, af cift-id klasigi) -> kadronun kullandigi
--   id'ye ikinci kopru. Profil teyitli (SL, dogru takimlar).
-- duplicate_slug'daki Batagov (Trabzonspor): kadro TM-sentetik id (tm665048), pm
--   koprusu hic yok; gercek Opta kimligi sistemde "Batahov" yazimiyla zaten var
--   (a-batahov--7arn...). Base isimler farkli oldugundan broken_link yakalamadi,
--   duplicate yakaladi. Kopru sentetik id'yi gercek profile baglar.
insert into ref.player_mapping
  (apifootball_player_id, opta_player_id, opta_player_slug, player_name, team_slug, match_method, sofascore_player_id)
values
  ('394221',   'ss1417036', 'emir-yasar--ss1417036',  'Emir Yaşar',  'besiktas',  'manual', '1417036'),
  ('441998',   'ss1548530', 'sinan-alkas--ss1548530', 'Sinan Alkaş', 'kasimpasa', 'manual', '1548530'),
  ('tm665048', '7arn6sdynhciwqu32mju900a2', 'a-batahov--7arn6sdynhciwqu32mju900a2',
   'Arseniy Batagov', 'trabzonspor', 'manual', null);

-- Sayilarin dusmesi icin iki mat da sart (2026-08-19 + 2026-09-14 tuzaklari):
refresh materialized view analytics.team_current_squad_profile_mat;
refresh materialized view analytics.player_current_info_bridged_mat;
