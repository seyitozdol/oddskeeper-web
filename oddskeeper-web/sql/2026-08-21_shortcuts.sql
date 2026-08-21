-- 2026-08-21: Header Shortcuts menusu (public.shortcuts).
-- Header'daki Shortcuts ikonuna hover'da acilan dis-site kisayollari
-- (TransferMarkt, WhoScored, SofaScore, ...). Admin panelindeki ShortCuts
-- sekmesinden yonetilir (ekle/duzenle/sil).
--
-- Guvenlik modeli (team_notes deseninin aynisi):
--   - Tabloya SADECE service role erisir (server API route'lari).
--   - RLS acik, hicbir policy yok; anon/authenticated grant'lari cekildi.
--   - Okuma /api/shortcuts (oturum sart), yazma /api/admin/shortcuts (admin).

create table if not exists public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (char_length(url) between 1 and 500),
  -- Logo goruntu adresi (favicon vb.); bos birakilabilir.
  logo_url text check (logo_url is null or char_length(logo_url) between 1 and 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shortcuts enable row level security;

-- Policy yok: RLS her istegi reddeder, sadece service role bypass eder.
revoke all on public.shortcuts from anon, authenticated;

-- Baslangic kisayollari (idempotent: ayni isim varsa eklenmez). Logolar
-- Google favicon servisinden; admin panelinden istenen adresle degistirilebilir.
insert into public.shortcuts (name, url, logo_url, sort_order)
select v.name, v.url, v.logo_url, v.sort_order
from (values
  ('TransferMarkt', 'https://www.transfermarkt.com.tr/', 'https://www.google.com/s2/favicons?domain=transfermarkt.com&sz=64', 10),
  ('WhoScored',     'https://www.whoscored.com/',        'https://www.google.com/s2/favicons?domain=whoscored.com&sz=64', 20),
  ('SofaScore',     'https://www.sofascore.com/',        'https://www.google.com/s2/favicons?domain=sofascore.com&sz=64', 30),
  ('FlashScore',    'https://www.flashscore.com.tr/',    'https://www.google.com/s2/favicons?domain=flashscore.com.tr&sz=64', 40),
  ('BmBets',        'https://bmbets.com/',               'https://www.google.com/s2/favicons?domain=bmbets.com&sz=64', 50),
  ('TFF',           'https://www.tff.org/',              'https://www.google.com/s2/favicons?domain=tff.org&sz=64', 60),
  ('TBF',           'https://www.tbf.org.tr/',           'https://www.google.com/s2/favicons?domain=tbf.org.tr&sz=64', 70)
) as v(name, url, logo_url, sort_order)
where not exists (select 1 from public.shortcuts s where s.name = v.name);

-- Menu HERKESE acik baslar: kisitli (explicit) erisim listesi olan mevcut
-- kullanicilarin listesine "shortcuts" anahtarini ekle. NULL (tam erisim)
-- kullanicilar zaten gorur; admin istedigi kullanicidan sonradan kaldirabilir.
update public.user_nav_permissions
set allowed_keys = allowed_keys || '{shortcuts}',
    updated_at = now()
where allowed_keys is not null
  and not ('shortcuts' = any(allowed_keys));

notify pgrst, 'reload schema';
