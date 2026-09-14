-- CEV EuroVolley 2026 (Kadinlar) entegrasyonu: kimlik koprusu + toggle sirasi.
-- Kaynak legacy www-old.cev.eu (ID=1573). Oyuncu kimligi CEV PlayerID uzayinda;
-- FIVB id'ye isimle eslenir, eslesmeyene sentetik fivb_id = -cev_player_id.
-- Scraper: pipeline/src/volleyball/fetch_cev_eurovolley.py

-- CEV PlayerID koprusu (bir CEV id tek oyuncuya baglanir; sonraki kosular isim
-- eslestirmesine girmeden direkt bu kolondan bulur).
alter table volleyball.players add column if not exists cev_player_id int;
create unique index if not exists idx_vb_players_cev_id
  on volleyball.players(cev_player_id) where cev_player_id is not null;

-- Turnuva toggle etiketi + sirasi: EuroVolley ayni yil icinde en once (guncel turnuva).
create or replace view analytics.vb_competitions_v1 as
select
  c.id as competition_id,
  c.comp_slug,
  c.year,
  c.gender,
  c.name,
  case c.comp_slug
    when 'volleyball-nations-league' then 'VNL ' || c.year
    when 'women-world-championship' then 'Dünya Ş. ' || c.year
    when 'volleyball-olympic-games-paris-2024' then 'Olimpiyat ' || c.year
    when 'cev-eurovolley' then 'EuroVolley ' || c.year
    else c.name
  end as short_label,
  -- toggle sirasi: yeni yil once; ayni yilda EuroVolley > VNL > Dunya S. > Olimpiyat
  (c.year * 10 + case c.comp_slug
     when 'cev-eurovolley' then 4
     when 'volleyball-nations-league' then 3
     when 'women-world-championship' then 2
     else 1 end) as sort_key
from volleyball.competitions c;

-- anon lockdown (2026-08-19): anon'a grant yasak; 2026-09-14'te sizinti revoke edildi.
grant select on analytics.vb_competitions_v1 to authenticated;
