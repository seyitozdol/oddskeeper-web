import { defineMessages } from "../defineMessages";

// Bu namespace ceviri gecisi sirasinda doldurulur.
export const deepPrediction = defineMessages({
  en: {
    kicker: "Deep Prediction ML2",
    title: "Match shot predictions",
    searchPlaceholder: "Search fixture...",

    confidenceHigh: "High",
    confidenceMedium: "Medium",
    confidenceLow: "Low",

    noFixturesMatch: "No fixtures matched your filter.",
    noSelectedFixture: "No selected fixture.",

    totalLabel: "Total",
    edgeLabel: "Edge",
  },
  tr: {
    kicker: "Derin Tahmin ML2",
    title: "Maç şut tahminleri",
    searchPlaceholder: "Fikstür ara...",

    confidenceHigh: "Yüksek",
    confidenceMedium: "Orta",
    confidenceLow: "Düşük",

    noFixturesMatch: "Filtrenize uyan fikstür yok.",
    noSelectedFixture: "Seçili fikstür yok.",

    totalLabel: "Toplam",
    edgeLabel: "Avantaj",
  },
});
