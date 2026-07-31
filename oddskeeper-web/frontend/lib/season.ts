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

// Takvime göre içinde bulunulan futbol sezonu. Türkiye ligleri Ağustos–Mayıs
// oynanır; sezon etiketi Temmuz'da (ay index 6) yeni sezona döner. Örn.
// 2026-07-31 -> "2026/2027", 2027-05-01 -> "2026/2027", 2026-06-15 -> "2025/2026".
export function currentSeasonLabel(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
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
