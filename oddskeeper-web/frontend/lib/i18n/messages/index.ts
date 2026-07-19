import type { Locale } from "../config";
import { auth } from "./auth";
import { common } from "./common";
import { dashboardHome } from "./dashboardHome";
import { deepPrediction } from "./deepPrediction";
import { landing } from "./landing";
import { leagueDetail } from "./leagueDetail";
import { matchDetail } from "./matchDetail";
import { matchPredictions } from "./matchPredictions";
import { metrics } from "./metrics";
import { nav } from "./nav";
import { playerDetail } from "./playerDetail";
import { playerMarket } from "./playerMarket";
import { smartPrediction } from "./smartPrediction";
import { statsHub } from "./statsHub";
import { teamDetail } from "./teamDetail";

const MESSAGES: Record<
  string,
  { en: Record<string, string>; tr: Record<string, string> }
> = {
  auth,
  common,
  dashboardHome,
  deepPrediction,
  landing,
  leagueDetail,
  matchDetail,
  matchPredictions,
  metrics,
  nav,
  playerDetail,
  playerMarket,
  smartPrediction,
  statsHub,
  teamDetail,
};

export type TranslateParams = Record<string, string | number>;

export type Translator = (key: string, params?: TranslateParams) => string;

// key formatı: "namespace.mesajAnahtarı" (ör. "nav.playerStats").
// Çeviri yoksa İngilizceye, o da yoksa anahtarın kendisine düşer.
export function translate(
  locale: Locale,
  key: string,
  params?: TranslateParams
): string {
  const dotIndex = key.indexOf(".");
  const namespace = dotIndex === -1 ? "" : key.slice(0, dotIndex);
  const messageKey = dotIndex === -1 ? key : key.slice(dotIndex + 1);

  const bundle = MESSAGES[namespace];
  const text = bundle?.[locale]?.[messageKey] ?? bundle?.en?.[messageKey] ?? key;

  if (!params) {
    return text;
  }

  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name])
  );
}
