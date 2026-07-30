-- 2026-07-30: Option A / Asama 1 — TSL SofaScore metrik katalogu.
-- TSL detay metriklerini Opta yerine SofaScore'dan uretecek zincirin TEMELI.
-- Her metrik_key icin: kategori, siralama yonu, format, per90 uygunlugu, ve
-- SofaScore raw_stats anahtari (sofa_key) + toplama turu (agg_kind).
-- Anahtarlar canli veriden dogrulandi (football.match_player_stats_details,
-- source='sofascore', Super Lig 25/26; 88 anahtar tarandi).
--
-- sofa_key semantigi (agg_kind ile birlikte asama 2'de kullanilir):
--   agg_kind='sum'     : sezon boyunca sofa_key toplami (sayim metrikleri, xg/xa/km...)
--   agg_kind='avg'     : dakika>0 maclarda ortalama (rating)
--   agg_kind='max'     : sezon maksimumu (top_speed)
--   agg_kind='derived' : baska metriklerden turetilir (pct, per90, starter_rate, avg_minutes)
--                        sofa_key=NULL, formul asama 2'de hardcode.
-- source_note='flashscore' : SofaScore'da YOK, FlashScore overlay'den gelir (kart, sut lokasyonu).
--
-- rank_direction: 'asc' = dusuk deger daha iyi (faul, kart, dispossessed...); 'desc' = yuksek iyi.
-- value_format: 'count' | 'pct' | 'decimal'.
-- per90_eligible: sayim event metriklerinde true; oran/rating/dakika/appearance'da false.

-- Asama 4 (2026-07-30): benchmark_allowed/overview_allowed/role_scope/value_basis
-- flag'leri eklendi. create or replace (drop DEGIL): stage2/stage3 view'lari bu
-- katalogu join'liyor, cascade drop olmamali. Yeni kolonlar SONA eklendiginden
-- create or replace gecerli. Flag'ler mevcut kolonlardan turetilir (52 satir degismedi).
create or replace view analytics.tsl_ss_metric_catalog_v1 as
select
  b.*,
  (b.metric_key in ('appearances','starts','starter_rate_pct','total_minutes','avg_minutes',
     'goals_total','assists_total','expected_goals_total','expected_assists_total',
     'expected_goals_on_target_total','shots_total','shots_on_target_total','shot_accuracy_pct',
     'xg_per90','key_passes_total','big_chances_created_total','passes_total','accurate_pass_total',
     'pass_accuracy_pct','crosses_total','long_balls_total','tackles_total','tackles_won_total',
     'interceptions_total','clearances_total','blocks_total','ball_recoveries_total','duels_won_total',
     'aerials_won_total','dribbles_won_total','touches_total','fouls_conceded_total','fouls_won_total',
     'cards_yellow_total','cards_red_total','offsides_total','saves_total_total','penalties_saved_total',
     'goals_prevented_total','km_covered_total','sprints_total','top_speed','rating_avg')) as benchmark_allowed,
  (b.metric_key in ('goals_total','assists_total','expected_goals_total','expected_assists_total',
     'expected_goals_on_target_total','shots_on_target_total','key_passes_total','big_chances_created_total',
     'dribbles_won_total','duels_won_total','aerials_won_total','tackles_total','tackles_won_total',
     'interceptions_total','clearances_total','ball_recoveries_total','pass_accuracy_pct','accurate_pass_total',
     'saves_total_total','penalties_saved_total','goals_prevented_total','rating_avg','top_speed',
     'km_covered_total','sprints_total')) as overview_allowed,
  case when b.category_key = 'goalkeeping' then 'gk' else 'all' end as role_scope,
  case
    when b.agg_kind = 'sum' and b.per90_eligible then 'per90'
    when b.value_format = 'pct' then 'pct'
    when b.metric_key in ('appearances','starts','total_minutes') then 'total'
    when b.agg_kind in ('avg','max') then 'season'
    else 'per_match'
  end as value_basis
from (values
  -- ── Oynama suresi ─────────────────────────────────────────────
  ('appearances',            'playing_time','Oynama Suresi','Maç',              'desc', true,  'count',  false, 'derived', null,               'sofascore', 10),
  ('starts',                 'playing_time','Oynama Suresi','İlk 11',           'desc', true,  'count',  false, 'derived', null,               'sofascore', 11),
  ('starter_rate_pct',       'playing_time','Oynama Suresi','İlk 11 Oranı',     'desc', true,  'pct',    false, 'derived', null,               'sofascore', 12),
  ('total_minutes',          'playing_time','Oynama Suresi','Toplam Dakika',    'desc', true,  'count',  false, 'sum',     'minutesPlayed',    'sofascore', 13),
  ('avg_minutes',            'playing_time','Oynama Suresi','Maç Başı Dakika',  'desc', true,  'decimal',false, 'derived', null,               'sofascore', 14),

  -- ── Hucum / bitiricilik ───────────────────────────────────────
  ('goals_total',            'attacking','Hücum','Gol',                          'desc', true,  'count',  true,  'sum',     'goals',                'sofascore', 20),
  ('expected_goals_total',   'attacking','Hücum','xG (Beklenen Gol)',            'desc', true,  'decimal',true,  'sum',     'expectedGoals',        'sofascore', 21),
  ('xg_per90',               'attacking','Hücum','xG / 90',                      'desc', true,  'decimal',false, 'derived', null,                   'sofascore', 22),
  ('expected_goals_on_target_total','attacking','Hücum','xGOT (İsabetli Şut xG)','desc',true, 'decimal',true,  'sum',     'expectedGoalsOnTarget','sofascore', 23),
  ('shots_total',            'attacking','Hücum','Şut',                          'desc', true,  'count',  true,  'sum',     'totalShots',           'sofascore', 24),
  ('shots_on_target_total',  'attacking','Hücum','İsabetli Şut',                 'desc', true,  'count',  true,  'sum',     'onTargetScoringAttempt','sofascore', 25),
  ('shot_accuracy_pct',      'attacking','Hücum','İsabet %',                     'desc', true,  'pct',    false, 'derived', null,                   'sofascore', 26),
  ('big_chances_missed_total','attacking','Hücum','Kaçan Net Fırsat',            'asc',  false, 'count',  true,  'sum',     'bigChanceMissed',      'sofascore', 27),

  -- ── Yaraticilik ───────────────────────────────────────────────
  ('assists_total',          'creation','Yaratıcılık','Asist',                  'desc', true,  'count',  true,  'sum',     'goalAssist',           'sofascore', 30),
  ('expected_assists_total', 'creation','Yaratıcılık','xA (Beklenen Asist)',    'desc', true,  'decimal',true,  'sum',     'expectedAssists',      'sofascore', 31),
  ('key_passes_total',       'creation','Yaratıcılık','Kilit Pas',              'desc', true,  'count',  true,  'sum',     'keyPass',              'sofascore', 32),
  ('big_chances_created_total','creation','Yaratıcılık','Yaratılan Net Fırsat', 'desc', true,  'count',  true,  'sum',     'bigChanceCreated',     'sofascore', 33),
  ('crosses_total',          'creation','Yaratıcılık','Orta',                   'desc', true,  'count',  true,  'sum',     'totalCross',           'sofascore', 34),
  ('accurate_crosses_total', 'creation','Yaratıcılık','İsabetli Orta',          'desc', true,  'count',  true,  'sum',     'accurateCross',        'sofascore', 35),

  -- ── Pas ───────────────────────────────────────────────────────
  ('passes_total',           'passing','Pas','Pas',                             'desc', true,  'count',  true,  'sum',     'totalPass',            'sofascore', 40),
  ('accurate_pass_total',    'passing','Pas','İsabetli Pas',                    'desc', true,  'count',  true,  'sum',     'accuratePass',         'sofascore', 41),
  ('pass_accuracy_pct',      'passing','Pas','Pas İsabet %',                    'desc', true,  'pct',    false, 'derived', null,                   'sofascore', 42),
  ('long_balls_total',       'passing','Pas','Uzun Top',                        'desc', true,  'count',  true,  'sum',     'totalLongBalls',       'sofascore', 43),
  ('accurate_long_balls_total','passing','Pas','İsabetli Uzun Top',            'desc', true,  'count',  true,  'sum',     'accurateLongBalls',    'sofascore', 44),

  -- ── Savunma ───────────────────────────────────────────────────
  ('tackles_total',          'defending','Savunma','Müdahale',                  'desc', true,  'count',  true,  'sum',     'totalTackle',          'sofascore', 50),
  ('tackles_won_total',      'defending','Savunma','Kazanılan Müdahale',        'desc', true,  'count',  true,  'sum',     'wonTackle',            'sofascore', 51),
  ('interceptions_total',    'defending','Savunma','Top Kapma',                 'desc', true,  'count',  true,  'sum',     'interceptionWon',      'sofascore', 52),
  ('clearances_total',       'defending','Savunma','Uzaklaştırma',              'desc', true,  'count',  true,  'sum',     'totalClearance',       'sofascore', 53),
  ('blocks_total',           'defending','Savunma','Blok',                      'desc', true,  'count',  true,  'sum',     'outfielderBlock',      'sofascore', 54),
  ('ball_recoveries_total',  'defending','Savunma','Top Kazanma',               'desc', true,  'count',  true,  'sum',     'ballRecovery',         'sofascore', 55),

  -- ── İkili mücadele ────────────────────────────────────────────
  ('duels_won_total',        'duels','İkili Mücadele','Kazanılan İkili Mücadele','desc',true, 'count',  true,  'sum',     'duelWon',              'sofascore', 60),
  ('duels_lost_total',       'duels','İkili Mücadele','Kaybedilen İkili Mücadele','asc',false,'count',  true,  'sum',     'duelLost',             'sofascore', 61),
  ('aerials_won_total',      'duels','İkili Mücadele','Kazanılan Hava Topu',    'desc', true,  'count',  true,  'sum',     'aerialWon',            'sofascore', 62),
  ('aerials_lost_total',     'duels','İkili Mücadele','Kaybedilen Hava Topu',   'asc',  false, 'count',  true,  'sum',     'aerialLost',           'sofascore', 63),
  ('dribbles_won_total',     'duels','İkili Mücadele','Başarılı Çalım',         'desc', true,  'count',  true,  'sum',     'wonContest',           'sofascore', 64),
  ('dribbles_attempted_total','duels','İkili Mücadele','Çalım Denemesi',        'desc', true,  'count',  true,  'sum',     'totalContest',         'sofascore', 65),

  -- ── Top hakimiyeti ────────────────────────────────────────────
  ('touches_total',          'possession','Top Hakimiyeti','Top Teması',        'desc', true,  'count',  true,  'sum',     'touches',              'sofascore', 70),
  ('dispossessed_total',     'possession','Top Hakimiyeti','Top Kaptırma',      'asc',  false, 'count',  true,  'sum',     'dispossessed',         'sofascore', 71),
  ('possession_lost_total',  'possession','Top Hakimiyeti','Top Kaybı',         'asc',  false, 'count',  true,  'sum',     'possessionLostCtrl',   'sofascore', 72),
  ('progressive_carries_total','possession','Top Hakimiyeti','İlerleyici Taşıma','desc',true, 'count',  true,  'sum',     'progressiveBallCarriesCount','sofascore', 73),

  -- ── Disiplin ──────────────────────────────────────────────────
  ('fouls_conceded_total',   'discipline','Disiplin','Yapılan Faul',            'asc',  false, 'count',  true,  'sum',     'fouls',                'sofascore', 80),
  ('fouls_won_total',        'discipline','Disiplin','Kazanılan Faul',          'desc', true,  'count',  true,  'sum',     'wasFouled',            'sofascore', 81),
  ('offsides_total',         'discipline','Disiplin','Ofsayt',                  'asc',  false, 'count',  true,  'sum',     'totalOffside',         'sofascore', 82),
  ('cards_yellow_total',     'discipline','Disiplin','Sarı Kart',               'asc',  false, 'count',  true,  'sum',     'CARDS_YELLOW',         'flashscore', 83),
  ('cards_red_total',        'discipline','Disiplin','Kırmızı Kart',            'asc',  false, 'count',  true,  'sum',     'CARDS_RED',            'flashscore', 84),

  -- ── Kalecilik ─────────────────────────────────────────────────
  ('saves_total_total',      'goalkeeping','Kalecilik','Kurtarış',              'desc', true,  'count',  true,  'sum',     'saves',                'sofascore', 90),
  ('penalties_saved_total',  'goalkeeping','Kalecilik','Kurtarılan Penaltı',    'desc', true,  'count',  true,  'sum',     'penaltySave',          'sofascore', 91),
  ('goals_prevented_total',  'goalkeeping','Kalecilik','Önlenen Gol',           'desc', true,  'decimal',true,  'sum',     'goalsPrevented',       'sofascore', 92),

  -- ── Fiziksel ──────────────────────────────────────────────────
  ('km_covered_total',       'physical','Fiziksel','Koşu (km)',                 'desc', true,  'decimal',false, 'sum',     'kilometersCovered',    'sofascore', 100),
  ('sprints_total',          'physical','Fiziksel','Sprint',                    'desc', true,  'count',  true,  'sum',     'numberOfSprints',      'sofascore', 101),
  ('top_speed',              'physical','Fiziksel','En Yüksek Hız (km/s)',      'desc', true,  'decimal',false, 'max',     'topSpeed',             'sofascore', 102),

  -- ── Genel ─────────────────────────────────────────────────────
  ('rating_avg',             'overall','Genel','Ortalama Reyting',              'desc', true,  'decimal',false, 'avg',     'rating',               'sofascore', 110)
) as b(metric_key, category_key, category_label, metric_label,
       rank_direction, is_higher_better, value_format, per90_eligible,
       agg_kind, sofa_key, source_note, display_priority);

grant select on analytics.tsl_ss_metric_catalog_v1 to anon, authenticated, service_role;
