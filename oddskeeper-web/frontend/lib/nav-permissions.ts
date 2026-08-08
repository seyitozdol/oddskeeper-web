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
  "volleyball",
  "tff-1-lig",
  // Match Stats Model içindeki GSheet alt sekmesi. Bir header/route DEĞİL, salt
  // erişim bayrağı: admin panelindeki access listesinde görünür, MSM içindeki
  // GSheet sekmesi bu izne göre gösterilir/gizlenir (proxy path kilidi yok).
  "msm-gsheet",
  // Yenilikler (changelog) sayfasi: gercek bir route (/dashboard/changelog);
  // gorunurlugu admin access'ten yonetilir.
  "changelog",
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
    pathPrefixes: ["/dashboard/player-market-prediction"],
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
    href: "/dashboard/basketball",
    // Basketbol (TBSL) lig panosu: proxy bu bolumu league-tbl iznine gore
    // kilitler; team/player alt sayfalari da bu prefix'e duser.
    pathPrefixes: ["/dashboard/basketball"],
  },
  {
    key: "volleyball",
    labelKey: "nav.volleyball",
    href: "/dashboard/volleyball",
    // Voleybol (Türkiye kadın milli takım) panosu; team/player alt sayfalari
    // da bu prefix'e duser.
    pathPrefixes: ["/dashboard/volleyball"],
  },
  {
    key: "tff-1-lig",
    labelKey: "nav.tff1Lig",
    href: "/dashboard/tff-1-lig",
    pathPrefixes: ["/dashboard/tff-1-lig"],
  },
  {
    key: "msm-gsheet",
    labelKey: "nav.msmGsheet",
    // Gerçek bir sayfa değil (GSheet, Match Stats Model'de query-param'lı bir alt
    // sekme). href yalnızca "sadece bu izni olan" nadir kullanıcının /dashboard
    // yönlendirmesi için MSM sayfasına gider. pathPrefixes hiçbir gerçek yola
    // eşleşmeyen inert bir değerdir: proxy bu anahtarla asla kilit/açış yapmaz;
    // GSheet sekmesi gate'lemesi ResmiMatchStatsModel içinde yapılır.
    href: "/dashboard/stats-analysis/tsl/resmi?season=2026%2F2027&section=matchStatsModel",
    pathPrefixes: ["/__msm-gsheet__"],
  },
  {
    key: "changelog",
    labelKey: "nav.changelog",
    href: "/dashboard/changelog",
    pathPrefixes: ["/dashboard/changelog"],
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

// Bazi yollar birden fazla izinle acilabilir (OR mantigi). 1. Lig
// player-market ekrani ve oradan gidilen detay sayfalari (team/player/match)
// hem tff-1-lig hem player-market izniyle erisilebilir olmali; boylece
// tff-1-lig menusu kullanicilara kapali olsa da player-market izni olanlar
// Oyuncu Katilim Araclari toggle'i ile 1. Lig'e girip drill-down yapabilir.
// tff-1-lig izni olan kullanicilar da bu sayfalara normalde erismeye devam eder.
// Not: team/player/match prefix'leri sonunda "/" ile biter; boylece
// "/dashboard/tff-1-lig/matches" (tff-1-lig'e ait mac listesi) yanlislikla
// "match" prefix'ine dusup acilmaz, kapali kalir.
const SHARED_ACCESS_PREFIXES: { prefix: string; keys: NavKey[] }[] = [
  { prefix: "/dashboard/tff-1-lig/player-market", keys: ["player-market", "tff-1-lig"] },
  // 1. Lig Resmi deneyimi (league-1lig) takım/oyuncu/maç detaylarına link verir;
  // o deneyimi görebilen kullanıcı drill-down da yapabilmeli.
  { prefix: "/dashboard/tff-1-lig/team/", keys: ["player-market", "tff-1-lig", "league-1lig"] },
  { prefix: "/dashboard/tff-1-lig/player/", keys: ["player-market", "tff-1-lig", "league-1lig"] },
  { prefix: "/dashboard/tff-1-lig/match/", keys: ["player-market", "tff-1-lig", "league-1lig"] },
  // TSL Resmi deneyimi (league-tsl) oyuncu/takım/maç detayları için ortak
  // Stats & Analysis sayfalarına gider; league-tsl izni bunlara erişim vermeli
  // (yoksa TSL'den takıma/oyuncuya tıklayan kullanıcı /dashboard'a atılıyordu).
  // league-1lig da dahil: 1. Lig'den düşen takımların (ör. Kayserispor) 1. Lig
  // sayfası, geçmiş verisi için bu football profiline köprülenir.
  { prefix: "/dashboard/stats-analysis/football/team-stats/detail", keys: ["stats-analysis", "league-tsl", "league-1lig"] },
  { prefix: "/dashboard/stats-analysis/football/player-stats/detail", keys: ["stats-analysis", "league-tsl", "league-1lig"] },
  { prefix: "/dashboard/stats-analysis/football/match-stats/detail", keys: ["stats-analysis", "league-tsl", "league-1lig"] },
];

// Proxy middleware bu fonksiyonu kullanir: bir yolu acmak icin gereken
// izin anahtarlarini dondurur. Birden fazla anahtar donerse OR gecerlidir
// (herhangi biri yeterli). Eslesme yoksa null (izin kontrolu yok).
export function navAccessKeysForPath(pathname: string): NavKey[] | null {
  // Once en uzun eslesen shared-access prefix'i (OR listesi) dene.
  let sharedKeys: NavKey[] | null = null;
  let sharedLen = -1;
  for (const item of SHARED_ACCESS_PREFIXES) {
    if (pathname.startsWith(item.prefix) && item.prefix.length > sharedLen) {
      sharedKeys = item.keys;
      sharedLen = item.prefix.length;
    }
  }
  if (sharedKeys) return sharedKeys;

  const single = navKeyForPath(pathname);
  return single ? [single] : null;
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
