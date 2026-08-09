// Vitrin (showcase) sayfalarinin ortak SVG grafikleri: radar + trend.
// Server component'lerde kullanilir; renkler tema token'larindan (CSS var).

export type ShowcaseRadarAxis = { key: string; label: string; value: number };

function radarPoint(index: number, count: number, frac: number, radius: number) {
  const angle = ((-90 + index * (360 / count)) * Math.PI) / 180;
  return {
    x: 110 + radius * frac * Math.cos(angle),
    y: 110 + radius * frac * Math.sin(angle),
  };
}

export function ShowcaseRadar({ axes }: { axes: ShowcaseRadarAxis[] }) {
  const count = axes.length;
  const radius = 76;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[260px]">
      {rings.map((frac, i) => (
        <polygon
          key={i}
          points={axes
            .map((_, j) => {
              const p = radarPoint(j, count, frac, radius);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}

      {axes.map((_, i) => {
        const p = radarPoint(i, count, 1, radius);
        return (
          <line
            key={i}
            x1={110}
            y1={110}
            x2={p.x}
            y2={p.y}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={axes
          .map((axis, i) => {
            const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(" ")}
        fill="var(--accent)"
        fillOpacity={0.16}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {axes.map((axis, i) => {
        const p = radarPoint(i, count, Math.max(axis.value, 4) / 100, radius);
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />;
      })}

      {axes.map((axis, i) => {
        const p = radarPoint(i, count, 1, radius + 22);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y - 3}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--ink-2)"
          >
            {axis.label}
            <tspan
              x={p.x}
              dy={11}
              fontSize={10}
              fontWeight={700}
              fill="var(--accent-ink)"
            >
              {Math.round(axis.value)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

// Radar yaninda etiket + deger + ince bar listesi.
export function ShowcaseRadarBars({ axes }: { axes: ShowcaseRadarAxis[] }) {
  return (
    <div className="min-w-0 flex-1 space-y-3">
      {axes.map((axis) => (
        <div key={axis.key}>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-ink-2">{axis.label}</span>
            <span className="shrink-0 font-semibold text-ink">
              {Math.round(axis.value)}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-veil">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(axis.value)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export type ShowcaseTrendPoint = {
  key: string;
  label: string;
  value: number;
  tone?: "accent" | "pos" | "neg" | "hollow";
};

const TONE_FILL: Record<NonNullable<ShowcaseTrendPoint["tone"]>, string> = {
  accent: "var(--accent)",
  pos: "var(--pos)",
  neg: "var(--neg)",
  hollow: "var(--card)",
};

export function ShowcaseTrend({
  points,
  yMax,
  yTicks,
}: {
  points: ShowcaseTrendPoint[];
  yMax: number;
  yTicks: number[];
}) {
  const width = 560;
  const height = 190;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const x = (i: number) =>
    points.length <= 1
      ? padL + plotW / 2
      : padL + (i / (points.length - 1)) * plotW;
  const y = (v: number) =>
    padT + plotH - (Math.min(v, yMax) / Math.max(yMax, 1)) * plotH;

  const linePath = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
    )
    .join(" ");

  const areaPath =
    points.length > 1
      ? `${linePath} L${x(points.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padL}
            y1={y(tick)}
            x2={width - padR}
            y2={y(tick)}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray={tick === 0 ? undefined : "3 4"}
          />
          <text
            x={padL - 6}
            y={y(tick) + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--ink-3)"
          >
            {tick}
          </text>
        </g>
      ))}

      {areaPath ? (
        <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} />
      ) : null}

      <path
        d={linePath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => {
        const tone = p.tone ?? "hollow";
        return (
          <circle
            key={p.key}
            cx={x(i)}
            cy={y(p.value)}
            r={tone === "hollow" ? 3 : 4}
            fill={TONE_FILL[tone]}
            stroke={
              tone === "pos"
                ? "var(--pos)"
                : tone === "neg"
                ? "var(--neg)"
                : "var(--accent)"
            }
            strokeWidth={1.5}
          />
        );
      })}

      {points.map((p, i) =>
        points.length <= 8 || i % 3 === 0 || i === points.length - 1 ? (
          <text
            key={`label-${p.key}`}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize={9}
            fill="var(--ink-3)"
          >
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  );
}
