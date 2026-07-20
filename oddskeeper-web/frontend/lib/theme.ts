export const THEMES = ["night", "calimla-light", "calimla-dark"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "night";

export const THEME_COOKIE = "ok_theme";

export const THEME_LABEL_KEYS: Record<Theme, string> = {
  night: "nav.themeNight",
  "calimla-light": "nav.themeCalimlaLight",
  "calimla-dark": "nav.themeCalimlaDark",
};

export function isTheme(value: string | undefined | null): value is Theme {
  return THEMES.includes(value as Theme);
}
