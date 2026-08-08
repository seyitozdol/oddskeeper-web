-- 2026-08-08: Model export gecmisi (model_export_history) + saklama ayari.
--
-- Amac: Match Stats Model, Player Stats Model, basketbol ve voleybol
-- araclarinda kullanici bir maci Excel'e "yazdir" (export) ettiginde, o an
-- girilen degerlerin bir snapshot'i kaydedilir. Boylece maci sonradan
-- duzeltmek/guncellemek isteyen kisi onceki durumu geri cagirabilir.
-- ONEMLI: Kayit SADECE export aninda olusur (Add to Input'ta degil), cunku
-- eklenip vazgecilen durumlar kalici olmamali.
--
-- Guvenlik modeli (team_notes deseninin aynisi):
--   - Tablolara SADECE service role erisir (server API route'lari).
--   - RLS acik, hicbir policy yok; anon/authenticated grant'lari cekildi.
--   - Okuma dahil tum erisim /api/model-history uzerinden yapilir; her istek
--     once oturumu dogrular. Giren kullanicinin adi (alias) server tarafinda
--     cozulup author_name'e snapshot olarak yazilir.

-- ── Export gecmisi ─────────────────────────────────────────────────────────
create table if not exists public.model_export_history (
  id uuid primary key default gen_random_uuid(),
  -- Hangi arac: football_msm | football_psm | basketball | volleyball
  sport text not null,
  -- Lig/kaynak: tsl | tff1 | bsl | euroleague | eurocup | vnl ...
  league text not null,
  -- Satir turu: match | team | player (araca gore)
  kind text not null default 'match',
  -- Export edilen maca ait dis fixture id (Bets10 event id vb.), bilgi amacli.
  fixture_ext_id text,
  -- "Home - Away" gibi okunur mac etiketi (dropdown gosterimi icin).
  match_label text not null,
  -- Market etiketi: Shot | SOT | Foul ... (dropdown gosterimi icin).
  market text not null,
  -- Ekranin o anki tam girdi state'i; restore bundan yeniden kurulur.
  snapshot jsonb not null,
  -- Export eden kullanici; hesabi silinirse kayitlari da silinir. Dev/bypass
  -- ortaminda oturum kullanicisi olmayabilir, bu yuzden nullable.
  author_id uuid references auth.users(id) on delete cascade,
  -- Export anindaki passwordless alias (yoksa e-postanin @ oncesi). Snapshot:
  -- alias sonradan degisse bile kayit eski adi gosterir.
  author_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists model_export_history_lookup_idx
  on public.model_export_history (sport, league, created_at desc);
create index if not exists model_export_history_author_idx
  on public.model_export_history (author_id);

alter table public.model_export_history enable row level security;

-- Policy yok: RLS her istegi reddeder, sadece service role bypass eder.
revoke all on public.model_export_history from anon, authenticated;

-- ── Saklama ayari (spor bazinda) ───────────────────────────────────────────
-- Her spor/lig icin kac gun saklanacagi. UI her aracin Config sekmesinde
-- gorunur ama depolama burada tek tip; boylece API silme icin tek yerden okur.
create table if not exists public.model_history_config (
  sport text not null,
  league text not null,
  retention_days int not null default 30 check (retention_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  primary key (sport, league)
);

alter table public.model_history_config enable row level security;
revoke all on public.model_history_config from anon, authenticated;
