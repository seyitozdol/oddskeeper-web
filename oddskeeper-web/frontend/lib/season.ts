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
