"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

// Player Participant Tools ekraninin ustundeki buyuk lig secici. TSL ve
// 1. Lig ayni araci iki farkli veri kaynagiyla sunar; toggle ilgili sayfaya
// gecer. TSL: /dashboard/player-market-prediction, 1. Lig:
// /dashboard/tff-1-lig/player-market.
const TSL_HREF = "/dashboard/player-market-prediction";
const TFF1_HREF = "/dashboard/tff-1-lig/player-market";

export default function PlayerMarketLeagueToggle({
  active,
}: {
  active: "tsl" | "1lig";
}) {
  const router = useRouter();

  return (
    <div className="flex justify-center">
      <div className="relative inline-flex w-[300px] items-center rounded-full border border-line bg-card p-1">
        {/* Kayan gosterge: aktif tarafa gecer */}
        <span
          className={`pointer-events-none absolute top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full bg-veil shadow-sm transition-all duration-300 ease-out ${
            active === "tsl" ? "left-1" : "left-1/2"
          }`}
        />

        <button
          type="button"
          onClick={() => {
            if (active !== "tsl") router.push(TSL_HREF);
          }}
          className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold transition ${
            active === "tsl" ? "text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          <Image
            src="/images/leagues/super-lig.png"
            alt=""
            width={18}
            height={18}
            className="object-contain"
          />
          <span>TSL</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (active !== "1lig") router.push(TFF1_HREF);
          }}
          className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold transition ${
            active === "1lig" ? "text-ink" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          <Image
            src="/images/leagues/tff-1-lig.png"
            alt=""
            width={18}
            height={18}
            className="object-contain"
          />
          <span>1. Lig</span>
        </button>
      </div>
    </div>
  );
}
