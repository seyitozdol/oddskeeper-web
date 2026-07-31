-- Basketbol Katılım Araçları kalıcı tabloları (football pm_* kalıbı).
-- RLS açık, permissive policy (anon+authenticated ALL using/with-check true). Dashboard
-- kullanıcısı authenticated rolüyle yazar. league='basketball'.

-- ============================================================
-- Market kataloğu (yerleşik seed + özel; template + sabit std + tip + model bayrağı)
-- ============================================================
create table if not exists analytics.bb_pm_markets (
  league       text not null default 'basketball',
  market_key   text not null,
  label        text not null,
  template_id  text,
  std          numeric,
  is_custom    boolean not null default false,
  market_type  text not null default 'static',   -- static | participant
  in_model     boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (league, market_key)
);

-- ============================================================
-- Elle fikstürler (şimdilik kullanıcı ekler; external_id = platform fikstür ID'si)
-- ============================================================
create table if not exists analytics.bb_pm_fixtures (
  id             bigint generated always as identity primary key,
  league         text not null default 'basketball',
  home_team_slug text not null,
  away_team_slug text not null,
  home_team_name text,
  away_team_name text,
  external_id    text,
  match_date     date,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- Oyuncu external (participant) ID'leri
-- ============================================================
create table if not exists analytics.bb_pm_player_ids (
  league      text not null default 'basketball',
  player_slug text not null,
  external_id text,
  updated_at  timestamptz not null default now(),
  primary key (league, player_slug)
);

-- RLS + permissive policy + grants
do $$
declare tbl text;
begin
  foreach tbl in array array['bb_pm_markets','bb_pm_fixtures','bb_pm_player_ids'] loop
    execute format('alter table analytics.%I enable row level security', tbl);
    execute format('drop policy if exists %I on analytics.%I', tbl||'_all', tbl);
    execute format('create policy %I on analytics.%I for all to anon, authenticated using (true) with check (true)', tbl||'_all', tbl);
    execute format('grant select, insert, update, delete on analytics.%I to anon, authenticated', tbl);
  end loop;
end $$;

-- ============================================================
-- Yerleşik market seed (Excel PlayerCalc markets + sabit std)
-- ============================================================
insert into analytics.bb_pm_markets (league, market_key, label, template_id, std, is_custom, market_type, in_model, sort_order) values
  ('basketball','points',    'Sayı',           'PPOINTS',   5.79, false, 'static', true, 1),
  ('basketball','rebounds',  'Ribaund',        'PREB',      3.25, false, 'static', true, 2),
  ('basketball','assists',   'Asist',          'PAST',      3.28, false, 'static', true, 3),
  ('basketball','threes',    '3 Sayı',         'P3PTM',     1.75, false, 'static', true, 4),
  ('basketball','twos',      '2 Sayı',         'P2PTSM',    3.25, false, 'static', true, 5),
  ('basketball','ftm',       'Serbest Atış',   'PFTRWM',    2.75, false, 'static', true, 6),
  ('basketball','steals',    'Top Çalma',      'PSTL',      1.75, false, 'static', true, 7),
  ('basketball','blocks',    'Blok',           'PBLCK',     1.75, false, 'static', true, 8),
  ('basketball','turnovers', 'Top Kaybı',      'PTURNOVR',  1.75, false, 'static', true, 9),
  ('basketball','pr',        'Sayı+Ribaund',   'PPTSREB',   8,    false, 'static', true, 10),
  ('basketball','pa',        'Sayı+Asist',     'PPTSAST',   8,    false, 'static', true, 11),
  ('basketball','pra',       'Sayı+Rib+Asist', 'PPTSRBAST', 8,    false, 'static', true, 12),
  ('basketball','fgmadepct', 'İsabet %',       'PFGLSM',    7,    false, 'static', true, 13),
  ('basketball','ftpct',     'Serbest %',      'PTFTRWM',   11.3, false, 'static', true, 14)
on conflict (league, market_key) do nothing;
