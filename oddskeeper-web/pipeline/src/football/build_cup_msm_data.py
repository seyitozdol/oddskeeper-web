"""Kupa (Türkiye Kupası) verisini Match Stats Model'e (MSM) besler.
MSM view'lari msm.* tablolarindan league bazli okur; bu script 'cup' satirlarini
kurar: market_config + model_config (TSL'den kopya) + histdata (kupa takim ev/dep
istatistiklerinden). msm_teams_v1 takimlari histdata'dan turetir.

Idempotent. Yeni kupa sezonu yuklendikten sonra tekrar kosulur.
Kullanim: python src/football/build_cup_msm_data.py
"""
import os

import psycopg2
from dotenv import dotenv_values

PIPELINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV = dotenv_values(os.path.join(PIPELINE_DIR, ".env"))

# MSM market -> Mackolik stat_type (tekil). Card ayri (yellow+red*2).
MARKET_STAT = {
    "Shot": "shots", "SOT": "shots_on_target", "Corner": "corners", "Foul": "fouls",
    "Offside": "total_offside", "Throw-in": "throw_in", "Tackle": "successful_tackles",
    "Goal Kick": "goal_kick",
}

SIDED = """
  select m.season_name season, m.team_a_id team_id, m.team_a_name nm, true is_home,
         s.value_a vfor, s.value_b vagainst
  from football.mackolik_matches m join football.mackolik_team_stats s using(match_uuid)
  where m.score_a is not null and s.stat_type = %(stat)s
  union all
  select m.season_name, m.team_b_id, m.team_b_name, false, s.value_b, s.value_a
  from football.mackolik_matches m join football.mackolik_team_stats s using(match_uuid)
  where m.score_a is not null and s.stat_type = %(stat)s
"""

# KRITIK: engine sezonlari AGIRLIKLA toplar (Σ weight_i·season_i) ama eksik
# sezonda AGIRLIGI YENIDEN NORMALIZE ETMEZ (expectancy.ts yearWeighted). Kupa
# takimlari cogu tek sezon oynadigindan ( agirlik 0.5) degerler ~yariya duserdi.
# COZUM: her takimin TUM kupa maclarindaki GENEL ortalamasini 3 agirlikli sezonun
# (2025-2026/2024-2025/2023-2024) HEPSINE koy -> agirliklar toplami 1.0 -> tam deger.
# Ayrica ev/dep tek tarafliysa null yerine genel ortalama (coalesce).
WEIGHTED_SEASONS = "(values ('2025-2026'),('2024-2025'),('2023-2024')) s(season)"

