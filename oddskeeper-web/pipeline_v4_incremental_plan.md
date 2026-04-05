# Oddskeeper - Pipeline V4 Incremental Geçiş Planı

## 1. Amaç

Şu anki pipeline mantığı backfill için iş gördü ama operasyon için verimsiz.

Mevcut sorun:
- Her yeni batch geldiğinde sadece yeni maçlar değil, geçmişte staging'de duran tüm maçlar tekrar audit ve load akışına giriyor.
- Bu yüzden 8 yeni maç için bile tüm evren tekrar dolaşılıyor.
- Sonuç: gereksiz uzun çalışma süresi, gereksiz update yükü, operasyonel hantallık.

V4'ün amacı:
- Sadece **yeni batch içindeki maçları** işlemek
- Geçmiş maçları her seferinde tekrar dolaşmamak
- Haftalık kullanımda süreyi ciddi biçimde düşürmek
- Yine de duplicate ve yarım kalan run riskine karşı **upsert güvenliğini** korumak

---

## 2. Karar

V4'te kullanılacak model:

**incremental batch-scoped upsert**

Bu şu anlama gelir:
- scope = sadece mevcut batch
- write mode = insert-only değil, upsert

Neden saf insert-only yanlış?
- Aynı batch yanlışlıkla ikinci kez çalıştırılırsa duplicate üretir veya patlar
- Yarım kalan run yeniden başlatıldığında sistem kırılgan olur
- Operasyon güvenliği düşer

Neden batch-scoped upsert doğru?
- Aynı batch tekrar çalıştırılırsa sistem bozulmaz
- Yarım kalan akış tekrar koşabilir
- Yalnızca ilgili batch işlenir
- Geçmiş veriye gereksiz update atılmaz

---

## 3. V4'te ne korunacak, ne değişecek?

### Korunacak
- normalize tablolar
- mevcut target key mantıkları
- upsert yaklaşımı
- `football.load_runs` kayıt sistemi
- mevcut full-history pipeline (sadece rebuild / acil durum için)

### Değişecek
- `all_matches.json` merkezli tam evren load mantığı
- tüm `raw.match_json_staging` için çalışan audit mantığı
- loader scriptlerinin tüm staging'i dolaşması
- her run'da geçmiş maçların tekrar tekrar update edilmesi

---

## 4. Hedef operasyon akışı

Yeni hafta geldiğinde ideal akış şu olacak:

1. Yeni hafta CSV hazırlanır
2. Parse sadece bu CSV için çalışır
3. Sadece o batch'e ait `batch_matches.json` üretilir
4. Sadece o batch staging'e yazılır
5. Audit sadece o batch için yapılır
6. Matches / incidents / player stats / team stats sadece o batch için load edilir
7. Run log sadece bu batch'in sonucunu gösterir

Yani:
- 8 yeni maç varsa parse = 8 maç
- load = 8 maç
- audit = 8 maç

244 eski maçı tekrar dolaşmak yok.

---

## 5. Batch tabanlı dosya yapısı

Önerilen yapı:

```text
 data/
   raw/
     opta_batches/
       2026-04-12_week31/
         input_matches.csv
         batch_matches.json
         batch_match_ids.txt
         single_matches/
           <match_id>.json
           <match_id>.json
```

Bu yapının faydası:
- Her batch izole olur
- Debug kolaylaşır
- Aynı batch tekrar çalıştırılabilir
- `all_matches.json` tek dev dosya olmak zorunda kalmaz

---

## 6. V4 ana bileşenleri

### 6.1 Parse

Girdi:
- sadece o batch CSV

Çıktı:
- `batch_matches.json`
- `batch_match_ids.txt`
- isteğe bağlı `single_matches/<match_id>.json`

Beklenen davranış:
- parse sadece yeni batch içindeki maçları işler
- çıktı batch klasörüne yazılır
- ana evren dosyasına bağımlılık azaltılır

---

### 6.2 Batch staging write

Yeni script önerisi:
- `bulk_write_match_json_staging_batch.py`

Girdi:
- `batch_matches.json`

Davranış:
- sadece bu batch staging'e upsert edilir
- geçmiş staging kayıtları tekrar dolaşılmaz

Beklenen kazanç:
- yazma süresi batch boyutuna düşer

---

### 6.3 Batch audit

Yeni script önerisi:
- `audit_match_json_staging_batch.py`

Girdi:
- `batch_match_ids.txt`

Davranış:
- audit sadece listedeki `source_match_id` kayıtlarını kontrol eder

Not:
- full audit script yine sistemde kalabilir
- ama operasyonel kullanımda batch audit kullanılmalı

---

### 6.4 Batch-scoped loaders

Aşağıdaki loader'lar sadece batch içindeki maçlar için çalışmalı:

- `load_staging_to_football_matches.py`
- `load_staging_to_football_match_incidents.py`
- `load_staging_to_football_match_player_stats_opta_points.py`
- `load_staging_to_football_match_player_stats_details.py`
- `load_staging_to_football_match_team_stats.py`

