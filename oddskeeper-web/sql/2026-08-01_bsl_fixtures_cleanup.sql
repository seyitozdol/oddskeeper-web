-- BSL 2025-2026 bb_fixtures temizligi.
-- basketball.fixtures'ta kalan 8 Excel-artigi satir (2 oynanmis mac + 6 bos/NULL)
-- tamamlanmis sezonda "yaklasan mac" olarak gorunuyordu. TBF ile dogrulandi:
-- fixture 31 = mac 304108 (Besiktas 87-80 Bahcesehir), fixture 32 = mac 304109
-- (Anadolu Efes 73-89 Fenerbahce) — IKISI DE team_match_stats'ta ZATEN var (excel_v38).
-- Eksik veri yok; stale fixture satirlari siliniyor → hub Fixtures sekmesi dogru sekilde bos.
delete from basketball.fixtures where season_label = '2025-2026';
