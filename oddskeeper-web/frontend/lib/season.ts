// "2025/2026" -> "2024/2025". Formata uymayan girdide null döner.
export function previousSeasonLabel(
  seasonLabel: string | null | undefined
): string | null {
  if (!seasonLabel) {
    return null;
  }

  const match = seasonLabel.match(/^(\d{4})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const start = Number(match[1]) - 1;
  const end = Number(match[2]) - 1;
  return `${start}/${end}`;
}

// Takvime göre içinde bulunulan futbol sezonu. Sınır: 24 HAZİRAN (sahip kararı
// 2026-08-19): eski sezonun en geç biten maçı CL finali (~30 Mayıs), yeni sezonun
// ilk maçı Avrupa ön elemeleri (~7 Temmuz); 24 Haziran iki yönde de pay bırakır.
// DB eşi AYNI sınırla: ref.current_season_label(). Örn. 2026-06-23 -> "2025/2026",
// 2026-06-24 -> "2026/2027", 2027-01-05 -> "2026/2027".
export function currentSeasonLabel(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11 (5 = Haziran)
  const newSeason = m > 5 || (m === 5 && date.getDate() >= 24);
  return newSeason ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// İki sezon etiketinden kronolojik olarak daha yeni olanı döner. Takvim sezonu
// veri sezonunun gerisinde kalmasın diye kullanılır (max(takvim, en_yeni_veri)).
export function latestSeasonLabel(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return a.localeCompare(b) >= 0 ? a : b;
}