INSERT_ONE = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at)
with sided as (%s),
slug as (
  select sd.*, coalesce(tm.team_slug,
    regexp_replace(lower(translate(sd.nm,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) team_slug
  from sided sd left join ref.mackolik_team_map tm on tm.mackolik_team_id = sd.team_id),
agg as (
  select team_slug, max(nm) nm,
    coalesce(round(avg(vfor) filter(where is_home)::numeric,2), round(avg(vfor)::numeric,2)) hf,
    coalesce(round(avg(vagainst) filter(where is_home)::numeric,2), round(avg(vagainst)::numeric,2)) ha,
    coalesce(round(avg(vfor) filter(where not is_home)::numeric,2), round(avg(vfor)::numeric,2)) af,
    coalesce(round(avg(vagainst) filter(where not is_home)::numeric,2), round(avg(vagainst)::numeric,2)) aa
  from slug group by team_slug having count(*) >= 2)
select 'cup', s.season, %%(market)s, agg.nm, agg.team_slug, agg.hf, agg.ha, agg.af, agg.aa, now()
from agg cross join """ % SIDED + WEIGHTED_SEASONS

INSERT_CARD = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at)
with sided as (
  select m.team_a_id team_id, m.team_a_name nm, true is_home,
    coalesce(sy.value_a,0)+coalesce(sr.value_a,0)*2 vfor, coalesce(sy.value_b,0)+coalesce(sr.value_b,0)*2 vagainst
  from football.mackolik_matches m
  left join football.mackolik_team_stats sy on sy.match_uuid=m.match_uuid and sy.stat_type='yellow_card'
  left join football.mackolik_team_stats sr on sr.match_uuid=m.match_uuid and sr.stat_type='red_card'
  where m.score_a is not null
  union all
  select m.team_b_id, m.team_b_name, false,
    coalesce(sy.value_b,0)+coalesce(sr.value_b,0)*2, coalesce(sy.value_a,0)+coalesce(sr.value_a,0)*2
  from football.mackolik_matches m
  left join football.mackolik_team_stats sy on sy.match_uuid=m.match_uuid and sy.stat_type='yellow_card'
  left join football.mackolik_team_stats sr on sr.match_uuid=m.match_uuid and sr.stat_type='red_card'
  where m.score_a is not null
),
slug as (select sd.*, coalesce(tm.team_slug, regexp_replace(lower(translate(sd.nm,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) team_slug
  from sided sd left join ref.mackolik_team_map tm on tm.mackolik_team_id=sd.team_id),
agg as (
  select team_slug, max(nm) nm,
    coalesce(round(avg(vfor) filter(where is_home)::numeric,2), round(avg(vfor)::numeric,2)) hf,
    coalesce(round(avg(vagainst) filter(where is_home)::numeric,2), round(avg(vagainst)::numeric,2)) ha,
    coalesce(round(avg(vfor) filter(where not is_home)::numeric,2), round(avg(vfor)::numeric,2)) af,
    coalesce(round(avg(vagainst) filter(where not is_home)::numeric,2), round(avg(vagainst)::numeric,2)) aa
  from slug group by team_slug having count(*)>=2)
select 'cup', s.season, 'Card', agg.nm, agg.team_slug, agg.hf, agg.ha, agg.af, agg.aa, now()
from agg cross join """ + WEIGHTED_SEASONS


# Saves market: takim-seviyesi kurtaris kupa TAKIM feed'inde YOK; oyuncu (kaleci)
# saves'inden turetilir (statistics-service). Sadece ÇF/YF/Final'de veri var ->
# sadece o turlara cikan takimlarda (>=2 mac) deger olur.
INSERT_SAVES = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at)
with tms as (
  select s.match_uuid, s.team_id, sum(m.value) saves
  from football.mackolik_player_match_stats s
  join football.mackolik_player_match_metrics m
    on m.match_uuid=s.match_uuid and m.player_id=s.player_id and m.metric_key='saves'
  group by s.match_uuid, s.team_id
),
sided as (
  select mt.team_a_id team_id, mt.team_a_name nm, true is_home, ta.saves vfor, tb.saves vagainst
  from football.mackolik_matches mt
  join tms ta on ta.match_uuid=mt.match_uuid and ta.team_id=mt.team_a_id
  join tms tb on tb.match_uuid=mt.match_uuid and tb.team_id=mt.team_b_id
  union all
  select mt.team_b_id, mt.team_b_name, false, tb.saves, ta.saves
  from football.mackolik_matches mt
  join tms ta on ta.match_uuid=mt.match_uuid and ta.team_id=mt.team_a_id
  join tms tb on tb.match_uuid=mt.match_uuid and tb.team_id=mt.team_b_id
),
slug as (select sd.*, coalesce(tm.team_slug, regexp_replace(lower(translate(sd.nm,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) team_slug
  from sided sd left join ref.mackolik_team_map tm on tm.mackolik_team_id=sd.team_id),
agg as (
  select team_slug, max(nm) nm,
    coalesce(round(avg(vfor) filter(where is_home)::numeric,2), round(avg(vfor)::numeric,2)) hf,
    coalesce(round(avg(vagainst) filter(where is_home)::numeric,2), round(avg(vagainst)::numeric,2)) ha,
    coalesce(round(avg(vfor) filter(where not is_home)::numeric,2), round(avg(vfor)::numeric,2)) af,
    coalesce(round(avg(vagainst) filter(where not is_home)::numeric,2), round(avg(vagainst)::numeric,2)) aa
  from slug group by team_slug having count(*)>=2)
select 'cup', s.season, 'Saves', agg.nm, agg.team_slug, agg.hf, agg.ha, agg.af, agg.aa, now()
from agg cross join """ + WEIGHTED_SEASONS


# Saves TAHMINI: gercek kaleci verisi olmayan takimlar icin. TSL+1.Lig'den (Opta,
# 2'ser sezon) "yedigi isabetli sutun ne kadari kurtarisa doner" orani (~0.68,
# iki ligde de kararli) canli hesaplanir; takimin kupa SOT histdata'sina uygulanir.
# Saves.hf(kendi ev kurtaris)=SOT.ha(evde yedigi SOT)*r ; ha=SOT.hf*r ; af=SOT.aa*r ; aa=SOT.af*r.
# estimated=true bayragi ile gercek veriden ayrilir. Sadece gercek Saves'i OLMAYAN takimlara.
INSERT_SAVES_ESTIMATE = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, estimated, updated_at)
with ratio as (
  select sum(sf_h+sf_a)/nullif(sum(sa_h+sa_a),0) r from (
    select sv.hf sf_h, sv.af sf_a, so.ha sa_h, so.aa sa_a
    from msm.histdata sv join msm.histdata so
      on sv.league=so.league and sv.season=so.season and sv.team_slug=so.team_slug
    where sv.market='Saves' and so.market='SOT' and sv.league in ('tsl','tff1')
  ) x),
sot as (select season, team_name, team_slug, hf, ha, af, aa from msm.histdata where league='cup' and market='SOT'),
have as (select distinct team_slug from msm.histdata where league='cup' and market='Saves')
select 'cup', sot.season, 'Saves', sot.team_name, sot.team_slug,
  round((sot.ha*r.r)::numeric,2), round((sot.hf*r.r)::numeric,2),
  round((sot.aa*r.r)::numeric,2), round((sot.af*r.r)::numeric,2), true, now()
from sot cross join ratio r
where sot.team_slug not in (select team_slug from have)
"""


def main():
    c = psycopg2.connect(ENV["DATABASE_URL"]); c.autocommit = True; cur = c.cursor()
    # market + model config: TSL'den kopya (ayni marketler/parametreler)
    cur.execute("""insert into msm.market_config
      select 'cup', market, std_home_ft, std_away_ft, std_home_1h, std_away_1h, std_home_2h, std_away_2h,
        split_1h, split_2h, supremacy_applies, referee_applies, now(), line_count, send_halves, mid_only,
        line_count_1h, line_count_2h, under_1h, under_2h, payback_1h, payback_2h
      from msm.market_config where league='tsl' on conflict (league, market) do nothing""")
    cur.execute("""insert into msm.model_config
      select 'cup', margin, referee_weight, supremacy_divisor, xmatrix_w_own_for, xmatrix_w_own_alt, xmatrix_w_opp_alt,
        xmatrix_w_opp_against, su_low, su_high, engine, mc_samples, now(), weight_s1, weight_s2, weight_s3,
        default_etki, weight_s4, referee_min_matches
      from msm.model_config where league='tsl' on conflict (league) do nothing""")
    # histdata: yeniden kur
    cur.execute("delete from msm.histdata where league='cup'")
    n = 0
    for market, stat in MARKET_STAT.items():
        cur.execute(INSERT_ONE, {"market": market, "stat": stat}); n += cur.rowcount
    cur.execute(INSERT_CARD); n += cur.rowcount
    cur.execute(INSERT_SAVES); n += cur.rowcount
    real_saves = cur.rowcount
    cur.execute(INSERT_SAVES_ESTIMATE); n += cur.rowcount
    cur.execute("select count(distinct team_slug) filter(where not estimated), count(distinct team_slug) filter(where estimated) from msm.histdata where league='cup' and market='Saves'")
    rs, es = cur.fetchone()
    print(f"  Saves market: {rs} takim gercek + {es} takim TAHMINI (SOT*oran)")
    cur.execute("select count(distinct team_slug) from msm.histdata where league='cup'")
    print(f"MSM cup: {n} histdata satiri, {cur.fetchone()[0]} takim")


if __name__ == "__main__":
    main()
