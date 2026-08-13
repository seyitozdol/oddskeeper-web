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

# MSM market -> Mackolik stat_type (tekil). Card ayri (yellow+red).
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

INSERT_ONE = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at)
with sided as (%s),
slug as (
  select sd.*, coalesce(tm.team_slug,
    regexp_replace(lower(translate(sd.nm,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) team_slug
  from sided sd left join ref.mackolik_team_map tm on tm.mackolik_team_id = sd.team_id)
select 'cup', season, %%(market)s, max(nm), team_slug,
  round(avg(vfor) filter(where is_home)::numeric,2), round(avg(vagainst) filter(where is_home)::numeric,2),
  round(avg(vfor) filter(where not is_home)::numeric,2), round(avg(vagainst) filter(where not is_home)::numeric,2), now()
from slug group by season, team_slug having count(*) >= 2
""" % SIDED

INSERT_CARD = """
insert into msm.histdata(league, season, market, team_name, team_slug, hf, ha, af, aa, updated_at)
with sided as (
  select m.season_name season, m.team_a_id team_id, m.team_a_name nm, true is_home,
    coalesce(sy.value_a,0)+coalesce(sr.value_a,0) vfor, coalesce(sy.value_b,0)+coalesce(sr.value_b,0) vagainst
  from football.mackolik_matches m
  left join football.mackolik_team_stats sy on sy.match_uuid=m.match_uuid and sy.stat_type='yellow_card'
  left join football.mackolik_team_stats sr on sr.match_uuid=m.match_uuid and sr.stat_type='red_card'
  where m.score_a is not null
  union all
  select m.season_name, m.team_b_id, m.team_b_name, false,
    coalesce(sy.value_b,0)+coalesce(sr.value_b,0), coalesce(sy.value_a,0)+coalesce(sr.value_a,0)
  from football.mackolik_matches m
  left join football.mackolik_team_stats sy on sy.match_uuid=m.match_uuid and sy.stat_type='yellow_card'
  left join football.mackolik_team_stats sr on sr.match_uuid=m.match_uuid and sr.stat_type='red_card'
  where m.score_a is not null
),
slug as (select sd.*, coalesce(tm.team_slug, regexp_replace(lower(translate(sd.nm,'çğıöşüÇĞİÖŞÜ','cgiosucgiosu')),'[^a-z0-9]+','-','g')) team_slug
  from sided sd left join ref.mackolik_team_map tm on tm.mackolik_team_id=sd.team_id)
select 'cup', season, 'Card', max(nm), team_slug,
  round(avg(vfor) filter(where is_home)::numeric,2), round(avg(vagainst) filter(where is_home)::numeric,2),
  round(avg(vfor) filter(where not is_home)::numeric,2), round(avg(vagainst) filter(where not is_home)::numeric,2), now()
from slug group by season, team_slug having count(*)>=2
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
    cur.execute("select count(distinct team_slug) from msm.histdata where league='cup'")
    print(f"MSM cup: {n} histdata satiri, {cur.fetchone()[0]} takim")


if __name__ == "__main__":
    main()
