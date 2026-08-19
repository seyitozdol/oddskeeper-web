-- H2 (ARCHITECTURE_REVIEW): mac-sonrasi scrape'te "degisiklik yoksa refresh atla".
-- Her islenen macin upsert payload'inin (match+player+team+card+shot satirlari)
-- deterministik hash'ini saklar; bir sonraki grace-penceresi turunda ayni maci
-- yeniden cekince hash ayniysa veri degismemistir -> (Faz 2'de) mat refresh atlanir.
--
-- FAZ 1 (su an): yalniz GOZLEM. fetcher hash'i hesaplar/karsilastirir/saklar ve
-- "CHANGED_M: N" loglar; refresh davranisi DEGISMEZ (log-only). Birkac mac gunu
-- izlenip degismeyen maclarin CHANGED_M=0 verdigi dogrulaninca Faz 2 (gercek atlama)
-- acilir.
--
-- Yalniz pipeline (DATABASE_URL) yazar/okur; anon/authenticated erisimi YOK.
CREATE TABLE IF NOT EXISTS tracker.match_scrape_hash (
  source           text        NOT NULL,
  source_match_id  text        NOT NULL,
  payload_hash     text        NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_match_id)
);
