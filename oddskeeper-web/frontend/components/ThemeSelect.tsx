"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "../lib/i18n/LanguageProvider";
import {
  THEME_COOKIE,
  THEME_LABEL_KEYS,
  THEMES,
  type Theme,
} from "../lib/theme";

type ThemeSelectProps = {
  currentTheme: Theme;
};

export default function ThemeSelect({ currentTheme }: ThemeSelectProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function applyTheme(next: Theme) {
    setTheme(next);
    setIsOpen(false);
    // Anında görsel geçiş; cookie ile sunucu tarafı da kalıcı olur.
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-veil px-2.5 text-ink-2 transition hover:border-line-strong hover:text-ink"
        title={t("nav.theme")}
      >
        <PaletteIcon />
      </button>

      <div
        className={`absolute right-0 top-full z-50 pt-2 transition duration-200 ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        }`}
      >
        <div className="w-[190px] rounded-xl border border-line bg-card p-1.5 shadow-lg">
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => applyTheme(option)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] transition hover:bg-veil ${
                theme === option ? "font-semibold text-ink" : "text-ink-2"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ThemeSwatch theme={option} />
                {t(THEME_LABEL_KEYS[option])}
              </span>
              {theme === option ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  const swatch =
    theme === "night"
      ? { bg: "#0a1424", dot: "#4da2ff" }
      : theme === "calimla-light"
      ? { bg: "#faf6ee", dot: "#b8472b" }
      : { bg: "#221c17", dot: "#c2502e" };

  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] border border-line"
      style={{ backgroundColor: swatch.bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: swatch.dot }}
      />
    </span>
  );
}

function PaletteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21a9 9 0 1 1 9-9c0 2-2 3-4 3h-1a2 2 0 0 0-2 2v1a2 2 0 0 1-2 3Z" />
      <circle cx="7.5" cy="11.5" r="0.6" />
      <circle cx="11" cy="7.5" r="0.6" />
      <circle cx="15.5" cy="9.5" r="0.6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
