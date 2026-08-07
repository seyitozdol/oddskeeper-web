// 1. Lig (tff1) SofaScore team_id -> MSM/notes slug haritası.
//
// KAYNAK: sql/2026-08-06_msm_fixtures_tff1.sql içindeki team_map ile BİREBİR
// aynı olmalı. MSM tff1 fikstürleri bu slug uzayında çalışıyor; takım notları
// da aynı slug'a bağlanır ki 1. Lig takım sayfasında eklenen not MSM 1X2
// rozetinde görünsün. Sezon başında lig kadrosu değişince İKİ dosya da
// birlikte güncellenmeli.
export const TFF1_TEAM_SLUG_BY_ID: Record<string, string> = {
  "3056": "antalyaspor",
  "44320": "bandirmaspor",
  "3099": "batmanspor",
  "202390": "bodrum",
  "6414": "boluspor",
  "3055": "bursaspor",
  "262480": "esenler-erokspor",
  "4954": "karagumruk",
  "388264": "igdir-fk",
  "3066": "istanbulspor",
  "3072": "kayserispor",
  "6366": "keciorengucu",
  "202391": "manisa-fk",
  "296730": "mardinspor",
  "7034": "muglaspor",
  "7032": "pendikspor",
  "4952": "sariyer",
  "3076": "sivasspor",
  "55625": "umraniyespor",
  "24750": "vanspor-fk",
};

// team_id için notes slug'ı; haritada yoksa null (o takım için not gösterilmez).
export function tff1SlugForTeamId(teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  return TFF1_TEAM_SLUG_BY_ID[teamId] ?? null;
}
