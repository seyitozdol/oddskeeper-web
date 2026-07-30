-- 2026-07-30: Guvenlik kilitleme - anon rolunu tum veri semalarindan kes.
--
-- ARKA PLAN
-- Site artik kapali (davetle). Ama publishable (anon) anahtar tarayici
-- paketinde herkese acik ve PostgREST uzerinden dogrudan DB'ye ulasiyordu:
-- anon rolu 6 veri semasinda genis okuma + 28 tabloda RLS'siz yazma/silme
-- yetkisine sahipti. Yani hesapsiz biri tahmin verisini indirebiliyor,
-- degistirebiliyor veya silebiliyordu (canli istekle dogrulandi).
--
-- COZUM
-- Tum sayfalar login arkasinda oldugundan tarayici aslinda "authenticated"
-- roluyle calisir. Bu yuzden:
--   1) anon'u veri semalarindan TAMAMEN kesiyoruz (okuma dahil).
--   2) authenticated'in YAZMA yetkisini yalnizca tarayicinin gercekten
--      yazdigi 3 tabloya (pm_player_ids, pm_fixture_inputs, pm_markets)
--      indiriyoruz; okuma her yerde korunur.
-- Boylece giris yapmis kullanicilar etkilenmez, anonim erisim kapanir.
--
-- NOT (KALICILIK): sql/ altindaki 30 migration dosyasi hala "grant ... to
-- anon" iceriyor. O dosyalar yeniden calistirilirsa anon erisimi geri acilir.
-- Yeni migration'larda anon yerine authenticated'a grant verilmeli; eski
-- dosyalardaki anon grant'lari da authenticated'a cevrilmeli.

do $$
declare s text;
begin
  foreach s in array array['analytics','football','map','prediction','raw','ref']
  loop
    -- anon: bu semalarda hicbir sey yapamaz
    execute format('revoke all on all tables in schema %I from anon', s);
    execute format('revoke all on all sequences in schema %I from anon', s);
    execute format('revoke all on all functions in schema %I from anon', s);
    execute format('alter default privileges in schema %I revoke all on tables from anon', s);
    execute format('alter default privileges in schema %I revoke all on sequences from anon', s);

    -- authenticated: okuma kalir, yazma kalkar
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on all tables in schema %I from authenticated', s);
    execute format(
      'alter default privileges in schema %I revoke insert, update, delete, truncate, references, trigger on tables from authenticated', s);
  end loop;
end $$;

-- Player-market sayfalari bu 3 tabloya tarayicidan yazar: authenticated'a
-- yazmayi geri ver (anon'a DEGIL).
grant insert, update, delete on analytics.pm_player_ids    to authenticated;
grant insert, update, delete on analytics.pm_fixture_inputs to authenticated;
grant insert, update, delete on analytics.pm_markets        to authenticated;

-- SECURITY DEFINER fonksiyonlar owner yetkisiyle calisir; tablo grant'larini
-- ATLARLAR. Bu yuzden anon'un cagirabildigi definer fonksiyonlar da ayrica
-- kisitlanmali (anon canli olarak takim karsilastirma verisi cekebiliyordu).
revoke execute on function public.get_team_comparison_v1(text,text,text,text) from public, anon;
grant  execute on function public.get_team_comparison_v1(text,text,text,text) to authenticated, service_role;

-- Refresh fonksiyonu materialized view yeniler (pahali). Frontend cagirmaz;
-- anon tetikleyince kaynak tuketimi/DoS riski. Sadece service_role.
revoke execute on function public.refresh_league_serving_v1()    from public, anon, authenticated;
grant  execute on function public.refresh_league_serving_v1()    to service_role;
revoke execute on function analytics.refresh_league_serving_v1() from public, anon, authenticated;
grant  execute on function analytics.refresh_league_serving_v1() to service_role;
