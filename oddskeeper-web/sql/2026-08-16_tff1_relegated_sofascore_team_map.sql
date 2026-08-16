-- 1.Lig'e Süper Lig'den düşen Antalyaspor + Kayserispor'un SofaScore takım
-- id'leri ref.team_mapping'te YOKTU. Süper Lig'de Opta (9irsyv.../c8ns...) ve
-- apifootball (1005/1001) id'leriyle eşleniyorlardı; 1.Lig maç verisi ise
-- SofaScore kaynaklı (source_team_id 3056/3072). msm.team_match_log_v1
-- source_team_id ile ref.team_mapping'e join yaptığından, bu takımların maç
-- istatistikleri team_slug=null kalıp DÜŞÜYORDU -> Teams sekmesi/puan durumu vb.
-- her metrikte '-' (veri yok). Ör. Keçiörengücü-Antalyaspor (event 16490401):
-- Antalyaspor 1 ofsayt, ama slug çözülmediği için tabloya hiç girmiyordu.
-- Çözüm: iki SofaScore id'sini doğru slug'a ekle (Keçiörengücü zaten 6366 ile eşli).

insert into ref.team_mapping
  (team_slug, display_name, canonical_team_name, is_active, source_team_id)
values
  ('antalyaspor', 'Antalyaspor', 'Antalyaspor', true, '3056'),
  ('kayserispor', 'Kayserispor', 'Kayserispor', true, '3072')
on conflict (team_slug, source_team_id) do nothing;
