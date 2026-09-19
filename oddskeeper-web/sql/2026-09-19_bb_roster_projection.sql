-- 2026-09-19: Match-Player Tools icin SEZON KADROSU projeksiyonu.
--
-- SORUN: Player Dist oyuncu havuzu mac satirlarindan turuyor (sezon+takim+oyuncu). Yeni
-- sezonun ilk haftalarinda (a) o sezonun maci yok -> havuz bos, (b) gecen sezonun havuzu
-- ESKI kadroyu gosterir: transfer olanlar eski takiminda, ayrilanlar hala listede.
--
-- COZUM: uyelik basketball.team_rosters'tan (sync_bsl_rosters.py + TBF scraper yazar),
-- rakamlar oyuncunun O SEZON + ONCEKI sezonlardaki TUM maclarindan (hangi takimda
-- oynadigindan bagimsiz). Cikti kolonlari bb_player_metric_window_v1 / bb_player_role_v1
-- ile AYNI sekilde -> frontend bileseni degismeden ayni veriyi tuketir.
--   * "son 5 / son 10" en yeni maclardan: sezon desc, hafta desc (excel match_date'lerinde
--     gun/ay takasi oldugundan tarih yalniz esitlik bozucu).
--   * Ligde hic maci olmayan kadro oyuncusu da listelenir (games=0) -> trader tum kadroyu
--     gorur, degeri elle girer.
-- Refresh: sync_bsl_rosters.py --apply ve fetch_tbf_bsl.py yukleme sonu.

create or replace view analytics.bb_team_roster_v1 as
select r.season_label, r.team_slug, coalesce(t.team_name, r.team_slug) as team_name,
       r.player_slug, p.player_name, p.position, p.sofascore_player_id,
       r.source, r.confirmed
from basketball.team_rosters r
join basketball.players p on p.player_slug = r.player_slug
left join basketball.teams t on t.team_slug = r.team_slug;

grant select on analytics.bb_team_roster_v1 to authenticated, service_role;

drop materialized view if exists analytics.bb_player_metric_window_roster_v1;

create materialized view analytics.bb_player_metric_window_roster_v1 as
with mk(market_key, market_label) as (
  values ('points','Sayı'), ('rebounds','Ribaund'), ('oreb','Hücum Ribaund'), ('dreb','Savunma Ribaund'),
         ('assists','Asist'), ('threes','3 Sayı'), ('twos','2 Sayı'), ('ftm','Serbest Atış'),
         ('steals','Top Çalma'), ('blocks','Blok'), ('turnovers','Top Kaybı'), ('pra','Sayı+Rib+Asist'),
         ('pa','Sayı+Asist'), ('pr','Sayı+Ribaund'), ('fgmadepct','İsabet %'), ('ftpct','Serbest %')
),
pu as (
  select ro.season_label as roster_season, ro.player_slug,
         e.season_label as game_season, e.week, e.match_date, e.minutes,
         m.market_key, m.val
  from analytics.bb_team_roster_v1 ro
  join analytics.bb_player_game_enriched_v1 e
    on e.player_slug = ro.player_slug and e.season_label <= ro.season_label
  cross join lateral (values
    ('points',    coalesce(e.points,0)::numeric),
    ('rebounds',  coalesce(e.treb,0)::numeric),
    ('oreb',      coalesce(e.oreb,0)::numeric),
    ('dreb',      coalesce(e.dreb,0)::numeric),
    ('assists',   coalesce(e.assists,0)::numeric),
    ('threes',    coalesce(e.fg3m,0)::numeric),
    ('twos',      coalesce(e.fg2m,0)::numeric),
    ('ftm',       coalesce(e.ftm,0)::numeric),
    ('steals',    coalesce(e.steals,0)::numeric),
    ('blocks',    coalesce(e.blocks,0)::numeric),
    ('turnovers', coalesce(e.turnovers,0)::numeric),
    ('pra',       (coalesce(e.points,0) + coalesce(e.treb,0) + coalesce(e.assists,0))::numeric),
    ('pa',        (coalesce(e.points,0) + coalesce(e.assists,0))::numeric),
    ('pr',        (coalesce(e.points,0) + coalesce(e.treb,0))::numeric),
    ('fgmadepct', case when coalesce(e.fg2a,0) + coalesce(e.fg3a,0) > 0
                       then (coalesce(e.fg2m,0) + coalesce(e.fg3m,0))::numeric
                            / (coalesce(e.fg2a,0) + coalesce(e.fg3a,0))::numeric * 100 end),
    ('ftpct',     case when coalesce(e.fta,0) > 0 then coalesce(e.ftm,0)::numeric / e.fta::numeric * 100 end)
  ) m(market_key, val)
),
ranked as (
  select pu.*, row_number() over (
           partition by roster_season, player_slug, market_key
           order by game_season desc, week desc nulls last, match_date desc nulls last) as rn
  from pu
),
agg as (
  select roster_season, player_slug, market_key,
         count(*)                                          as games,
         count(*) filter (where game_season = roster_season) as games_current,
         round(avg(coalesce(minutes,0)), 1)                as avg_minutes,
         round(avg(val), 2)                                as season_avg,
         round(avg(val) filter (where rn <= 5), 2)         as last5_avg,
         round(avg(val) filter (where rn <= 10), 2)        as last10_avg,
         round(coalesce(stddev_samp(val), 0), 2)           as calc_std,
         round(sum(val), 1)                                as total
  from ranked group by roster_season, player_slug, market_key
)
select ro.season_label,
       'Basketbol Süper Ligi'::text        as competition,
       ro.player_slug, ro.player_name, ro.team_slug, ro.team_name,
       mk.market_key, mk.market_label,
       coalesce(a.games, 0)                as games,
       coalesce(a.games_current, 0)        as games_current,
       coalesce(a.avg_minutes, 0)          as avg_minutes,
       coalesce(a.season_avg, 0)           as season_avg,
       a.last5_avg, a.last10_avg,
       coalesce(a.calc_std, 0)             as calc_std,
       coalesce(a.total, 0)                as total
