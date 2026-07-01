"use client";

import { useRef, useState } from "react";
import { PARTY_COLOR } from "./colors";
import { spreadY } from "./layout";

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
 * Drag-to-rotate 3-D scatter of justice loadings on PC1/PC2/PC3. Orthographic,
 * with a depth cue (nearer points larger/brighter). The view auto-fits the
 * rotated cloud (points + axes) into the frame each render, so the origin moves
 * around as you rotate and nothing clips. No dependency — hand-rolled.
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

  const max =
    Math.max(0.05, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)])) *
    1.05;

  const axisEnds: { v: V3; label: string }[] = [
    { v: { x: max, y: 0, z: 0 }, label: labels[0] },
    { v: { x: 0, y: max, z: 0 }, label: labels[1] },
    { v: { x: 0, y: 0, z: max }, label: labels[2] },
  ];

  // rotate everything, then fit the rotated (x,y) bounding box to the frame so
  // the cloud always fills it and the origin is free to move.
  const rPts = points.map((p) => rotate(p, yaw, pitch));
  const rAxes = axisEnds.map((a) => rotate(a.v, yaw, pitch));
  const rOrigin = rotate({ x: 0, y: 0, z: 0 }, yaw, pitch);
  const all = [...rPts, ...rAxes, rOrigin];
  const xs = all.map((r) => r.x);
  const ys = all.map((r) => r.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 42;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
  const offX = pad + ((size - 2 * pad) - w * scale) / 2;
  const offY = pad + ((size - 2 * pad) - h * scale) / 2;
  const toX = (r: V3) => offX + (r.x - minX) * scale;
  const toY = (r: V3) => offY + (maxY - r.y) * scale; // flip y

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

  const origin = { X: toX(rOrigin), Y: toY(rOrigin) };

  // draw far points first; de-collide labels vertically
  const ordered = points
    .map((p, i) => ({ p, r: rPts[i], X: toX(rPts[i]), Y: toY(rPts[i]) }))
    .sort((a, b) => a.r.z - b.r.z);
  const labelY = spreadY(ordered.map((o) => o.Y), 12, 12, size - 12);
  const depthNorm = (d: number) => (d / max + 1) / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[440px] cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      role="img"
      aria-label="3-D PC loadings, drag to rotate"
    >
      <rect x={0} y={0} width={size} height={size} fill="transparent" />
      {axisEnds.map((a, i) => {
        const e = { X: toX(rAxes[i]), Y: toY(rAxes[i]) };
        return (
          <g key={a.label}>
            <line x1={origin.X} y1={origin.Y} x2={e.X} y2={e.Y} stroke="#3a4453" />
            <text x={e.X} y={e.Y} dx={4} dy={3} fontSize={10} fill="#9a958a" className="font-mono">
              {a.label}
            </text>
          </g>
        );
      })}
      {ordered.map((o, i) => {
        const dn = depthNorm(o.r.z);
        const ly = labelY[i];
        const lx = o.X + 7;
        const leader = Math.abs(ly - o.Y) > 5;
        return (
          <g key={o.p.label} opacity={0.5 + 0.5 * dn}>
            {leader && <line x1={o.X} y1={o.Y} x2={lx - 1} y2={ly - 3} stroke="#3a4453" strokeWidth={0.75} />}
            <circle cx={o.X} cy={o.Y} r={3 + 3 * dn} fill={PARTY_COLOR[o.p.party]} />
            <text x={lx} y={ly} fontSize={9.5} fill="#c9c3b4" className="font-mono">
              {o.p.label}
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
