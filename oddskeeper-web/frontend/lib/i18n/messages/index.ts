import type { Locale } from "../config";
import { adminUsers } from "./adminUsers";
import { auth } from "./auth";
import { basketball } from "./basketball";
import { common } from "./common";
import { dashboardHome } from "./dashboardHome";
import { landing } from "./landing";
import { matchDetail } from "./matchDetail";
import { metrics } from "./metrics";
import { modelHistory } from "./modelHistory";
import { msm } from "./msm";
import { nav } from "./nav";
import { notes } from "./notes";
import { playerDetail } from "./playerDetail";
import { playerMarket } from "./playerMarket";
import { statsHub } from "./statsHub";
import { teamDetail } from "./teamDetail";
import { tff1 } from "./tff1";
import { tsl } from "./tsl";
import { upcomingEvents } from "./upcomingEvents";
import { volleyball } from "./volleyball";

const MESSAGES: Record<
  string,
  { en: Record<string, string>; tr: Record<string, string> }
> = {
  adminUsers,
  auth,
  basketball,
  common,
  dashboardHome,
  landing,
  matchDetail,
  metrics,
  modelHistory,
  msm,
  nav,
  notes,
  playerDetail,
  playerMarket,
  statsHub,
  teamDetail,
  tff1,
  tsl,
  upcomingEvents,
  volleyball,
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
