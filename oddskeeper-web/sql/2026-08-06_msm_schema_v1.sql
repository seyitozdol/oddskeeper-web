-- Match Stats Model (MSM) semasi (izole: football/analytics/ref'e GIRMEZ)
-- Kaynak: public/xcel/2027 Super Lig Simulation.xlsm + 2027 1 Lig Simulation.xlsm
-- Amac: Excel simulasyon motorunun (Calcv3 Monte-Carlo + Sim beklenti) web'e tasinmasi.
-- Faz 1: HistData / Tablo(market config) / Template / Ref_Table + model sabitleri BIREBIR.
-- league dimension: 'superlig' | '1lig' (iki lig ayni tablolari paylasir).

create schema if not exists msm;

-- HistData: gecmis sezon HF/HA/AF/AA (market x takim x sezon) BIREBIR yuklenir.
-- HF=evde urettigi, HA=evde yedigi, AF=depde urettigi, AA=depde yedigi (per-game ort).
create table if not exists msm.histdata (
    league     text    not null,               -- superlig | 1lig
    season     text    not null,               -- '2023-2024' | '2024-2025' | '2025-2026'
    market     text    not null,               -- Card|Corner|Foul|Goal Kick|Offside|SOT|Shot|Tackle|Throw-in|Saves
    team_name  text    not null,               -- Excel ASCII adi (Galatasaray, Corumspor)
    team_slug  text,                            -- ref.team_mapping eslemesi (Faz 2/3'te doldurulur)
    hf numeric, ha numeric, af numeric, aa numeric,
    updated_at timestamptz default now(),
    primary key (league, season, market, team_name)
);

-- Tablo market config: market-bazli std sapmalar + 1H/2H bolusum orani.
-- Monte-Carlo/analitik motor bunlari std olarak, 1H/2H beklentisini split ile turetir.
create table if not exists msm.market_config (
    league text not null,
    market text not null,
    std_home_ft numeric, std_away_ft numeric,
    std_home_1h numeric, std_away_1h numeric,
    std_home_2h numeric, std_away_2h numeric,
    split_1h numeric, split_2h numeric,
    supremacy_applies boolean default false,    -- Shot/SOT/Corner/GoalKick/Foul/Saves/Card
    referee_applies   boolean default false,    -- Card/Foul
    updated_at timestamptz default now(),
    primary key (league, market)
);

-- Template: market -> template kodlari (Import ciktisi icin, sirali). Corner'in template'i YOK.
create table if not exists msm.template (
    league text not null,
    market text not null,
    template_code text not null,
    details text,
    sort_order int not null default 0,
    primary key (league, market, template_code)
);

-- Ref_Table: hakem istatistikleri (donemsel guncellenir). Card/Foul beklentisini besler.
create table if not exists msm.referee (
    league text not null,
    referee_name text not null,
    season text not null default 'current',
    played int, cards_pg numeric, fouls_pg numeric, var_pg numeric,
    updated_at timestamptz default now(),
    primary key (league, referee_name, season)
);

-- Model sabitleri: Config sekmesi defaultlari (lig basina bir satir).
create table if not exists msm.model_config (
    league text primary key,
    margin numeric not null default 0.93,           -- over=margin/p
    referee_weight numeric not null default 0.30,   -- Reff. Eff.
    supremacy_divisor numeric not null default 5.5, -- CX28 boleni
    xmatrix_w_own_for numeric not null default 0.65,     -- ev_xS agirliklari
    xmatrix_w_own_alt numeric not null default 0.05,
    xmatrix_w_opp_alt numeric not null default 0.05,
    xmatrix_w_opp_against numeric not null default 0.25,
    su_low  numeric not null default 1.17,          -- fiyat < su_low -> SU
    su_high numeric not null default 4.51,          -- fiyat > su_high -> SU
    engine text not null default 'analytic',        -- analytic | montecarlo
    mc_samples int not null default 4000,
    updated_at timestamptz default now()
);

-- Grant tuzagi: frontend anon ile okur; yazma service_role (config admin).
grant usage on schema msm to anon, authenticated, service_role;
grant select on all tables in schema msm to anon, authenticated;
grant all on all tables in schema msm to service_role;
alter default privileges in schema msm grant select on tables to anon, authenticated;
alter default privileges in schema msm grant all on tables to service_role;

create index if not exists idx_msm_hist_lookup on msm.histdata(league, market, team_name);
create index if not exists idx_msm_tmpl_market on msm.template(league, market);
