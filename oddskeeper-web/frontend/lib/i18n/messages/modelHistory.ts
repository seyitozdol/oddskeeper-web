import { defineMessages } from "../defineMessages";

// Model export gecmisi (Match/Player Stats Model + basketbol/voleybol ortak).
// Add to Input'un solundaki gecmis dropdown'i ve Config sekmesindeki saklama
// suresi ayari bu metinleri paylasir.
export const modelHistory = defineMessages({
  en: {
    button: "History",
    empty: "No export history yet.",
    loading: "Loading…",
    restored: "Loaded from history.",
    fixtureGone: "This fixture is no longer in the list.",
    cfgTitle: "Export history",
    cfgRetention: "Keep export history (days)",
    cfgRetentionNote:
      "History is written only when you Export to Excel. Records older than this are deleted automatically on the next export.",
    cfgSave: "Save",
    cfgSaved: "Saved",
    cfgSaveFailed: "Save failed",
  },
  tr: {
    button: "Geçmiş",
    empty: "Henüz export geçmişi yok.",
    loading: "Yükleniyor…",
    restored: "Geçmişten yüklendi.",
    fixtureGone: "Bu fikstür artık listede yok.",
    cfgTitle: "Export geçmişi",
    cfgRetention: "Export geçmişi saklama (gün)",
    cfgRetentionNote:
      "Geçmiş yalnızca Excel'e Export ettiğinde yazılır. Bu süreden eski kayıtlar bir sonraki export'ta otomatik silinir.",
    cfgSave: "Kaydet",
    cfgSaved: "Kaydedildi",
    cfgSaveFailed: "Kayıt başarısız",
  },
});
