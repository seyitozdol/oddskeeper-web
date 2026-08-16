-- SofaScore, iki takım da 0 ise bir metriğin (ör. Offsides) başlığını HİÇ
-- göstermez -> loader o metriği null yazıyordu -> tablolarda '-' (Mardin ofsayt).
-- İstatistiği yüklü SofaScore maçlarında (summary_shots dolu; base-rate %0 null)
-- izlenen sayısal metrik null ise bu 0-0 demektir -> 0'a çevir.
-- (Loader de artık zero_default=True ile 0 yazıyor; bu backfill geçmiş içindir.)
-- Guard: summary_shots is not null -> yalnız istatistiği gerçekten yüklü maçlar;
-- hiç istatistik gelmemiş maçlarda 0 UYDURMA.

update football.match_team_stats
set summary_shots           = coalesce(summary_shots, 0),
    summary_shots_on_target = coalesce(summary_shots_on_target, 0),
    summary_corners_won     = coalesce(summary_corners_won, 0),
    summary_fouls_conceded  = coalesce(summary_fouls_conceded, 0),
    summary_fouls_won       = coalesce(summary_fouls_won, 0),
    summary_offsides        = coalesce(summary_offsides, 0),
    summary_saves           = coalesce(summary_saves, 0),
    summary_tackles         = coalesce(summary_tackles, 0),
    details_goal_kicks      = coalesce(details_goal_kicks, 0),
    details_total_throws    = coalesce(details_total_throws, 0)
where source = 'sofascore'
  and summary_shots is not null
  and (summary_offsides is null or summary_saves is null or summary_tackles is null
       or summary_corners_won is null or details_goal_kicks is null
       or details_total_throws is null or summary_shots_on_target is null
       or summary_fouls_conceded is null or summary_fouls_won is null);
