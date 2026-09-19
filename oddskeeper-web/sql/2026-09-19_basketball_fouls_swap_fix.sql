-- 2026-09-19: excel_v38 kokenli BSL verisinde fouls_committed <-> fouls_drawn YER DEGISTIRMIS.
--
-- NASIL BULUNDU: tbf id backfill'i (backfill_tbf_player_ids.py) 25/26 TBF dokumunu DB satirlariyla
-- istatistik imzasi uzerinden esliyor. Olcum: sure + 13 sayac 4691/4691 oyuncu satirinda ve
-- 472/472 takim satirinda BIREBIR; yalniz iki faul kolonu tutmuyor ve TAKAS edilince
-- 5034/5034 oyuncu + 477/477 takim satirinda tutuyor.
-- HANGISI DOGRU: TBF 'fouls' en fazla 5 (kisisel faul siniri = YAPILAN faul), 'rivalFoul' 15'e
-- kadar (ALINAN faul). DB'de ise fouls_committed 15'e cikiyordu (313 satir > 5, imkansiz),
-- fouls_drawn en fazla 5. Yani hata excel aktarimindaki kolon etiketinde; TBF scraper
-- eslemesi (fouls -> fouls_committed, rivalFoul -> fouls_drawn) dogru.
-- ETKI: bu kolonlari hicbir ekran gostermiyor (yalniz view'larda tasiniyor); duzeltilmezse
-- 26/27 TBF verisiyle 25/26 verisi ters anlamda yan yana dururdu.
--
-- Koruma: iki kez calisirsa GERI takas etmesin -> yalniz bozuk durumda (oyuncuda yapilan
-- faul > 5 varsa) calisir. Geri alma: ayni UPDATE'leri korumasiz bir kez daha calistir.

do $$
declare bad int;
begin
  select count(*) into bad from basketball.player_match_stats
   where source = 'excel_v38' and fouls_committed > 5;
  if bad = 0 then
    raise notice 'faul kolonlari zaten dogru (yapilan faul > 5 olan satir yok), atlandi';
    return;
  end if;
  update basketball.player_match_stats
     set fouls_committed = fouls_drawn, fouls_drawn = fouls_committed
   where source = 'excel_v38';
  update basketball.team_match_stats
     set fouls_committed = fouls_drawn, fouls_drawn = fouls_committed
   where source = 'excel_v38';
  raise notice 'faul kolonlari takas edildi (% bozuk oyuncu satiri vardi)', bad;
end $$;
