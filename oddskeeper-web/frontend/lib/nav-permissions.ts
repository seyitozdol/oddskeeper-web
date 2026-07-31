// Header'daki ana basliklarin erisim anahtarlari. Admin paneli
// (dashboard/admin/users) kullanici basina bu anahtarlardan izinli olanlari
// public.user_nav_permissions.allowed_keys dizisine yazar; NULL/satirsiz
// kullanici tum basliklara erisebilir. Hem client (app-header), hem server
// (layout, admin API), hem proxy middleware bu modulu kullanir.

export const NAV_KEYS = [
  "upcoming-events",
  "smart-prediction",
  "deep-prediction-ml",
  "match-predictions",
  "player-market",
  "stats-analysis",
  // Header'daki lig kisayollari (Stats & Analysis'ten bagimsiz kontrol edilir).
  // league-tsl'in temiz bir yol prefix'i var (proxy'de gercekten kilitlenir);
  // league-1lig ve league-tbl query-param ile paylasilan Stats sayfalarina
  // gider, bu yuzden yalnizca header gorunurlugunu kontrol eder.
  "league-tsl",
  "league-1lig",
  "league-tbl",
  "tff-1-lig",
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

export type NavPermissionItem = {
  key: NavKey;
  labelKey: string;
  href: string;
  pathPrefixes: string[];
};

export const NAV_PERMISSION_ITEMS: NavPermissionItem[] = [
  {
    key: "upcoming-events",
    labelKey: "nav.upcomingEvents",
    href: "/dashboard/upcoming-events",
    pathPrefixes: ["/dashboard/upcoming-events"],
  },
  {
    key: "smart-prediction",
    labelKey: "nav.smartPrediction",
    href: "/dashboard/smart-prediction",
    pathPrefixes: ["/dashboard/smart-prediction"],
  },
  {
    key: "deep-prediction-ml",
    labelKey: "nav.deepPredictionMl",
    href: "/dashboard/deep-prediction-ml2",
    // ml ve ml2 rotalarinin ikisini de kapsar
    pathPrefixes: ["/dashboard/deep-prediction-ml"],
  },
  {
    key: "match-predictions",
    labelKey: "nav.matchPredictions",
    href: "/dashboard/match-predictions",
    pathPrefixes: ["/dashboard/match-predictions"],
  },
  {
    key: "player-market",
    labelKey: "nav.playerMarket",
    href: "/dashboard/player-market-prediction",
    // 1. Lig player-market ekrani da (Oyuncu Katilim Araclari toggle'inin
    // 1. Lig tarafi) bu izne baglidir. Yol tff-1-lig altinda olsa da bu daha
    // ozgul prefix, navKeyForPath'te tff-1-lig prefix'ini yener; boylece
    // tff-1-lig izni kapali kullanicilar da player-market izniyle girebilir.
    pathPrefixes: [
      "/dashboard/player-market-prediction",
      "/dashboard/tff-1-lig/player-market",
    ],
  },
  {
    key: "stats-analysis",
    labelKey: "nav.statsAnalysis",
    href: "/dashboard/stats-analysis",
    pathPrefixes: ["/dashboard/stats-analysis"],
  },
  {
    key: "league-tsl",
    labelKey: "nav.leagueTsl",
    href: "/dashboard/stats-analysis/tsl/resmi?season=2026%2F2027&section=league",
    // Temiz yol: proxy bu rotayi league-tsl iznine gore kilitler.
    pathPrefixes: ["/dashboard/stats-analysis/tsl"],
  },
  {
    key: "league-1lig",
    labelKey: "nav.league1Lig",
    href: "/dashboard/stats-analysis/tff1/resmi?season=2026%2F2027&section=league",
    // Temiz yol (Resmi deneyimi): proxy bu rotayi league-1lig iznine gore
    // kilitler. TSL ile ayni mantik.
    pathPrefixes: ["/dashboard/stats-analysis/tff1"],
  },
  {
    key: "league-tbl",
    labelKey: "nav.leagueTbl",
    href: "/dashboard/stats-analysis?sport=basketball&view=team",
    pathPrefixes: [],
  },
  {
    key: "tff-1-lig",
    labelKey: "nav.tff1Lig",
    href: "/dashboard/tff-1-lig",
    pathPrefixes: ["/dashboard/tff-1-lig"],
  },
];

export function isValidNavKey(value: string): value is NavKey {
  return (NAV_KEYS as readonly string[]).includes(value);
}

// allowedKeys NULL ise kisitlama yok (tam erisim).
export function isNavKeyAllowed(
  key: NavKey,
  allowedKeys: string[] | null | undefined
): boolean {
  if (allowedKeys == null) return true;
  return allowedKeys.includes(key);
}

export function navKeyForPath(pathname: string): NavKey | null {
  // En uzun (en ozgul) eslesen prefix kazanir; boylece
  // "/dashboard/stats-analysis/tsl" league-tsl'e giderken
  // "/dashboard/stats-analysis/football" stats-analysis'e gider.
  let best: NavKey | null = null;
  let bestLen = -1;
  for (const item of NAV_PERMISSION_ITEMS) {
    for (const prefix of item.pathPrefixes) {
      if (pathname.startsWith(prefix) && prefix.length > bestLen) {
        best = item.key;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")
  );
}
