import { Fragment } from "react";

// Bets10 marka adi sitede YAZI olarak gosterilmez; her yerde Upcoming
// Events'teki yesil "10" rozeti kullanilir (kullanici tercihi). Tooltip gibi
// salt-metin yerlerde ceviri metni markasiz/"10" olarak yazilir.

export function TenBadge() {
  return (
    <span className="mx-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-[3px] bg-[#0aa84f] px-1 align-[-2px] text-[10px] font-bold leading-none text-white">
      10
    </span>
  );
}

// Metindeki her "Bets10" gecisini rozete cevirir; ceviri stringleri "Bets10"
// token'ini tasimaya devam eder, ekranda yalniz rozet gorunur.
export function TenText({ text }: { text: string }) {
  const parts = text.split("Bets10");
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <TenBadge />}
          {p}
        </Fragment>
      ))}
    </>
  );
}
