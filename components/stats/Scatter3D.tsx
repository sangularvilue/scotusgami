"use client";

import { useRef, useState } from "react";
import { PARTY_COLOR } from "./colors";

export interface Pt3D {
  label: string;
  x: number;
  y: number;
  z: number;
  party: "R" | "D";
}

interface V3 {
  x: number;
  y: number;
  z: number;
}

function rotate(p: V3, yaw: number, pitch: number): V3 {
  const x1 = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
  const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  const y2 = p.y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = p.y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: x1, y: y2, z: z2 };
}

/**
 * Drag-to-rotate 3-D scatter of justice loadings on PC1/PC2/PC3. Orthographic
 * projection with a depth cue (nearer points larger/brighter). No dependency —
 * hand-rolled rotation so it stays self-contained.
 */
export default function Scatter3D({
  points,
  labels = ["PC1", "PC2", "PC3"],
  size = 380,
}: {
  points: Pt3D[];
  labels?: [string, string, string] | string[];
  size?: number;
}) {
  const [yaw, setYaw] = useState(-0.7);
  const [pitch, setPitch] = useState(0.35);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const max =
    Math.max(0.05, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)])) *
    1.2;
  const scale = (size / 2 - 30) / max;
  const proj = (p: V3) => {
    const r = rotate(p, yaw, pitch);
    return { X: cx + r.x * scale, Y: cy - r.y * scale, depth: r.z };
  };

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setYaw((v) => v + dx * 0.01);
    setPitch((v) => Math.max(-1.4, Math.min(1.4, v + dy * 0.01)));
  };
  const onUp = () => (drag.current = null);

  // axes: from origin to +extent on each PC
  const axisEnds: { v: V3; label: string }[] = [
    { v: { x: max, y: 0, z: 0 }, label: labels[0] },
    { v: { x: 0, y: max, z: 0 }, label: labels[1] },
    { v: { x: 0, y: 0, z: max }, label: labels[2] },
  ];
  const origin = proj({ x: 0, y: 0, z: 0 });

  // draw far points first
  const ordered = points
    .map((p) => ({ p, pr: proj(p) }))
    .sort((a, b) => a.pr.depth - b.pr.depth);
  const depthNorm = (d: number) => (d / max + 1) / 2; // 0 far … 1 near

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[440px] cursor-grab touch-none active:cursor-grabbing select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      role="img"
      aria-label="3-D PC loadings, drag to rotate"
    >
      <rect x={0} y={0} width={size} height={size} fill="transparent" />
      {/* axes */}
      {axisEnds.map((a) => {
        const e = proj(a.v);
        return (
          <g key={a.label}>
            <line x1={origin.X} y1={origin.Y} x2={e.X} y2={e.Y} stroke="#3a4453" />
            <text x={e.X} y={e.Y} dx={4} dy={3} fontSize={10} fill="#9a958a" className="font-mono">
              {a.label}
            </text>
          </g>
        );
      })}
      {/* points */}
      {ordered.map(({ p, pr }) => {
        const dn = depthNorm(pr.depth);
        return (
          <g key={p.label} opacity={0.45 + 0.55 * dn}>
            <circle cx={pr.X} cy={pr.Y} r={3 + 3 * dn} fill={PARTY_COLOR[p.party]} />
            <text x={pr.X + 6} y={pr.Y - 4} fontSize={9.5} fill="#c9c3b4" className="font-mono">
              {p.label}
            </text>
          </g>
        );
      })}
      <text x={8} y={size - 8} fontSize={9} fill="#5d5f60" className="font-mono">
        drag to rotate
      </text>
    </svg>
  );
}
