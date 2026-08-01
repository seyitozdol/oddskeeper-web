-- Match-Player Tools "Config" sekmesi: market basina line-uretim kurallari.
-- Hem oyuncu (14) hem takim (33 = Home/Away/Total x 11 metrik) marketleri.
-- Frontend-writable (bb_pm_* kalibi: RLS + permissive policy + grant anon/authenticated).
-- Line uretimi (odds.buildConfiguredLines) bu kurallari uygular:
--   lines: acilacak toplam cizgi; under_lines: alttan kac cizgide Under acik;
--   payback: null=grup varsayilani (oyuncu 0.915 / takim 0.96); round_odds: oran yuvarla;
--   max_lines: ust sinir; odds_cap: max oran; skip_after: skip'ten once ardisik cizgi
--   (>=lines => skip yok); skip_step: skip sonrasi adim (main +1..+skip_after ardisik, sonra +skip_step).

create table if not exists analytics.bb_pm_market_config (
  league        text    not null default 'basketball',
  market_group  text    not null,              -- 'player' | 'team'
  market_key    text    not null,              -- player: 'points'; team: 'home_points'
  label         text,
  base_metric   text,                          -- line'i suren istatistik (player=market_key)
  side          text,                          -- team: 'home'|'away'|'total'; player: null
  template_id   text,
  std           numeric,
  lines         int     not null default 5,
  under_lines   int     not null default 5,
  payback       numeric,                        -- null = grup varsayilani
  round_odds    boolean not null default false,
  max_lines     int     not null default 15,
  odds_cap      numeric not null default 999,
  skip_after    int     not null default 5,     -- >= lines => skip yok
  skip_step     int     not null default 2,
  in_model      boolean not null default true,
  sort_order    int     default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (league, market_group, market_key)
);

alter table analytics.bb_pm_market_config enable row level security;
drop policy if exists bb_pm_market_config_all on analytics.bb_pm_market_config;
create policy bb_pm_market_config_all on analytics.bb_pm_market_config for all using (true) with check (true);
grant all on analytics.bb_pm_market_config to anon, authenticated;

-- ---- OYUNCU marketleri (14) — PLAYER_MARKETS ile ayni (marketConfig.ts) ----
insert into analytics.bb_pm_market_config
  (market_group, market_key, label, base_metric, side, template_id, std, sort_order)
values
  ('player','points',   'Sayı',           'points',   null, 'PPOINTS',   5.79, 1),
  ('player','rebounds', 'Ribaund',        'rebounds', null, 'PREB',      3.25, 2),
  ('player','assists',  'Asist',          'assists',  null, 'PAST',      3.28, 3),
  ('player','threes',   '3 Sayı',         'threes',   null, 'P3PTM',     1.75, 4),
  ('player','twos',     '2 Sayı',         'twos',     null, 'P2PTSM',    3.25, 5),
  ('player','ftm',      'Serbest Atış',   'ftm',      null, 'PFTRWM',    2.75, 6),
  ('player','steals',   'Top Çalma',      'steals',   null, 'PSTL',      1.75, 7),
  ('player','blocks',   'Blok',           'blocks',   null, 'PBLCK',     1.75, 8),
  ('player','turnovers','Top Kaybı',      'turnovers',null, 'PTURNOVR',  1.75, 9),
  ('player','pr',       'Sayı+Ribaund',   'pr',       null, 'PPTSREB',   8,    10),
  ('player','pa',       'Sayı+Asist',     'pa',       null, 'PPTSAST',   8,    11),
  ('player','pra',      'Sayı+Rib+Asist', 'pra',      null, 'PPTSRBAST', 8,    12),
  ('player','fgmadepct','İsabet %',       'fgmadepct',null, 'PFGLSM',    7,    13),
  ('player','ftpct',    'Serbest %',      'ftpct',    null, 'PTFTRWM',   11.3, 14)
on conflict (league, market_group, market_key) do nothing;

-- ---- TAKIM marketleri (33 = 3 taraf x 11 metrik) ----
-- template_id market_templates(team)'ten cozulur; 'Test %' yer tutucular NULL (kullanici doldurur).
insert into analytics.bb_pm_market_config
  (market_group, market_key, label, base_metric, side, template_id, std, sort_order)
select
  'team',
  s.side || '_' || m.metric,
  s.pfx || ' ' || m.label,
  m.metric,
  s.side,
  case when mt.template_code like 'Test %' then null else mt.template_code end,
  m.std,
  m.ord * 10 + s.ord
from (values ('home','Ev',1), ('away','Dep',2), ('total','Toplam',3)) s(side, pfx, ord)
cross join (values
  ('points',    'Sayı',            8.78, null,      1),
  ('rebounds',  'Toplam Ribaund',  5.84, 'TR',      2),
  ('oreb',      'Hücum Ribaund',   3,    'HR',      3),
  ('dreb',      'Savunma Ribaund', 4.1,  'SR',      4),
  ('assists',   'Asist',           4.34, 'As',      5),
  ('threes',    '3 Sayı',          3.16, '3PT',     6),
  ('twos',      '2 Sayı',          3.8,  '2PM',     7),
  ('ftm',       'Serbest Atış',    3.5,  'FT',      8),
  ('steals',    'Top Çalma',       0.9,  'Steal',   9),
  ('blocks',    'Blok',            2,    'BLK',     10),
  ('turnovers', 'Top Kaybı',       1.1,  'Turnover',11)
) m(metric, label, std, abbr, ord)
left join basketball.market_templates mt
  on mt.market_group = 'team'
 and mt.market_key = (case s.side when 'home' then 'Home' when 'away' then 'Away' else 'Total' end) || m.abbr
on conflict (league, market_group, market_key) do nothing;
