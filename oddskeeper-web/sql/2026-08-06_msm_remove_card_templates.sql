-- MSM: Card market'i input'a (export) gönderilemez yap = template'lerini kaldır.
-- Template'i olmayan market (Corner gibi) currentRows üretmez → "Add to Input" pasif,
-- Config Templates listesinde de görünmez. Card için aynı davranış istendi (tsl+tff1).
-- Card market_config (std/split/supremacy/referee) DURUR; model Card beklentisini/çizgi
-- tablolarını hesaplamaya devam eder, sadece Bets10 export'u kapanır.

delete from msm.template where market = 'Card';
