-- MSM Fixture ID + Input sekmeleri: fikstür oran/id girdileri + import log.
-- Fikstür kaynağı analytics.league_fixtures_v1 (Süper Lig 26/27); burada sadece
-- kullanıcının girdiği 1x2 oran + dış (bahis) fixture_id saklanır.

create table if not exists msm.fixture_inputs (
    league              text not null,
    fixture_id          text not null,          -- league_fixtures_v1.fixture_id (iç)
    external_fixture_id text,                     -- bahis sağlayıcısının fixture id'si
    home_odds numeric, draw_odds numeric, away_odds numeric,
    updated_at timestamptz default now(),
    primary key (league, fixture_id)
);

-- Import geçmişi (her export bir satır; Excel Import_History karşılığı).
create table if not exists msm.import_history (
    id          bigserial primary key,
    league      text not null,
    created_at  timestamptz default now(),
    fixture_id  text,
    match       text,
    market      text,
    home_exp numeric, away_exp numeric, total_exp numeric,
    manual_home numeric, manual_away numeric, manual_total numeric,
    etki numeric,
    row_count int
);

grant usage on schema msm to anon, authenticated, service_role;
grant select on msm.fixture_inputs, msm.import_history to anon, authenticated;

-- Okuma wrapper'ları (analytics exposed).
create or replace view analytics.msm_fixture_inputs_v1 as select * from msm.fixture_inputs;
create or replace view analytics.msm_import_history_v1 as select * from msm.import_history;
grant select on analytics.msm_fixture_inputs_v1, analytics.msm_import_history_v1 to anon, authenticated;

-- Yazma RPC'leri (public, SECURITY DEFINER).
create or replace function public.msm_upsert_fixture_inputs(p_league text, p_rows jsonb)
returns void language plpgsql security definer set search_path = msm, public as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into msm.fixture_inputs (league, fixture_id, external_fixture_id, home_odds, draw_odds, away_odds, updated_at)
    values (
      p_league, r->>'fixture_id', nullif(r->>'external_fixture_id',''),
      (r->>'home_odds')::numeric, (r->>'draw_odds')::numeric, (r->>'away_odds')::numeric, now()
    )
    on conflict (league, fixture_id) do update set
      external_fixture_id = excluded.external_fixture_id,
      home_odds = excluded.home_odds, draw_odds = excluded.draw_odds, away_odds = excluded.away_odds,
      updated_at = now();
  end loop;
end $$;

create or replace function public.msm_log_import(p_league text, p_row jsonb)
returns void language plpgsql security definer set search_path = msm, public as $$
begin
  insert into msm.import_history (league, fixture_id, match, market, home_exp, away_exp, total_exp,
                                  manual_home, manual_away, manual_total, etki, row_count)
  values (p_league, p_row->>'fixture_id', p_row->>'match', p_row->>'market',
          (p_row->>'home_exp')::numeric, (p_row->>'away_exp')::numeric, (p_row->>'total_exp')::numeric,
          (p_row->>'manual_home')::numeric, (p_row->>'manual_away')::numeric, (p_row->>'manual_total')::numeric,
          (p_row->>'etki')::numeric, (p_row->>'row_count')::int);
end $$;

grant execute on function public.msm_upsert_fixture_inputs(text, jsonb) to anon, authenticated;
grant execute on function public.msm_log_import(text, jsonb)            to anon, authenticated;
