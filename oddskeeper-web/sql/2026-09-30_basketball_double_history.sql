-- 2026-09-30: Double-double / triple-double GECMIS sayilari + simulasyon korelasyonu.
--
-- 1) Gecmis: Player Distribution'daki Double-Double / Triple-Double tablosunda model
--    olasiliginin yaninda oyuncunun gercekte kac macta yaptigi gosterilir (or. 5/29).
--    Mac kumesi tablodaki GP kolonuyla AYNI olmali, bu yuzden window kaynaklarinin esi:
--      bb_player_double_v1        ~ bb_player_metric_window_v1        (sezon + takim + oyuncu)
--      bb_player_double_roster_v1 ~ bb_player_metric_window_roster_v1 (kadro sezonu; oyuncunun
--                                   o sezona kadarki TUM maclari, takimdan bagimsiz)
--      el_player_double_v1        ~ el_player_metric_window_v1        (lig + sezon + takim + oyuncu)
--    Yalniz sayi / ribaund / asist sayilir (esik 10). BSL view'lari bb_player_game_enriched_v1'den
--    okur: oynanmayan (DNP) satirlar ve birlestirilen mukerrer oyuncular orada cozulmus.
-- 2) Korelasyon: simulasyon uc istatistigi birlikte ceker (features/basketball/doubles.ts).
--    Degerler lig verisinden olculdu (oyuncunun kendi sezon ortalamasindan sapmalarin havuzlanmis
--    korelasyonu; >= 15 mac ve >= 15 dk oynayan oyuncu-sezonlar, 2026-09-30):
--      BSL 0.298 / 0.180 / 0.170, EuroLeague 0.285 / 0.169 / 0.163, EuroCup 0.247 / 0.189 / 0.148
--    (sayi-ribaund / sayi-asist / ribaund-asist). Ortak varsayilan 0.30 / 0.18 / 0.17;
--    Config > Model > Double-Double kutusundan degisir.

create or replace view analytics.bb_player_double_v1 as
select e.season_label,
       e.team_slug,
       e.player_slug,
       count(*)::int as games,
       (count(*) filter (where ((coalesce(e.points, 0) >= 10)::int + (coalesce(e.treb, 0) >= 10)::int + (coalesce(e.assists, 0) >= 10)::int) >= 2))::int as dd,
       (count(*) filter (where ((coalesce(e.points, 0) >= 10)::int + (coalesce(e.treb, 0) >= 10)::int + (coalesce(e.assists, 0) >= 10)::int) = 3))::int as td
from analytics.bb_player_game_enriched_v1 e
group by e.season_label, e.team_slug, e.player_slug;

create or replace view analytics.bb_player_double_roster_v1 as
select ro.season_label,
       ro.team_slug,
       ro.player_slug,
       count(e.id)::int as games,
       (count(e.id) filter (where ((coalesce(e.points, 0) >= 10)::int + (coalesce(e.treb, 0) >= 10)::int + (coalesce(e.assists, 0) >= 10)::int) >= 2))::int as dd,
       (count(e.id) filter (where ((coalesce(e.points, 0) >= 10)::int + (coalesce(e.treb, 0) >= 10)::int + (coalesce(e.assists, 0) >= 10)::int) = 3))::int as td
from analytics.bb_team_roster_v1 ro
left join analytics.bb_player_game_enriched_v1 e
  on e.player_slug = ro.player_slug and e.season_label <= ro.season_label
group by ro.season_label, ro.team_slug, ro.player_slug;

create or replace view analytics.el_player_double_v1 as
select p.competition,
       p.season_label,
       p.team_code as team_slug,
       p.person_code as player_slug,
       count(*)::int as games,
       (count(*) filter (where ((coalesce(p.points, 0) >= 10)::int + (coalesce(p.treb, 0) >= 10)::int + (coalesce(p.assists, 0) >= 10)::int) >= 2))::int as dd,
       (count(*) filter (where ((coalesce(p.points, 0) >= 10)::int + (coalesce(p.treb, 0) >= 10)::int + (coalesce(p.assists, 0) >= 10)::int) = 3))::int as td
from euroleague.player_match_stats p
group by p.competition, p.season_label, p.team_code, p.person_code;

grant select on analytics.bb_player_double_v1, analytics.bb_player_double_roster_v1, analytics.el_player_double_v1 to authenticated;
grant select on analytics.bb_player_double_v1, analytics.bb_player_double_roster_v1, analytics.el_player_double_v1 to service_role;

insert into basketball.model_config (key, value, note)
select v.key, v.value, v.note
from (values
  ('dd_corr_pr', 0.30::numeric, 'Double-double simulasyonu: sayi-ribaund korelasyonu'),
  ('dd_corr_pa', 0.18::numeric, 'Double-double simulasyonu: sayi-asist korelasyonu'),
  ('dd_corr_ra', 0.17::numeric, 'Double-double simulasyonu: ribaund-asist korelasyonu')
) as v(key, value, note)
where not exists (select 1 from basketball.model_config m where m.key = v.key);

notify pgrst, 'reload schema';
