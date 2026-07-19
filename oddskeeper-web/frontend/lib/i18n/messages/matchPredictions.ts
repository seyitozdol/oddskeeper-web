import { defineMessages } from "../defineMessages";

// Bu namespace ceviri gecisi sirasinda doldurulur.
export const matchPredictions = defineMessages({
  en: {
    overLabel: "Over",
    underLabel: "Under",

    modelDescriptionLabel:
      "Dixon-Coles + xG · Team home advantage · Form adjustment · Isotonic calibration · Süper Lig 2025/2026",
    rpsSkillLabel: "RPS skill",
    accuracyLabel: "Accuracy",
    backtestLabel: "{count} match backtest",

    paybackLabel: "Payback %",

    homeWinLabel: "Home win",
    drawLabel: "Draw",
    awayWinLabel: "Away win",
    oddsFormulaLabel: "Odds = payback / probability",

    noPredictionsFound:
      "No upcoming predictions found. Run the model script to generate predictions.",

    matchCountOne: "1 match",
    matchesCount: "{count} matches",
  },
  tr: {
    overLabel: "Üst",
    underLabel: "Alt",

    modelDescriptionLabel:
      "Dixon-Coles + xG · Ev sahibi avantajı · Form ayarlaması · İzotonik kalibrasyon · Süper Lig 2025/2026",
    rpsSkillLabel: "RPS skill",
    accuracyLabel: "Doğruluk",
    backtestLabel: "{count} maçlık backtest",

    paybackLabel: "Payback %",

    homeWinLabel: "Ev sahibi galibiyeti",
    drawLabel: "Beraberlik",
    awayWinLabel: "Deplasman galibiyeti",
    oddsFormulaLabel: "Oran = payback / olasılık",

    noPredictionsFound:
      "Yaklaşan tahmin bulunamadı. Tahmin üretmek için model scriptini çalıştırın.",

    matchCountOne: "1 maç",
    matchesCount: "{count} maç",
  },
});
