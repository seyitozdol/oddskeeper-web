-- 2026-09-19: BSL kimlik omurgasi (26/27 sezon gecisi).
--
-- SORUN: fetch_tbf_bsl.py oyuncuyu yalniz tbf_player_id, takimi yalniz TBF adinin
-- slug'i ile ariyordu. Mevcut 300 oyuncu + 16 takimda tbf id BOS (excel_v38 kokenli)
-- -> 26/27 ilk scrape'inde donen HER oyuncu yeni slug alir (gecmisi kopar), sponsorlu
-- TBF takim adi ("Besiktas GAIN") yeni takim acardi.
--
-- COZUM (pipeline/src/basketball/identity.py ile birlikte):
--   1) Kimlik bir kez kurulur, id olarak saklanir, bir daha isimle eslenmez.
--      players: realgm_player_id + birth_date (soyad+dogum tarihi = gri eslesmelerin
--      tek guvenilir ayiricisi; 2026-09-19 olcumunde 6/6). teams: sofascore/realgm id.
--   2) Otomatik baglanamayan kimlikler SESSIZCE yeni slug almaz; identity_review
--      kuyruguna duser (scraper calismaya devam eder, insan sonradan birlestirir:
--      analytics.bb_pm_player_merges alias->canonical mekanizmasi zaten var).
--
-- Additive/guvenli: kolonlar nullable, mevcut veri etkilenmez.

alter table basketball.players
  add column if not exists realgm_player_id bigint,
  add column if not exists birth_date date;
create index if not exists ix_bb_players_realgm on basketball.players(realgm_player_id)
  where realgm_player_id is not null;

alter table basketball.teams
  add column if not exists sofascore_team_id bigint,
  add column if not exists realgm_team_id bigint;

create table if not exists basketball.identity_review (
  id bigserial primary key,
  kind text not null check (kind in ('player', 'team')),
  source text not null default 'tbf_api',
  source_id bigint not null,
  source_name text,
  team_slug text,
  season_label text,
  assigned_slug text not null,
  reason text not null,
  candidates jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (kind, source, source_id)
);

-- Yalniz pipeline (postgres/service role) erisir: RLS acik, policy yok.
alter table basketball.identity_review enable row level security;
revoke all on basketball.identity_review from anon, authenticated;

-- Sezon kadrosu ("kim nerede"). Analitik view'lar takim uyeligini MAC satirlarindan turetir;
-- sezon oynanmadan once (ve transferde) guncel kadronun yazilabilecegi yer yoktu
-- (basketball.players.team_slug'i hicbir view/sayfa okumuyor). Oyuncu sezonda TEK satir
-- = guncel takimi; sezon ici transferde satir guncellenir. Yazan: sync_bsl_rosters.py.
--   source    : 'realgm' | 'sofascore' | 'manual'
--   confirmed : iki kaynak ayni takimi soyluyor (ya da elle onay)
create table if not exists basketball.team_rosters (
  season_label text not null,
  player_slug text not null references basketball.players(player_slug) on update cascade,
  team_slug text not null,
  source text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_label, player_slug)
);
create index if not exists ix_bb_team_rosters_team on basketball.team_rosters(season_label, team_slug);

alter table basketball.team_rosters enable row level security;
revoke all on basketball.team_rosters from anon, authenticated;
