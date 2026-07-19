import { defineMessages } from "../defineMessages";

// Bu namespace ceviri gecisi sirasinda doldurulur.
export const playerMarket = defineMessages({
  en: {
    statusPosStarter: "Pos. Starter",
    statusPosSub: "Pos. Sub",
    statusOut: "Out",

    columnStatus: "Status",
    avgLabel: "Avg",
    last5AvgLabel: "Last 5 Avg",
    distExpLabel: "Dist. Exp",
    manualLabel: "Manual",
    oddsColumnLabel: "Odds",
    overLineLabel: "Over {line}",

    pageTitle: "Player Market Prediction",
    pageSubtitle: "Select a fixture and market to calculate player-level odds.",

    fixtureLabel: "Fixture",
    selectFixturePlaceholder: "Select fixture",
    marketLabel: "Market",
    homeExpLabel: "Home Exp.",
    awayExpLabel: "Away Exp.",
    paybackLabel: "Payback %",

    selectFixturePrompt: "Start by selecting a fixture.",

    accessRestrictedTitle: "Access Restricted",
    accessRestrictedDescription:
      "Sorry, you don't have access to this page right now. If you'd like to request access, please enter your email address below.",
    requestSentMessage: "Your request has been sent. We'll get back to you shortly.",
    invalidEmailError: "Please enter a valid email address.",
    genericError: "Something went wrong. Please try again.",
    sendingLabel: "Sending…",
    sendAccessRequestLabel: "Send Access Request",
  },
  tr: {
    statusPosStarter: "Muhtemel İlk 11",
    statusPosSub: "Muhtemel Yedek",
    statusOut: "Oynamıyor",

    columnStatus: "Durum",
    avgLabel: "Ort.",
    last5AvgLabel: "Son 5 Ort.",
    distExpLabel: "Dağıtılan Bek.",
    manualLabel: "Manuel",
    oddsColumnLabel: "Oran",
    overLineLabel: "Üst {line}",

    pageTitle: "Oyuncu Piyasası Tahmini",
    pageSubtitle: "Oyuncu bazlı oranları hesaplamak için fikstür ve market seçin.",

    fixtureLabel: "Fikstür",
    selectFixturePlaceholder: "Fikstür seç",
    marketLabel: "Market",
    homeExpLabel: "Ev Bek.",
    awayExpLabel: "Deplasman Bek.",
    paybackLabel: "Payback %",

    selectFixturePrompt: "Fikstür seçerek başlayın.",

    accessRestrictedTitle: "Erişim Kısıtlı",
    accessRestrictedDescription:
      "Üzgünüz, şu anda bu sayfaya erişiminiz yok. Erişim talep etmek isterseniz aşağıya e-posta adresinizi girin.",
    requestSentMessage: "Talebiniz gönderildi. En kısa sürede size dönüş yapacağız.",
    invalidEmailError: "Lütfen geçerli bir e-posta adresi girin.",
    genericError: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
    sendingLabel: "Gönderiliyor…",
    sendAccessRequestLabel: "Erişim Talebi Gönder",
  },
});
