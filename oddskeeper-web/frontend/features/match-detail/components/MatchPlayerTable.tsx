import Link from "next/link";

// Mac detayindaki oyuncu performans tablosu (TSL + 1.Lig ortak). Kompakt: dusuk
// font/padding + kisa kolon basliklari sayesinde masaustunde yan-yana iki tablo
// yatay kaydirma cubugu olmadan sigar (overflow-x-auto yalniz dar ekranda devreye
// girer). Iki lig de ayni bilesenle render edilir -> gorsel birebir ayni.

export type MatchPlayerRow = {
  playerId: string;
  playerName: string;
  playerHref: string | null;
  positionCode: string | null;
  lineupStatus: string | null; // "starter" | "substitute" | diger
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  totalPasses: number | null;
  keyPasses: number | null;
  tackles: number | null;
  fouls: number | null;
  saves: number | null;
};

function fmt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
}

export default function MatchPlayerTable({
  rows,
  tr,
}: {
  rows: MatchPlayerRow[];
  tr: boolean;
}) {
  const H = tr
    ? { pl: "Oyuncu", pos: "POZ", min: "DK", rat: "PUAN", g: "G", a: "A", sh: "ŞUT", sot: "İS", pas: "PAS", kp: "KP", tk: "MÜ", fl: "FA", sv: "KUR" }
    : { pl: "Player", pos: "POS", min: "MIN", rat: "RAT", g: "G", a: "A", sh: "SH", sot: "SOT", pas: "PAS", kp: "KP", tk: "TK", fl: "FL", sv: "SV" };
  const st = tr
    ? { starter: "İLK11", sub: "YD", bench: "—" }
    : { starter: "XI", sub: "SUB", bench: "—" };

  const numTh = (label: string) => (
    <th className="px-1.5 py-1.5 text-right font-medium">{label}</th>
  );
  const numTd = (v: number | null | undefined, digits = 0) => (
    <td className="px-1.5 py-1 text-right tabular-nums">{fmt(v, digits)}</td>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-[0.08em] text-ink-3">
            <th className="px-2 py-1.5 font-medium">{H.pl}</th>
            <th className="px-1.5 py-1.5 font-medium">{H.pos}</th>
            {numTh(H.min)}
            {numTh(H.rat)}
            {numTh(H.g)}
            {numTh(H.a)}
            {numTh(H.sh)}
            {numTh(H.sot)}
            {numTh(H.pas)}
            {numTh(H.kp)}
            {numTh(H.tk)}
            {numTh(H.fl)}
            {numTh(H.sv)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const played = (p.minutes ?? 0) > 0;
            const tag =
              p.lineupStatus === "starter" ? st.starter : played ? st.sub : st.bench;
            const isGk = (p.positionCode ?? "").toUpperCase() === "G";
            return (
              <tr
                key={p.playerId}
                className={`border-t border-line ${played ? "text-ink" : "text-ink-3"}`}
              >
                <td className="whitespace-nowrap px-2 py-1 font-medium">
                  <span className="inline-flex items-baseline gap-1">
                    {p.playerHref ? (
                      <Link
                        href={p.playerHref}
                        className="transition hover:text-accent-ink hover:underline"
                      >
                        {p.playerName}
                      </Link>
                    ) : (
                      <span>{p.playerName}</span>
                    )}
                    <span className="text-[8px] uppercase tracking-wide text-ink-3">{tag}</span>
                  </span>
                </td>
                <td className="px-1.5 py-1 text-ink-2">{p.positionCode ?? "—"}</td>
                {numTd(p.minutes)}
                {numTd(played && p.rating !== null ? p.rating : null, 2)}
                {numTd(p.goals)}
                {numTd(p.assists)}
                {numTd(p.shots)}
                {numTd(p.shotsOnTarget)}
                {numTd(p.totalPasses)}
                {numTd(p.keyPasses)}
                {numTd(p.tackles)}
                {numTd(p.fouls)}
                {numTd(isGk ? p.saves : null)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
