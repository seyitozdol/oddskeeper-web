-- 2026-09-18: takim kart toplamlari sahada-gorulen kuralina cekildi (sahip karari;
-- Kasimpasa-Konyaspor vakasi: ev 4 gorunuyordu, 1'i teknik direktor sarisiydi).
-- Kural: summary_yellow/red_cards + card_total YALNIZ sahada-gorulen OYUNCU
-- kartlarini sayar; TD/gorevli kartlari ve bench/cikmis-oyuncu kartlari haric.
-- Ileri kosu tarafi load_sofascore_team_stats.build_team_rows'ta duzeltildi
-- (ayni commit); bu dosya GECMIS source='sofascore' satirlarini hizalar.

-- A) Oyuncu-kart satiri olan takim-maclar: on_pitch sayimina esitle
--    (uygulama gunu 557 satir: fark cogunlukla +1/+2 = bench + TD kartlari;
--    8 negatif fark = bayat team satiri, kart tablosu daha taze).
update football.match_team_stats t
   set summary_yellow_cards = pc.y,
       summary_red_cards    = pc.r,
       sofascore_extras     = jsonb_set(coalesce(t.sofascore_extras, '{}'::jsonb),
                                        '{card_total}', to_jsonb(pc.y + 2 * pc.r))
  from (select source_match_id, source_team_id,
               count(*) filter (where card_class = 'yellow' and on_pitch)                as y,
               count(*) filter (where card_class in ('red', 'yellowRed') and on_pitch)   as r
          from football.match_player_cards
         where source = 'sofascore'
         group by 1, 2) pc
 where t.source = 'sofascore'
   and t.source_match_id = pc.source_match_id
   and t.source_team_id  = pc.source_team_id
   and (t.summary_yellow_cards is distinct from pc.y
     or t.summary_red_cards    is distinct from pc.r);

-- B) TD/gorevli-only vakalar: takimin HIC oyuncu-kart satiri yok ama team>0
--    (uygulama gunu 19 satir, hepsi tek kart). Guvence: ayni macta kart
--    tablosunda satir olmasi = macin kart olaylari islenmis; o halde bu
--    takimin tum "karti" player'siz (TD/gorevli) olaylardan gelmistir -> 0.
update football.match_team_stats t
   set summary_yellow_cards = 0,
       summary_red_cards    = 0,
       sofascore_extras     = jsonb_set(coalesce(t.sofascore_extras, '{}'::jsonb),
                                        '{card_total}', to_jsonb(0))
 where t.source = 'sofascore'
   and (t.summary_yellow_cards > 0 or t.summary_red_cards > 0)
   and not exists (select 1 from football.match_player_cards c
                    where c.source = 'sofascore'
                      and c.source_match_id = t.source_match_id
                      and c.source_team_id  = t.source_team_id)
   and exists (select 1 from football.match_player_cards c2
                where c2.source = 'sofascore'
                  and c2.source_match_id = t.source_match_id);
