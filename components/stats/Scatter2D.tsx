import { PARTY_COLOR } from "./colors";

export interface Pt2D {
  label: string;
  x: number;
  y: number;
  party: "R" | "D";
}

/** A labeled 2-D scatter of justice PC loadings, with axes through the origin. */
export default function Scatter2D({
  points,
  xLabel,
  yLabel,
  size = 360,
}: {
  points: Pt2D[];
  xLabel: string;
  yLabel: string;
  size?: number;
}) {
  const pad = 34;
  const inner = size - 2 * pad;
  // symmetric domain around 0 so the origin sits at center
  const max =
    Math.max(0.05, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])) *
    1.15;
  const sx = (x: number) => pad + ((x + max) / (2 * max)) * inner;
  const sy = (y: number) => pad + ((max - y) / (2 * max)) * inner; // flip y

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[420px]"
      role="img"
      aria-label={`${xLabel} vs ${yLabel} scatter`}
    >
      {/* frame */}
      <rect
        x={pad}
        y={pad}
        width={inner}
        height={inner}
        fill="none"
        stroke="#242c38"
      />
      {/* origin axes */}
      <line x1={sx(0)} y1={pad} x2={sx(0)} y2={pad + inner} stroke="#242c38" strokeDasharray="3 3" />
      <line x1={pad} y1={sy(0)} x2={pad + inner} y2={sy(0)} stroke="#242c38" strokeDasharray="3 3" />
      {/* points */}
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={PARTY_COLOR[p.party]} />
          <text
            x={sx(p.x) + 6}
            y={sy(p.y) - 5}
            fontSize={10}
            fill="#9a958a"
            className="font-mono"
          >
            {p.label}
          </text>
        </g>
      ))}
      {/* axis labels */}
      <text x={pad + inner} y={sy(0) - 6} fontSize={9} textAnchor="end" fill="#5d5f60" className="font-mono">
        {xLabel} →
      </text>
      <text x={sx(0) + 6} y={pad + 10} fontSize={9} fill="#5d5f60" className="font-mono">
        ↑ {yLabel}
      </text>
    </svg>
  );
}