Tercih edilen yöntem:
- Mevcut scriptleri parametreli hale getirmek
- Örnek parametre: `--match-ids-file path/to/batch_match_ids.txt`

Filtre mantığı:
- `source = 'opta'`
- `source_match_id in batch list`

Bu kritik. V4'ün gerçek hız kazancı buradan gelir.

---

## 7. Master runner V4 mantığı

Yeni script:
- `football_master_pipeline_runner_v4.py`

Örnek kullanım:

```bash
python football_master_pipeline_runner_v4.py \
  --batch-label 2026-04-12_week31 \
  --batch-json data/raw/opta_batches/2026-04-12_week31/batch_matches.json \
  --match-ids-file data/raw/opta_batches/2026-04-12_week31/batch_match_ids.txt \
  --parse-enabled false
```

Beklenen step sırası:
1. parse (opsiyonel)
2. staging_bulk_write_batch
3. staging_audit_batch
4. load_matches_batch
5. load_match_incidents_batch
6. load_player_stats_opta_points_batch
7. load_player_stats_details_batch
8. load_team_stats_batch

---

## 8. `football.load_runs` yaklaşımı

Mevcut tablo ilk versiyon için yeterli.

Tutulması gereken ana alanlar:
- `pipeline_name`
- `pipeline_version`
- `input_path`
- `status`
- `run_summary`

İsteğe bağlı ek iyileştirmeler:
- `batch_label`
- `batch_match_count`
- `batch_scope` (`incremental` / `full`)
- `batch_match_ids_preview`

Ama bunlar V4'ün ilk çalışır versiyonu için zorunlu değil.

---

## 9. Full rebuild ne olacak?

Silinmeyecek.

Ama günlük/haftalık operasyonda kullanılmayacak.

İki mod olacak:

### Full rebuild mode
Sadece şu durumlarda:
- veri modeli değiştiyse
- parser büyük değiştiyse
- tüm geçmiş normalize veri yeniden kurulacaksa

### Incremental mode
Normal kullanım:
- yeni hafta
- yeni batch
- sadece yeni maçlar

Bu ayrımı yapmadan operasyon temiz kalmaz.

---

## 10. Beklenen performans farkı

Şu an:
- 8 yeni maç geldiğinde tüm staging / normalize evren tekrar taranıyor

V4 sonrası:
- 8 yeni maç geldiğinde sadece o 8 maç parse / audit / load edilir

Sonuç:
- saatlik akış dakikalara düşer
- gereksiz upsert yükü azalır
- log okumak kolaylaşır
- batch bazlı sorun ayıklama mümkün olur

---

## 11. Riskler

### Risk 1 - Aynı batch ikinci kez çalıştırılır
Çözüm:
- insert-only değil, batch-scoped upsert

### Risk 2 - Batch path karışıklığı
Çözüm:
- her batch için tek klasör
- tek `batch_match_ids.txt`
- tek `batch_matches.json`

### Risk 3 - Eski full pipeline ile yeni incremental pipeline karışır
Çözüm:
- net script isimlendirmesi
- `v3 = full-history`, `v4 = incremental`

### Risk 4 - Batch audit yerine yanlışlıkla full audit çalışır
Çözüm:
- runner içine açık step isimleri koymak
- log'da `batch_scope=incremental` göstermek

---

## 12. Uygulama sırası

### Faz 1
Parse çıktısını batch bazlı üret
- `batch_matches.json`
- `batch_match_ids.txt`

### Faz 2
Batch staging write scriptini oluştur
- `bulk_write_match_json_staging_batch.py`

### Faz 3
Batch audit scriptini oluştur
- `audit_match_json_staging_batch.py`

### Faz 4
Loader scriptlerine batch filter ekle
- `--match-ids-file`

### Faz 5
Master runner V4 oluştur
- batch scope
- batch log
- batch run summary

---

## 13. Operasyonel kullanım örneği

Haftalık kullanım:

### Adım 1
Yeni hafta CSV hazırlanır

Örnek:
```text
matches_week32.csv
```

### Adım 2
Parse batch çalışır

### Adım 3
V4 pipeline çalışır

### Adım 4
Son run kontrol edilir
- `success` ise batch temiz
- `partial` ise sadece bu batch içinde warning aranır

Bu kadar.

---

## 14. Net sonuç

Backfill dönemi için mevcut tam tarama modeli kabul edilebilirdi.
Ama operasyonel kullanımda aynı mimariyi sürdürmek hatalı.

Doğru model:

**Incremental batch-scoped upsert pipeline**

Bu sayede:
- yeni maçlar hızlı işlenir
- geçmiş veri gereksiz yere tekrar dolaşılmaz
- duplicate riski kontrol altında kalır
- weekly operasyon sürdürülebilir hale gelir

---

## 15. Bir sonraki teknik adım

İlk uygulanacak parçalar:
1. parse scriptinin batch output üretmesi
2. `batch_match_ids.txt` üretimi
3. `bulk_write_match_json_staging_batch.py`

Bunlar tamamlanınca V4'ün omurgası kurulmuş olur.
