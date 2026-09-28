-- 2026-09-28: euroleague.player_bsl_link -> basketball.players FK + alias bag duzeltmesi.
--
-- SORUN: player_bsl_link.bsl_player_slug'in basketball.players'a FK'si yoktu. BSL tarafinda
-- bir mukerrer profil birlestirilip slug'i silindiginde (bb_pm_player_merges + players satiri
-- silme; 2026-09-28'de 6 slug boyle silindi) ona bagli EL/EC bagi SESSIZCE yetim kalirdi:
-- EL oyuncu sayfasi olmayan BSL profiline yonlenir ("noData"), BSL profilinde EL/EC seridi
-- kaybolur, kimse fark etmez.
--
-- COZUM (pipeline/src/basketball/match_euroleague_bsl.py ile birlikte):
--   (a) 2 bag alias slug'a bakiyordu (merge'ler bagdan SONRA eklendi, 2026-08-02). View'larin
--       cogu slug'i ham karsilastirir (bsl_player_euro_*_v1, el_player_leaderboard_v1,
--       bb_player_role_v1 ea CTE) -> Shane Larkin ana profilinde EL verisi yoktu. Bag her zaman
--       KANONIK slug'i tutmali; baglayici artik her turda alias'i kanonige cevirir, burada bir
--       kez elle.
--   (b) FK: bagli bir slug'i silmek artik YUKSEK SESLE hata verir (once bag kanonige tasinmali);
--       slug yeniden adlandirilirsa ON UPDATE CASCADE bagi tasir. team_rosters /
--       player_source_ids ile ayni kalip.
--   (c) match_source sozlugu: 'auto' (eski toplu esleme), 'auto-bd' (T1 dogum tarihi + soyad),
--       'auto-name' (T2 soyad + ad oneki), 'manual' (MANUAL_LINKS).
--
-- On-kontrol (salt-okunur, 2026-09-28 calistirildi):
--   hedef anahtar: basketball.players PRIMARY KEY (player_slug)  [players_pkey]
--     select conname, pg_get_constraintdef(oid) from pg_constraint
--      where conrelid = 'basketball.players'::regclass and contype in ('p', 'u');
--   yetim bag: 0 satir (FK eklenebilir)
--     select l.person_code, l.bsl_player_slug from euroleague.player_bsl_link l
--       left join basketball.players p on p.player_slug = l.bsl_player_slug
--      where p.player_slug is null;
--   alias bag: 2 satir, ikisinin de kanonigi mevcut
--     (007200 deshane-davis-larkin -> shane-larkin, 011251 caleb-homesley -> caleb-homesly)
--     select l.person_code, l.bsl_player_slug, m.canonical_slug from euroleague.player_bsl_link l
--       join analytics.bb_pm_player_merges m on m.alias_slug = l.bsl_player_slug and m.league = 'basketball';
--   match_source: 76/76 'auto' (CHECK'i ihlal eden yok); ayni slug'a iki kisi bagli: 0
--
-- Idempotent: tekrar calistirmak zararsiz. Grant degisikligi YOK.
-- EL/EC baglayicisi (match_euroleague_bsl.py) kosarken ALTER kilit bekleyebilir: lock_timeout
-- kisa tutuldu, zaman asiminda bir dakika sonra tekrar calistir.

begin;
set local lock_timeout = '5s';

-- (a) alias -> kanonik (kanonigi players'ta olan ve baska kisiye bagli olmayanlar)
update euroleague.player_bsl_link l
   set bsl_player_slug = m.canonical_slug
  from analytics.bb_pm_player_merges m
 where m.league = 'basketball'
   and m.alias_slug = l.bsl_player_slug
   and exists (select 1 from basketball.players p where p.player_slug = m.canonical_slug)
   and not exists (select 1 from euroleague.player_bsl_link o
                    where o.bsl_player_slug = m.canonical_slug and o.person_code <> l.person_code);

-- (b) FK (NO ACTION on delete: bagli slug silinemez; rename cascade)
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'euroleague.player_bsl_link'::regclass
                    and conname = 'player_bsl_link_bsl_player_slug_fkey') then
    alter table euroleague.player_bsl_link
      add constraint player_bsl_link_bsl_player_slug_fkey
      foreign key (bsl_player_slug) references basketball.players(player_slug) on update cascade;
  end if;
end $$;

-- FK kolonu: players'ta silme/rename kontrolu ve view join'leri icin
create index if not exists ix_el_player_bsl_link_slug on euroleague.player_bsl_link(bsl_player_slug);

-- (c) match_source sozlugu
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'euroleague.player_bsl_link'::regclass
                    and conname = 'player_bsl_link_match_source_check') then
    alter table euroleague.player_bsl_link
      add constraint player_bsl_link_match_source_check
      check (match_source in ('auto', 'auto-bd', 'auto-name', 'manual'));
  end if;
end $$;

commit;

-- Son kontrol (beklenen: 0 satir, 0 satir):
--   select * from euroleague.player_bsl_link l
--     join analytics.bb_pm_player_merges m on m.alias_slug = l.bsl_player_slug and m.league = 'basketball';
--   select l.* from euroleague.player_bsl_link l
--     left join basketball.players p on p.player_slug = l.bsl_player_slug where p.player_slug is null;
