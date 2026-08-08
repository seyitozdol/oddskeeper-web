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
    deleteConfirm: "Delete?",
    deleteYes: "Yes",
    deleteNo: "No",
    cfgTitle: "Export history",
    cfgRetention: "Keep export history (days)",
    cfgRetentionNote:
      "History is written only when you Export to Excel. Records older than this are deleted automatically on the next export.",
    cfgSave: "Save",
    cfgSaved: "Saved",
    cfgSaveFailed: "Save failed",
    suspendTitle: "Suspend missing lines (SU)",
    suspendLabel: "On correction, suspend previously-sent lines that are gone",
    suspendNote:
      "When you continue from history and re-export, lines you sent before but are no longer present are added to the new file with Market Status = SU.",
  },
  tr: {
    button: "Geçmiş",
    empty: "Henüz export geçmişi yok.",
    loading: "Yükleniyor…",
    restored: "Geçmişten yüklendi.",
    fixtureGone: "Bu fikstür artık listede yok.",
    deleteConfirm: "Sil?",
    deleteYes: "Evet",
    deleteNo: "Vazgeç",
    cfgTitle: "Export geçmişi",
    cfgRetention: "Export geçmişi saklama (gün)",
    cfgRetentionNote:
      "Geçmiş yalnızca Excel'e Export ettiğinde yazılır. Bu süreden eski kayıtlar bir sonraki export'ta otomatik silinir.",
    cfgSave: "Kaydet",
    cfgSaved: "Kaydedildi",
    cfgSaveFailed: "Kayıt başarısız",
    suspendTitle: "Eksik line'ları askıya al (SU)",
    suspendLabel: "Düzeltmede, önceki gönderilip kaybolan line'ları askıya al",
    suspendNote:
      "Geçmişten devam edip yeniden export ettiğinde, önceden gönderdiğin ama artık bulunmayan line'lar yeni dosyaya Market Status = SU ile eklenir.",
  },
});
