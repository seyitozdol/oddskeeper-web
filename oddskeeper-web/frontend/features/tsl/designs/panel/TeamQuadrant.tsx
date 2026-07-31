import { initials } from "@/features/tsl/lib";

type QTeam = { id: string; name: string; logo: string | null; gf: number; ga: number };

// Hucum (x = attigi gol) vs Savunma (y = yedigi gol, ters -> yukari = az yiyen).
export default function TeamQuadrant({
  teams,
  labels,
}: {
  teams: QTeam[];
  labels: { x: string; y: string };
}) {
  const W = 680;
  const H = 420;
  const pad = { l: 42, r: 20, t: 16, b: 32 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  if (!teams.length) return null;

  const gfs = teams.map((t) => t.gf);
  const gas = teams.map((t) => t.ga);
  const minGf = Math.min(...gfs) - 3;
  const maxGf = Math.max(...gfs) + 3;
  const minGa = Math.min(...gas) - 3;
  const maxGa = Math.max(...gas) + 3;
  const avgGf = gfs.reduce((a, b) => a + b, 0) / teams.length;
  const avgGa = gas.reduce((a, b) => a + b, 0) / teams.length;

  const sx = (v: number) => pad.l + ((v - minGf) / (maxGf - minGf)) * innerW;
  // y ters: az gol yeyen yukarida
  const sy = (v: number) => pad.t + ((v - minGa) / (maxGa - minGa)) * innerH;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img">
        {/* ortalama cizgileri (ceyrekler) */}
        <line x1={sx(avgGf)} y1={pad.t} x2={sx(avgGf)} y2={pad.t + innerH} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={pad.l} y1={sy(avgGa)} x2={pad.l + innerW} y2={sy(avgGa)} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="3 3" />

        {/* ceyrek etiketi: sag-ust = iyi hucum + iyi savunma */}
        <text x={pad.l + innerW - 6} y={pad.t + 14} textAnchor="end" fontSize="10" fill="var(--pos)" opacity="0.8">
          ★
        </text>

        {teams.map((tm) => {
          const x = sx(tm.gf);
          const y = sy(tm.ga);
          return (
            <g key={tm.id}>
              {tm.logo ? (
                <image href={tm.logo} x={x - 11} y={y - 11} width="22" height="22" preserveAspectRatio="xMidYMid meet" />
              ) : (
                <>
                  <circle cx={x} cy={y} r="11" fill="var(--veil)" />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="var(--ink-2)" fontWeight="700">
                    {initials(tm.name)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <text x={pad.l + innerW / 2} y={H - 2} textAnchor="middle" fontSize="11" fill="var(--ink-2)">
          → {labels.x}
        </text>
        <text x={12} y={pad.t + innerH / 2} textAnchor="middle" fontSize="11" fill="var(--ink-2)" transform={`rotate(-90 12 ${pad.t + innerH / 2})`}>
          ← {labels.y}
        </text>
      </svg>
    </div>
  );
}
