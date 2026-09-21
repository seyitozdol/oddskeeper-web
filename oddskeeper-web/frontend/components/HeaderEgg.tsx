"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Header surprizi (ic saka): gulen kafa; hover'da minik bir animasyonla opucuk
// pozuna gecer ve etrafa minik kalpler ucusur, tiklandikca daha cok ve
// rengarenk kalp patlar. Gorunurluk nav-permission "header-egg" anahtarina
// bagli (explicit-only, varsayilanda kimse gormez). Gorseller public/ altinda
// DEGIL ve repoda da YOK (repo public): private Supabase bucket'indan, ayni
// izinle korunan /api/header-egg ucu uzerinden gelir (next/image
// optimizer'i cerezsiz cektigi icin duz img). Changelog'a YAZILMAZ.

const SMILE_SRC = "/api/header-egg?pose=smile";
const KISS_SRC = "/api/header-egg?pose=kiss";

const HOVER_COLORS = ["#ff4d6d", "#ff758f", "#ff8fa3", "#e5383b"];
const RAINBOW_COLORS = [
  "#ff4d6d",
  "#ff9f1c",
  "#ffd60a",
  "#06d6a0",
  "#3a86ff",
  "#8338ec",
  "#ff5fd2",
  "#2ec4b6",
];

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

// Ayni anda ucusan kalp tavani (arka arkaya hizli tiklamada DOM sismesin).
const MAX_HEARTS = 160;
// Tiklama serisi bu kadar ms bos kalirsa sifirlanir.
const STREAK_RESET_MS = 4000;

type Heart = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  sway: number;
  rot: number;
  size: number;
  color: string;
  dur: number;
  delay: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function FlyingHeart({ heart, onDone }: { heart: Heart; onDone: (id: number) => void }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const at = (k: number, extraX: number, scale: number, rot: number) =>
      `translate(-50%, -50%) translate(${heart.dx * k + extraX}px, ${heart.dy * k}px) scale(${scale}) rotate(${rot}deg)`;

    const anim = el.animate(
      [
        { transform: at(0, 0, 0.2, 0), opacity: 0 },
        { transform: at(0.2, heart.sway * 0.5, 1.1, heart.rot * 0.3), opacity: 1, offset: 0.18 },
        { transform: at(0.6, -heart.sway, 1, heart.rot * 0.7), opacity: 0.9, offset: 0.6 },
        { transform: at(1, heart.sway * 0.6, 0.7, heart.rot), opacity: 0 },
      ],
      {
        duration: heart.dur,
        delay: heart.delay,
        easing: "cubic-bezier(0.22, 0.7, 0.3, 1)",
        fill: "both",
      }
    );
    // Temizlik animasyonun finish olayina DEGIL zamanlayiciya bagli: sekme arka
    // plandayken kare uretilmez, finish gelmez ve kalpler DOM'da birikirdi.
    const timer = window.setTimeout(
      () => onDone(heart.id),
      heart.dur + heart.delay + 50
    );

    return () => {
      window.clearTimeout(timer);
      anim.cancel();
    };
  }, [heart, onDone]);

  return (
    <span
      ref={ref}
      className="absolute block opacity-0"
      style={{ left: heart.x, top: heart.y, width: heart.size, height: heart.size }}
    >
      <svg viewBox="0 0 24 24" className="block h-full w-full" fill={heart.color} aria-hidden="true">
        <path d={HEART_PATH} />
      </svg>
    </span>
  );
}