from analytics.bb_team_roster_v1 ro
cross join mk
left join agg a on a.roster_season = ro.season_label and a.player_slug = ro.player_slug
               and a.market_key = mk.market_key;

create unique index ux_bb_player_window_roster
  on analytics.bb_player_metric_window_roster_v1 (season_label, player_slug, market_key);

grant select on analytics.bb_player_metric_window_roster_v1 to authenticated, service_role;

-- Kadro rolu: dakika-tabanli (starter/rotation/limited/garbage) oyuncunun gecmis maclarindan;
-- 'departed'/'euro_focus' gibi sezon-ici durum rolleri yeni sezona TASINMAZ.
--   origin    : returning (gecen sezon en cok bu takimda oynadi) | transfer (baska BSL takimi)
--               | new (ligde hic maci yok)
--   prev_team : gecen sezonlarda en cok mac oynadigi takim (transfer rozetinde gosterilir)
create or replace view analytics.bb_player_role_roster_v1 as
with cfg as (
  select
    coalesce(max(value) filter (where key='role_starter_min'),  22)  as starter_min,
    coalesce(max(value) filter (where key='role_rotation_min'), 14)  as rotation_min,
    coalesce(max(value) filter (where key='role_bench_min'),     8)  as bench_min,
    coalesce(max(value) filter (where key='role_avail_share'), 0.5)  as avail_share
  from basketball.model_config
),
g as (
  select ro.season_label, ro.player_slug, e.team_slug as game_team, max(e.team_name) as game_team_name,
         count(*) as games, sum(coalesce(e.minutes,0)) as minutes,
         count(*) filter (where e.season_label = ro.season_label) as games_current
  from analytics.bb_team_roster_v1 ro
  join analytics.bb_player_game_enriched_v1 e
    on e.player_slug = ro.player_slug and e.season_label <= ro.season_label
  group by ro.season_label, ro.player_slug, e.team_slug
),
tot as (
  select season_label, player_slug, sum(games) as games, sum(games_current) as games_current,
         round(sum(minutes) / nullif(sum(games), 0), 1) as avg_minutes,
         (array_agg(game_team      order by games desc))[1] as prev_team_slug,
         (array_agg(game_team_name order by games desc))[1] as prev_team_name,
         max(games) as prev_team_player_games
  from g group by season_label, player_slug
),
tg as (
  select team_slug, max(n) as team_games
  from (select season_label, team_slug, count(*) as n from basketball.team_match_stats group by 1, 2) x
  group by team_slug
)
select ro.season_label, ro.team_slug, ro.player_slug, ro.player_name, ro.position,
       coalesce(t.games, 0)        as games,
       coalesce(t.games_current,0) as games_current,
       coalesce(t.avg_minutes, 0)  as avg_minutes,
       exists (select 1 from euroleague.team_bsl_link tl where tl.bsl_team_slug = ro.team_slug) as euro_team,
       case
         when coalesce(t.games, 0) = 0 then 'newcomer'
         when t.avg_minutes >= cfg.starter_min
              and t.games >= cfg.avail_share * coalesce(tg.team_games, 30) then 'starter'
         when t.avg_minutes >= cfg.rotation_min then 'rotation'
         when t.avg_minutes >= cfg.bench_min    then 'limited'
         else 'garbage'
       end as role,
       ro.sofascore_player_id,
       case when coalesce(t.games, 0) = 0 then 'new'
            when t.prev_team_slug = ro.team_slug then 'returning'
            else 'transfer' end as origin,
       case when t.prev_team_slug is distinct from ro.team_slug then t.prev_team_slug end as prev_team_slug,
       case when t.prev_team_slug is distinct from ro.team_slug then t.prev_team_name end as prev_team_name,
       ro.source, ro.confirmed
from analytics.bb_team_roster_v1 ro
cross join cfg
left join tot t on t.season_label = ro.season_label and t.player_slug = ro.player_slug
left join tg on tg.team_slug = t.prev_team_slug;

grant select on analytics.bb_player_role_roster_v1 to authenticated, service_role;

notify pgrst, 'reload schema';
