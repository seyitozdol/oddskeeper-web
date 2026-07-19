import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { translate, type TranslateParams, type Translator } from "./messages";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// Server component'lerde: const t = await getT();
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  return (key: string, params?: TranslateParams) =>
    translate(locale, key, params);
}
