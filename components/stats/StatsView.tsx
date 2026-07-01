"use client";

import { useState } from "react";
import { JUSTICE_BY_ID, SENIORITY_IDS } from "@/lib/justices";
import type { AllStats, StatsResult } from "@/lib/scotus-stats";
import { PARTY_COLOR } from "./colors";
import Scatter2D from "./Scatter2D";
import Scatter3D from "./Scatter3D";

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const pct1 = (x: number) => `${(100 * x).toFixed(1)}%`;

/** Justices in ideological order for a dataset; filled chips by side. */
function LineupStrip({ scores, order }: { scores: number[]; order: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {order.map((id) => {
        const s = scores[SENIORITY_IDS.indexOf(id)];
        const j = JUSTICE_BY_ID[id];
        const style =
          s > 0
            ? { background: "rgba(201,165,88,0.22)", borderColor: "#c9a558", color: "#ecd193" }
            : s < 0
            ? { background: "rgba(111,143,191,0.24)", borderColor: "#6f8fbf", color: "#cdd9ea" }
            : { borderColor: "#242c38", color: "#7d7a70" };
        return (
          <span
            key={id}
            title={`${j.fullName}: ${s > 0 ? "majority/concurrence" : s < 0 ? "dissent" : "no part / mixed"}`}
            style={style}
            className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
          >
            {j.lastName} {s > 0 ? "+" : s < 0 ? "−" : "0"}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal PC1 / PC1+2 variance bars across datasets. */
function VarianceBars({ rows }: { rows: { label: string; pc1: number; pc12: number }[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] text-cream-dim">{r.label}</span>
          <div className="relative h-4 flex-1 rounded-sm bg-ink-line/40">
            <div className="absolute inset-y-0 left-0 rounded-sm bg-gold/25" style={{ width: pct(r.pc12) }} />
            <div className="absolute inset-y-0 left-0 rounded-sm bg-gold/70" style={{ width: pct(r.pc1) }} />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-[10px] text-cream-faint">
            {pct(r.pc1)} · {pct(r.pc12)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Condition number over time (terms on x, log scale on y). */
function LineChart({
  points,
  baseline: refLine,
}: {
  points: { label: string; value: number }[];
  baseline?: { value: number; label: string };
}) {
  const W = 440, H = 150, padL = 34, padB = 22, padT = 14, padR = 12;
  const vals = points.map((p) => (isFinite(p.value) ? p.value : 1));
  const logs = [...vals, refLine?.value ?? 1].filter((v) => v > 0).map(Math.log10);
  const lo = Math.min(...logs, 0);
  const hi = Math.max(...logs, 1) * 1.05;
  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (Math.log10(Math.max(1, v)) - lo) / (hi - lo || 1)) * (H - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="condition number over time">
      {refLine && (
        <g>
          <line x1={padL} y1={y(refLine.value)} x2={W - padR} y2={y(refLine.value)} stroke="#5d5f60" strokeDasharray="4 3" />
          <text x={W - padR} y={y(refLine.value) - 3} fontSize={8} textAnchor="end" fill="#5d5f60" className="font-mono">
            {refLine.label} {refLine.value.toFixed(0)}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="#6f8fbf" strokeWidth={1.5} />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={3} fill="#6f8fbf" />
          <text x={x(i)} y={y(p.value) - 7} fontSize={9} textAnchor="middle" fill="#c9c3b4" className="font-mono">
            {isFinite(p.value) ? p.value.toFixed(0) : "∞"}
          </text>
          <text x={x(i)} y={H - 7} fontSize={9} textAnchor="middle" fill="#9a958a" className="font-mono">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Scree: variance on each PC for the selected dataset. */
function Scree({ ve }: { ve: number[] }) {
  const H = 96;
  return (
    <div className="flex items-end gap-1.5">
      {ve.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="font-mono text-[8px] text-cream-faint">{(v * 100).toFixed(0)}%</span>
          <div
            className="w-full rounded-t-sm bg-gold/50"
            style={{ height: Math.max(1, (v / ve[0]) * H) }}
          />
          <span className="font-mono text-[9px] text-cream-faint">PC{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink-line bg-ink-raised/40 p-3">
      <div className="smallcaps mb-1 text-[10px] text-gold/80">{label}</div>
      <div className="text-[13px] leading-snug text-cream">{children}</div>
    </div>
  );
}

export default function StatsView({ stats }: { stats: AllStats }) {
  const datasets: StatsResult[] = [
    ...(stats.overall ? [stats.overall] : []),
    ...stats.terms,
  ];
  const [sel, setSel] = useState(0);
  const d = datasets[sel];
  if (!d) return null;

  const pts2 = d.loadings.map((l) => ({ label: l.lastName, x: l.pc[0], y: l.pc[1], party: l.party }));
  const pts3 = d.loadings.map((l) => ({ label: l.lastName, x: l.pc[0], y: l.pc[1], z: l.pc[2], party: l.party }));

  const varRows = datasets.map((s) => ({ label: s.term ? `OT${s.term}` : "All", pc1: s.pc1, pc12: s.pc12 }));

  return (
    <div className="mx-auto w-full max-w-5xl px-5">
      {/* dataset selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {datasets.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setSel(i)}
            className={`rounded border px-3 py-1 font-mono text-[12px] transition-colors ${
              i === sel
                ? "border-gold bg-gold/15 text-gold-bright"
                : "border-gold/40 text-gold hover:bg-gold/10"
            }`}
          >
            {s.term ? `OT${s.term}` : "All time"}
          </button>
        ))}
      </div>

      <p className="mb-4 font-mono text-[11px] text-cream-faint">
        {d.label} · {d.nCases} cases · {d.nDivided} divided
        {d.provisional && (
          <span className="ml-2 rounded-sm border border-slate-dissent/50 px-1.5 py-0.5 text-slate-dissent">
            provisional — includes Oyez data for the in-progress term (incomplete
            until the Supreme Court Database releases); numbers will shift
          </span>
        )}
      </p>

      {/* loadings plots */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="smallcaps mb-2 text-[10px] text-gold">
            loadings — PC1 ({pct(d.pc1)}) × PC2 ({pct(d.varianceExplained[1])})
          </h3>
          <Scatter2D points={pts2} xLabel="PC1 (ideology)" yLabel="PC2" />
        </div>
        <div>
          <h3 className="smallcaps mb-2 text-[10px] text-gold">loadings — PC1 · PC2 · PC3 (3-D)</h3>
          <Scatter3D
            points={pts3}
            labels={[`PC1 ${pct(d.pc1)}`, `PC2 ${pct(d.varianceExplained[1])}`, `PC3 ${pct(d.varianceExplained[2])}`]}
          />
        </div>
      </div>

      {/* PC1 ideological ranking */}
      <div className="mt-6">
        <h3 className="smallcaps mb-2 text-[10px] text-gold">ideological ranking (PC1 loading, liberal → conservative)</h3>
        <div className="flex flex-wrap gap-1">
          {d.pc1Order.map((id) => {
            const l = d.loadings.find((x) => x.id === id)!;
            return (
              <span
                key={id}
                className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                style={{ borderColor: PARTY_COLOR[l.party], color: l.party === "R" ? "#d98c83" : "#a9bdd8" }}
              >
                {l.lastName} {l.pc[0].toFixed(2)}
              </span>
            );
          })}
        </div>
      </div>

      {/* callouts */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Callout label="most maverick (farthest from center, PC1 removed)">
          <span className="text-gold-bright">{d.maverick.lastName}</span> — stands apart from the pack on the
          secondary axes (PC-importance-weighted distance {d.maverick.score.toFixed(3)}, ignoring left/right)
        </Callout>
        <Callout label="variance explained">
          PC1 <span className="text-gold-bright">{pct1(d.pc1)}</span> · PC1+PC2{" "}
          <span className="text-gold-bright">{pct1(d.pc12)}</span>
        </Callout>
        <Callout label="condition number (λmax/λmin)">
          <span className="text-gold-bright">{isFinite(d.conditionNumber) ? d.conditionNumber.toFixed(1) : "∞"}</span>
        </Callout>
        <Callout label="splits on party lines">
          <span className="text-gold-bright">{pct(d.partyLinePct)}</span> of divided cases
        </Callout>
        <Callout label="splits on any ideological line">
          <span className="text-gold-bright">{pct(d.anyLinePct)}</span> of divided cases
        </Callout>
        <Callout label="unanimous (no dissent)">
          <span className="text-gold-bright">{pct(d.unanimityRate)}</span> of decisions
        </Callout>
        <Callout label="most redundant (vote-flip changes fewest)">
          <span className="text-gold-bright">{d.mostRedundant.lastNames.join(", ")}</span> — flipping their vote
          changes {d.mostRedundant.changes} outcome{d.mostRedundant.changes === 1 ? "" : "s"}
        </Callout>
        <Callout label="least redundant (most decisive)">
          <span className="text-gold-bright">{d.leastRedundant.lastNames.join(", ")}</span> — flipping their vote
          changes {d.leastRedundant.changes} outcome{d.leastRedundant.changes === 1 ? "" : "s"}
        </Callout>
        {d.twins && (
          <Callout label="twins (closest by maverick distance)">
            <span className="text-gold-bright">{d.twins.aName}</span> &{" "}
            <span className="text-gold-bright">{d.twins.bName}</span>{" "}
            <span className="text-cream-faint">(d {d.twins.dist.toFixed(3)})</span>
          </Callout>
        )}
      </div>

      {/* most unexpected lineup */}
      {d.mostUnexpected && (
        <div className="mt-3 rounded border border-ink-line bg-ink-raised/40 p-3">
          <div className="smallcaps mb-1 text-[10px] text-gold/80">
            most unexpected lineup (largest Mahalanobis distance in PC space)
          </div>
          <div className="mb-2 text-[13px] text-cream">
            <span className="text-gold-bright">{d.mostUnexpected.name}</span>{" "}
            <span className="text-cream-faint">
              · {d.mostUnexpected.split} · decided {d.mostUnexpected.decided}
            </span>
          </div>
          <LineupStrip scores={d.mostUnexpected.scores} order={d.pc1Order} />
        </div>
      )}

      {/* scree for selected dataset */}
      <div className="mt-6">
        <h3 className="smallcaps mb-2 text-[10px] text-gold">scree — variance per PC ({d.term ? `OT${d.term}` : "all time"})</h3>
        <Scree ve={d.varianceExplained} />
      </div>

      {/* cross-term summaries */}
      <div className="mt-10 grid gap-8 border-t border-ink-line pt-8 sm:grid-cols-2">
        <div>
          <h3 className="smallcaps mb-3 text-[10px] text-gold">variance explained — PC1 (solid) · PC1+PC2 (light)</h3>
          <VarianceBars rows={varRows} />
        </div>
        <div>
          <h3 className="smallcaps mb-3 text-[10px] text-gold">condition number over time (log scale)</h3>
          <LineChart
            points={stats.terms.map((s) => ({ label: `OT${s.term}`, value: s.conditionNumber }))}
            baseline={stats.overall ? { value: stats.overall.conditionNumber, label: "all-time" } : undefined}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-cream-dim">
            The condition number is λ<sub>max</sub> ÷ λ<sub>min</sub>, but its swings come from the{" "}
            <span className="text-cream">denominator</span> — the smallest eigenvalue (PC9), not PC1. Across these terms
            PC1&apos;s variance barely shifts while the smallest one moves much more, and the condition number tracks it
            almost inversely. So it&apos;s really a gauge of the <span className="text-cream">most collinear direction</span>:
            a combination of justices whose votes are nearly redundant.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-cream-dim">
            <span className="text-gold">Rising</span> → that least-independent direction is collapsing toward zero — some
            justices voting almost interchangeably (very tight bloc behavior) — and/or too few cases to fill out all nine
            dimensions. <span className="text-gold">Falling</span> → even the most redundant direction carries real
            variance, so the nine are voting more independently.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
            Because it hinges on that tiny, noisy smallest eigenvalue, read it as a rough collinearity gauge, not a
            precise trend — and discount early or provisional terms, where thin data drives λ<sub>min</sub> toward zero
            on its own.
          </p>
        </div>
      </div>
    </div>
  );
}
