-- 2026-08-07: Takim notlari (team_notes).
-- Kullanicilarin takimlar hakkinda elle bilgi/not girip goruntuledigi tablo.
-- Notlar takim slug'ina bagli; boylece takim profilinde eklenen not Match
-- Stats Model ekraninda da gorunur (slug uzayi her iki yuzeyde ortak).
--
-- Guvenlik modeli (direct_access_users deseninin aynisi):
--   - Tabloya SADECE service role erisir (server API route'lari).
--   - RLS acik, hicbir policy yok; anon/authenticated grant'lari cekildi.
--   - Okuma dahil tum erisim /api/team-notes uzerinden yapilir; her istek
--     once oturumu dogrular. Yazar adi (alias) cozumu ve sahiplik/admin
--     kontrolu tamamen server tarafinda kalir.

create table if not exists public.team_notes (
  id uuid primary key default gen_random_uuid(),
  team_slug text not null,
  body text not null check (char_length(body) between 1 and 2000),
  -- Notu yazan kullanici; hesabi silinirse notlari da silinir.
  author_id uuid not null references auth.users(id) on delete cascade,
  -- Yazi anindaki passwordless alias (yoksa e-postanin @ oncesi). Snapshot:
  -- alias sonradan degisse bile not eski adi gosterir.
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_notes_team_slug_idx on public.team_notes (team_slug);
create index if not exists team_notes_author_id_idx on public.team_notes (author_id);

alter table public.team_notes enable row level security;

-- Policy yok: RLS her istegi reddeder, sadece service role bypass eder.
revoke all on public.team_notes from anon, authenticated;
