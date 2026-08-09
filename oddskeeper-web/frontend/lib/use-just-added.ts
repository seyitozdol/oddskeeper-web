"use client";

import { useRef, useState } from "react";

// Input'a gonderen butonlar icin ortak geri bildirim: basarili add'de buton kisa
// sure "Added N!" gosterip eski haline doner. flash(n) cagirilinca justAdded=n
// olur, duration sonra null'a doner (art arda cagrilarda onceki zamanlayici
// iptal edilir). MSM/PSM/basketbol/voleybol paylasir.
export function useJustAdded(duration = 2500) {
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(n: number) {
    if (timer.current) clearTimeout(timer.current);
    setJustAdded(n);
    timer.current = setTimeout(() => setJustAdded(null), duration);
  }
  return [justAdded, flash] as const;
}
