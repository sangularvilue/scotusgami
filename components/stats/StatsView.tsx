"use client";

import { useState } from "react";
import { JUSTICE_BY_ID, SENIORITY_IDS } from "@/lib/justices";
import type { AllStats, StatsResult } from "@/lib/scotus-stats";
import { PARTY_COLOR } from "./colors";
import Scatter2D from "./Scatter2D";
import Scatter3D from "./Scatter3D";

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const pct1 = (x: number) => `${(100 * x).toFixed(1)}%`;

/** Justices in ideological order for a dataset, colored by party. */
function LineupStrip({ scores, order }: { scores: number[]; order: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {order.map((id) => {
        const s = scores[SENIORITY_IDS.indexOf(id)];
        const j = JUSTICE_BY_ID[id];
        const bg =
          s > 0 ? "bg-gold/20 border-gold/50 text-gold-bright"
          : s < 0 ? "border-dashed text-cream-dim"
          : "border-ink-line text-cream-faint";
        const style = s < 0 ? { borderColor: PARTY_COLOR.D, color: "#a9bdd8" } : undefined;
        return (
          <span
            key={id}
            title={`${j.fullName}: ${s > 0 ? "majority/concurrence" : s < 0 ? "dissent" : "no part / mixed"}`}
            style={style}
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${bg}`}
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

/** Condition number across datasets (log-scaled bar). */
function CondBars({ rows }: { rows: { label: string; cond: number }[] }) {
  const max = Math.max(...rows.map((r) => (isFinite(r.cond) ? Math.log10(r.cond) : 3)));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const w = isFinite(r.cond) ? (Math.log10(Math.max(1, r.cond)) / max) * 100 : 100;
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-cream-dim">{r.label}</span>
            <div className="relative h-4 flex-1 rounded-sm bg-ink-line/40">
              <div className="absolute inset-y-0 left-0 rounded-sm bg-slate-dissent/50" style={{ width: `${w}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-cream-faint">
              {isFinite(r.cond) ? r.cond.toFixed(1) : "∞"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Scree: variance on each PC for the selected dataset. */
function Scree({ ve }: { ve: number[] }) {
  return (
    <div className="flex items-end gap-1" style={{ height: 90 }}>
      {ve.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-sm bg-gold/50" style={{ height: `${(v / ve[0]) * 100}%` }} />
          </div>
          <span className="font-mono text-[8px] text-cream-faint">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink-line bg-ink-raised/40 p-3">
      <div className="smallcaps mb-1 text-[9px] text-cream-faint">{label}</div>
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
  const condRows = datasets.map((s) => ({ label: s.term ? `OT${s.term}` : "All", cond: s.conditionNumber }));

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
        <Callout label="most maverick (least PC1-aligned)">
          <span className="text-gold-bright">{d.maverick.lastName}</span> — PC1 loading{" "}
          {d.loadings.find((l) => l.id === d.maverick.id)!.pc[0].toFixed(2)}, the least of any justice (votes
          least explained by the ideological axis)
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
      </div>

      {/* most unexpected lineup */}
      {d.mostUnexpected && (
        <div className="mt-3 rounded border border-ink-line bg-ink-raised/40 p-3">
          <div className="smallcaps mb-1 text-[9px] text-cream-faint">
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
          <h3 className="smallcaps mb-3 text-[10px] text-gold">condition number by term (log scale)</h3>
          <CondBars rows={condRows} />
        </div>
      </div>
    </div>
  );
}
