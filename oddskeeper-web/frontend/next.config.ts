import path from "path";
import type { NextConfig } from "next";

// Bayat sekme koruması: build anındaki deployment kimliği client bundle'a
// gömülür (VersionGuard bunu /api/version'daki canlı kimlikle karşılaştırır).
// Vercel VERCEL_GIT_COMMIT_SHA'yı hem build hem runtime'da aynı verir; lokalde
// "dev" olur ve guard hiç tetiklenmez.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  "dev";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/football/**",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
      {
        // Transfermarkt oyuncu fotograflari (transfer tablosu)
        protocol: "https",
        hostname: "img.a.transfermarkt.technology",
        pathname: "/**",
      },
      {
        // Transfermarkt kulup amblemleri
        protocol: "https",
        hostname: "tmssl.akamaized.net",
        pathname: "/**",
      },
      {
        // FlashScore (1. Lig takim logolari + oyuncu fotograflari)
        protocol: "https",
        hostname: "static.flashscore.com",
        pathname: "/**",
      },
      {
        // SofaScore oyuncu fotograflari (sentetik/yeni transfer kadro kayitlari)
        protocol: "https",
        hostname: "img.sofascore.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.sofascore.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;