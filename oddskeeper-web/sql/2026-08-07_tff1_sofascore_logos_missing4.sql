-- 1. Lig League/Teams (ve tüm tff1 yüzeyleri: sıralama, takım profili, maç detayı,
-- player market) takım logolarını ref.sofascore_team_logos'tan tff1_team_logos_v1 ile
-- team_id (SofaScore id) üzerinden çeker. Flashscore ekstraksiyonunda olmayan 4 takım
-- burada yoktu -> baş harf rozeti. Yerel logo dosyaları repoda mevcut; local yol ekle
-- (Antalyaspor/Kayserispor gibi bu tabloda zaten yerel /images/... yolu kullanılıyor).
insert into ref.sofascore_team_logos (sofascore_team_id, team_name, logo_url)
values
  ('3099',   'Batman Petrolspor', '/images/football_logos/batmanspor.png'),
  ('3055',   'Bursaspor',         '/images/football_logos/bursaspor.png'),
  ('296730', 'Mardin 1969 Spor',  '/images/football_logos/mardinspor.png'),
  ('7034',   'Muğlaspor',         '/images/football_logos/muglaspor.png')
on conflict (sofascore_team_id) do update
  set team_name = excluded.team_name,
      logo_url  = excluded.logo_url,
      updated_at = now();

notify pgrst, 'reload schema';
