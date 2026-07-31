type Pt = { id: string; name: string; team: string; goals: number; xg: number };

// xG (x ekseni) vs Gol (y ekseni) sacilim grafigi. Cizginin ustu = xG'den fazla gol.
export default function XgScatter({
  points,
  labels,
}: {
  points: Pt[];
  labels: { x: string; y: string };
}) {
  const W = 680;
  const H = 380;
  const pad = { l: 40, r: 20, t: 20, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  if (!points.length) {
    return <p className="py-8 text-center text-[13px] text-ink-3">—</p>;
  }

  const maxDom = Math.ceil(Math.max(...points.map((p) => Math.max(p.goals, p.xg)), 5) / 5) * 5;
  const sx = (v: number) => pad.l + (v / maxDom) * innerW;
  const sy = (v: number) => pad.t + innerH - (v / maxDom) * innerH;

  const ticks = Array.from({ length: maxDom / 5 + 1 }, (_, i) => i * 5);
  // etiketlenecekler: en cok gollu 6
  const labeled = new Set(
    [...points].sort((a, b) => b.goals - a.goals).slice(0, 6).map((p) => p.id)
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img">
        {/* izgara */}
        {ticks.map((tk) => (
          <g key={`g${tk}`}>
            <line x1={sx(tk)} y1={pad.t} x2={sx(tk)} y2={pad.t + innerH} stroke="var(--line)" strokeWidth="1" />
            <line x1={pad.l} y1={sy(tk)} x2={pad.l + innerW} y2={sy(tk)} stroke="var(--line)" strokeWidth="1" />
            <text x={sx(tk)} y={H - 12} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{tk}</text>
            <text x={pad.l - 8} y={sy(tk) + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)">{tk}</text>
          </g>
        ))}

        {/* y = x referans */}
        <line
          x1={sx(0)} y1={sy(0)} x2={sx(maxDom)} y2={sy(maxDom)}
          stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"
        />

        {/* noktalar */}
        {points.map((p) => {
          const over = p.goals - p.xg;
          const color = over >= 0.5 ? "var(--pos)" : over <= -0.5 ? "var(--neg)" : "var(--accent)";
          return (
            <g key={p.id}>
              <circle cx={sx(p.xg)} cy={sy(p.goals)} r="4.5" fill={color} fillOpacity="0.85" />
              {labeled.has(p.id) ? (
                <text
                  x={sx(p.xg) + 7}
                  y={sy(p.goals) + 3}
                  fontSize="10"
                  fill="var(--ink)"
                  fontWeight="600"
                >
                  {p.name}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* eksen basliklari */}
        <text x={pad.l + innerW / 2} y={H - 0} textAnchor="middle" fontSize="11" fill="var(--ink-2)">{labels.x}</text>
        <text x={12} y={pad.t + innerH / 2} textAnchor="middle" fontSize="11" fill="var(--ink-2)" transform={`rotate(-90 12 ${pad.t + innerH / 2})`}>{labels.y}</text>
      </svg>
    </div>
  );
}
