import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider } from "../lib/i18n/LanguageProvider";
import { getLocale } from "../lib/i18n/server";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "../lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OddsKeeper",
  description: "OddsKeeper",
  icons: {
    icon: [
      { url: "/logos/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/logos/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/logos/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/logos/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/logos/apple-touch-icon.png",
    shortcut: "/logos/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  const themeValue = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(themeValue) ? themeValue : DEFAULT_THEME;

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
