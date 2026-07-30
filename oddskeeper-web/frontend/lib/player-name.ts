// Bilindik oyuncu ismi kurali (SQL analytics.team_current_squad_profile_v1.
// display_name ile ayni). apifootball kadro ismi bilindik isimdir ("Talisca",
// "Ederson") ve kisaltmasizsa aynen kullanilir. "L. Torreira" gibi kisaltmali
// ise bas harf, bio first_name icindeki bas harfe uyan kelimeyle acilir
// ("Lucas Torreira", "K. Aktürkoğlu" + "Muhammed Kerem" -> "Kerem Aktürkoğlu");
// uyan kelime yoksa first_name'in ilk kelimesi kullanilir. Resmi uzun isimler
// ("Anderson Souza Conceição") display icin KULLANILMAZ; boylece siralama ve
// profil sayfalari oyuncuyu taninan adiyla gosterir.
export function knownDisplayName(
  playerName: string | null | undefined,
  firstName: string | null | undefined
): string {
  if (!playerName) return "";
  const m = playerName.match(/^(\p{Lu})\.\s*(.+)$/u);
  if (m) {
    const words = (firstName ?? "").split(" ").filter(Boolean);
    const first = words.find((w) => w.startsWith(m[1])) ?? words[0];
    if (first) return `${first} ${m[2]}`;
  }
  return playerName;
}
