// Takım alias yardımcıları (ref.team_profiles.short_name / code).
// Dar alanlarda resmi ad yerine kısa ad ("Beşiktaş Jimnastik Kulübü" ->
// "Beşiktaş"), fikstür satırlarında logo yanında kod (BJK, GS...) kullanılır.
// Alias kaydı olmayan (eski sezon / düşen) takımlar için resmi addan sonek
// kırpan geri düşüş vardır.

export type TeamAlias = {
  short_name: string | null;
  code: string | null;
};

export type TeamAliasMap = Record<string, TeamAlias>;

// "X Spor Kulübü" / "X Jimnastik Kulübü" / "X Futbol Kulübü" / "X Kulübü"
// soneklerini kırpar; eşleşme yoksa adı olduğu gibi bırakır.
export function stripOfficialTeamSuffix(name: string): string {
  const stripped = name.replace(
    /\s+(?:jimnastik|futbol|spor)?\s*kulübü$/i,
    ""
  );
  return stripped.trim() || name;
}

export function resolveShortTeamName(
  aliases: TeamAliasMap | null | undefined,
  teamSlug: string | null | undefined,
  fallbackName: string | null | undefined
): string {
  const alias = teamSlug ? aliases?.[teamSlug] : undefined;
  if (alias?.short_name) return alias.short_name;
  if (fallbackName) return stripOfficialTeamSuffix(fallbackName);
  return "—";
}

export function resolveTeamCode(
  aliases: TeamAliasMap | null | undefined,
  teamSlug: string | null | undefined,
  fallbackName: string | null | undefined
): string {
  const alias = teamSlug ? aliases?.[teamSlug] : undefined;
  if (alias?.code) return alias.code;
  // kod yoksa kısa addan ilk 3 harf (büyük) türetilir
  const short = resolveShortTeamName(aliases, teamSlug, fallbackName);
  return short === "—" ? short : short.slice(0, 3).toLocaleUpperCase("tr-TR");
}
