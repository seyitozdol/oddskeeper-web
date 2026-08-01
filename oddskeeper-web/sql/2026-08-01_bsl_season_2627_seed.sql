-- BSL sezon katılımcıları + takım-merkezli standings (2026-2027 seed).
-- basketball.teams sezon-BAZLI DEĞİL (team_slug PK) → sezon başına katılımcı listesi
-- ayrı tabloda. bb_team_standings_v1 katılımcı-merkezli: oynanmamış sezonda (2026-2027)
-- takımlar 0-değerle görünür. Frontend hub bunu sezon-duyarlı okur.

create table if not exists basketball.season_participants (
  season_label text not null,
  team_slug    text not null,
  team_name    text,
  created_at   timestamptz not null default now(),
  primary key (season_label, team_slug)
);

-- 2025-2026: mevcut standings'ten (gerçek katılımcılar)
insert into basketball.season_participants (season_label, team_slug, team_name)
select season_label, team_slug, team_name
from analytics.bb_team_season_stats_v1 where season_label = '2025-2026'
on conflict (season_label, team_slug) do nothing;

-- 2026-2027: şimdilik 2025-2026 takımları (yer tutucu; Türk takımları hem BSL hem
-- Avrupa oynar). Gerçek yeni-sezon kadrosu belli olunca güncellenir.
insert into basketball.season_participants (season_label, team_slug, team_name)
select '2026-2027', team_slug, team_name
from analytics.bb_team_season_stats_v1 where season_label = '2025-2026'
on conflict (season_label, team_slug) do nothing;

grant select on basketball.season_participants to anon, authenticated;

-- Katılımcı-merkezli standings (BktTeamSeasonRow şeklinde)
create or replace view analytics.bb_team_standings_v1 as
select
  sp.season_label,
  s.competition,
  sp.team_slug,
  sp.team_name,
  coalesce(s.games,0)  as games,
  coalesce(s.wins,0)   as wins,
  coalesce(s.losses,0) as losses,
  s.win_pct, s.ppg, s.oppg, s.point_diff,
  s.rpg, s.orpg, s.drpg, s.apg, s.spg, s.bpg, s.topg,
  s.fg_pct, s.fg2_pct, s.fg3_pct, s.ft_pct, s.efg_pct,
  s.pace, s.off_rtg, s.def_rtg, s.net_rtg,
  rank() over (partition by sp.season_label
               order by coalesce(s.wins,0) desc, coalesce(s.point_diff,0) desc) as standings_rank
from basketball.season_participants sp
left join analytics.bb_team_season_stats_v1 s
  on s.season_label = sp.season_label and s.team_slug = sp.team_slug;

grant select on analytics.bb_team_standings_v1 to anon, authenticated;