export default function HeaderEgg() {
  const [hovered, setHovered] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [broken, setBroken] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const faceRef = useRef<HTMLSpanElement | null>(null);
  const idRef = useRef(0);
  const streakRef = useRef(0);
  const streakTimerRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<number | null>(null);

  const removeHeart = useCallback((id: number) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Kalpler agiz hizasindan cikar. Header sayfanin tepesinde oldugu icin yukari
  // yer yok: agirlikli olarak yanlara ve asagi ucusurlar.
  const spawn = useCallback((count: number, mode: "hover" | "burst") => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height * 0.7;
    const colors = mode === "burst" ? RAINBOW_COLORS : HOVER_COLORS;
    // Seri buyudukce patlama da genisler.
    const reach = mode === "burst" ? Math.min(90 + streakRef.current * 14, 260) : 60;

    const fresh: Heart[] = [];
    for (let i = 0; i < count; i++) {
      // 0 = saga, 90 = asagi, 180 = sola; -25..205 hafif yukari payi birakir.
      const angle = (rand(-25, 205) * Math.PI) / 180;
      const dist = mode === "burst" ? rand(reach * 0.35, reach) : rand(28, reach);
      fresh.push({
        id: ++idRef.current,
        x: originX + rand(-6, 6),
        y: originY + rand(-4, 4),
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        sway: rand(-10, 10),
        rot: rand(-40, 40),
        size: mode === "burst" ? rand(10, 22) : rand(7, 12),
        color: pick(colors),
        dur: mode === "burst" ? rand(900, 1700) : rand(1100, 1600),
        delay: mode === "burst" ? rand(0, 160) : 0,
      });
    }

    setHearts((prev) => [...prev, ...fresh].slice(-MAX_HEARTS));
  }, []);

  // Hover surdukce minik kalpler damlar. Hareket azaltma tercihinde otomatik
  // kalp yok (tiklama patlamasi kullanici eylemi oldugu icin kalir).
  useEffect(() => {
    if (!hovered || prefersReducedMotion()) return;

    const timer = window.setInterval(() => spawn(1, "hover"), 300);
    return () => window.clearInterval(timer);
  }, [hovered, spawn]);

  useEffect(() => {
    return () => {
      if (streakTimerRef.current) window.clearTimeout(streakTimerRef.current);
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  function handleClick() {
    streakRef.current += 1;
    if (streakTimerRef.current) window.clearTimeout(streakTimerRef.current);
    streakTimerRef.current = window.setTimeout(() => {
      streakRef.current = 0;
    }, STREAK_RESET_MS);

    // Tikladikca daha cok: 8, 12, 16, ... (tavan 60).
    spawn(Math.min(4 + streakRef.current * 4, 60), "burst");

    // Dokunmatikte hover yok: tiklama opucuk pozunu kisa sure gosterir.
    setPulse(true);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setPulse(false), 700);

    faceRef.current?.animate(
      [{ scale: "1" }, { scale: "1.22" }, { scale: "0.96" }, { scale: "1" }],
      { duration: 320, easing: "ease-out" }
    );
  }

  // Gorsel gelmezse (izin kalkmis, oturum dusmus) bos buton birakma.
  if (broken) return null;

  const kissing = hovered || pulse;
  const poseClass = "col-start-1 row-start-1 h-9 w-auto select-none transition-opacity duration-200";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Muah"
        onClick={handleClick}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          setHovered(true);
          if (!prefersReducedMotion()) spawn(2, "hover");
        }}
        onPointerLeave={() => setHovered(false)}
        className="flex shrink-0 cursor-pointer items-center rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          className={`block transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
            kissing ? "-rotate-6 scale-[1.2]" : ""
          }`}
        >
          <span ref={faceRef} className="grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SMILE_SRC}
              alt=""
              width={125}
              height={176}
              draggable={false}
              onError={() => setBroken(true)}
              className={`${poseClass} ${kissing ? "opacity-0" : "opacity-100"}`}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={KISS_SRC}
              alt=""
              width={125}
              height={176}
              draggable={false}
              onError={() => setBroken(true)}
              className={`${poseClass} ${kissing ? "opacity-100" : "opacity-0"}`}
            />
          </span>
        </span>
      </button>

      {hearts.length > 0
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
              {hearts.map((heart) => (
                <FlyingHeart key={heart.id} heart={heart} onDone={removeHeart} />
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
