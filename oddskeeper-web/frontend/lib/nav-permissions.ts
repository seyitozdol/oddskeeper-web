// Header'daki ana basliklarin erisim anahtarlari. Admin paneli
// (dashboard/admin/users) kullanici basina bu anahtarlardan izinli olanlari
// public.user_nav_permissions.allowed_keys dizisine yazar; NULL/satirsiz
// kullanici tum basliklara erisebilir. Hem client (app-header), hem server
// (layout, admin API), hem proxy middleware bu modulu kullanir.

export const NAV_KEYS = [
  "smart-prediction",
  "deep-prediction-ml",
  "match-predictions",
  "player-market",
  "stats-analysis",
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
    pathPrefixes: ["/dashboard/player-market-prediction"],
  },
  {
    key: "stats-analysis",
    labelKey: "nav.statsAnalysis",
    href: "/dashboard/stats-analysis",
    pathPrefixes: ["/dashboard/stats-analysis"],
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
  for (const item of NAV_PERMISSION_ITEMS) {
    for (const prefix of item.pathPrefixes) {
      // Duz startsWith: "/dashboard/deep-prediction-ml" prefix'i
      // deep-prediction-ml2 rotasini da kapsamali.
      if (pathname.startsWith(prefix)) {
        return item.key;
      }
    }
  }
  return null;
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")
  );
}
