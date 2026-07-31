import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
    ],
  },
};

export default nextConfig;