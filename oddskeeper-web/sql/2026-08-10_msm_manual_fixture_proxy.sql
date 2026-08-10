-- 2026-08-10: MSM manuel fikstür "benzer takım" (proxy) eşlemesi.
--
-- Manuel fikstürde ligde OLMAYAN takım (ör. Kırklarelispor) serbest metin
-- yazılır; model istatistik üretemez. Kullanıcı o taraf için ligden bir
-- "benzer takım" seçer (ör. Gençlerbirliği) -> model o tarafın verilerini
-- proxy takımdan alır, GÖRÜNEN isim manuel kalır. Proxy slug'ı fikstürde
-- saklanır ki sayfa yenilenince de korunur.

alter table analytics.msm_manual_fixtures
  add column if not exists home_proxy_slug text,
  add column if not exists away_proxy_slug text;

create or replace function public.msm_set_manual_fixture_proxy(
  p_id uuid, p_side text, p_proxy_slug text
) returns void language plpgsql security definer set search_path = analytics, public as $$
begin
  if p_side = 'home' then
    update analytics.msm_manual_fixtures
      set home_proxy_slug = nullif(p_proxy_slug, '') where id = p_id;
  elsif p_side = 'away' then
    update analytics.msm_manual_fixtures
      set away_proxy_slug = nullif(p_proxy_slug, '') where id = p_id;
  end if;
end $$;

grant execute on function public.msm_set_manual_fixture_proxy(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
