-- API-Football geçmiş sezon verisinin (2015/2016 - 2024/2025, source='apifootball')
-- analytics katmanına bağlanması. 2026-07-16 tarihinde canlı veritabanına uygulandı.
--
-- Arka plan: football.matches / match_team_stats / match_incidents /
-- match_player_stats_details tablolarına API-Football'dan 10 sezonluk Süper Lig
-- backfill'i yüklendi. analytics.* view'ları takımları ref.team_mapping üzerinden
-- tanıdığı için apifootball source_team_id'leri mapping'e eklenmeden geçmiş veri
-- ekranlara akmıyordu.

-- 1) COVID uzaması düzeltmesi: Temmuz 2020'de oynanan maçlar 2019/2020 sezonuna
--    aittir (trigger'daki Temmuz sınırı bunları 2020/2021'e atamıştı; trigger
--    sadece NULL etiketleri doldurduğu için bu güncelleme kalıcıdır).
update football.matches
set season_label = '2019/2020', updated_at = now()
where source = 'apifootball'
  and match_datetime >= '2020-07-01'
  and match_datetime < '2020-08-01'
  and season_label = '2020/2021';
-- 45 satır güncellendi

-- 2) team_mapping artık takım başına kaynak bazlı birden fazla satır tutuyor.
--    Not: ref.team_profiles üzerindeki fk_team_profiles_team_slug kısıtı
--    uq_team_mapping_team_slug index'ine bağlı olduğu için kaldırıldı
--    (team_profiles elle yönetilen küçük bir tablo).
alter table ref.team_profiles drop constraint fk_team_profiles_team_slug;
alter table ref.team_mapping drop constraint uq_team_mapping_team_slug;
alter table ref.team_mapping add constraint uq_team_mapping_slug_source unique (team_slug, source_team_id);

-- 3) Güncel 18 takımdan API-Football geçmişi olan 17'sinin apifootball id'leri
--    (Kocaelispor 2015-2024 aralığında Süper Lig'de oynamadığı için yok).
insert into ref.team_mapping
  (team_slug, display_name, canonical_team_name, logo_path, is_active, source_team_id, created_at, updated_at)
select tm.team_slug, tm.display_name, tm.canonical_team_name, tm.logo_path, true, v.api_id, now(), now()
from (values
  ('alanyaspor', '996'),
  ('antalyaspor', '1005'),
  ('basaksehir', '564'),
  ('besiktas', '549'),
  ('eyupspor', '3588'),
  ('fenerbahce', '611'),
  ('galatasaray', '645'),
  ('gaziantep', '3573'),
  ('genclerbirligi', '997'),
  ('goztepe', '994'),
  ('karagumruk', '3589'),
  ('kasimpasa', '1004'),
  ('kayserispor', '1001'),
  ('konyaspor', '607'),
  ('rizespor', '1007'),
  ('samsunspor', '3603'),
  ('trabzonspor', '998')
) as v(slug, api_id)
join ref.team_mapping tm on tm.team_slug = v.slug
on conflict (team_slug, source_team_id) do nothing;
-- 17 satır eklendi
