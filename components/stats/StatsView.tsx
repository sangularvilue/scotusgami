"use client";

import { useState } from "react";
import { IDEOLOGICAL_IDS, JUSTICE_BY_ID, SENIORITY_IDS } from "@/lib/justices";
import { PARTY } from "@/lib/scotus-stats";
import type {
  AllStats,
  MajorityFreq,
  PivotalPower,
  SplitBreakdown,
  StatsResult,
} from "@/lib/scotus-stats";
import { PARTY_COLOR } from "./colors";
import { spreadY } from "./layout";
import Scatter2D from "./Scatter2D";
import Scatter3D from "./Scatter3D";

/** Translucent party fill for horizontal bars. */
const PARTY_FILL: Record<"R" | "D", string> = {
  R: "rgba(192,86,75,0.6)",
  D: "rgba(111,143,191,0.6)",
};

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

/** A value-over-time line (terms on x); log or linear y. */
function LineChart({
  points,
  baseline: refLine,
  log = true,
  digits = 0,
}: {
  points: { label: string; value: number }[];
  baseline?: { value: number; label: string };
  log?: boolean;
  digits?: number;
}) {
  const W = 440, H = 150, padL = 34, padB = 22, padT = 14, padR = 12;
  const tx = (v: number) => (log ? Math.log10(Math.max(1, v)) : v);
  const vals = points.map((p) => (isFinite(p.value) ? p.value : 1));
  const tvals = [...vals, ...(refLine ? [refLine.value] : [])].map(tx);
  let lo = Math.min(...tvals), hi = Math.max(...tvals);
  const pad = (hi - lo) * 0.12 || 1;
  lo = log ? Math.min(lo, 0) : lo - pad;
  hi += pad;
  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (tx(v) - lo) / (hi - lo || 1)) * (H - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const fmt = (v: number) => (isFinite(v) ? v.toFixed(digits) : "∞");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="value over time">
      {refLine && (
        <g>
          <line x1={padL} y1={y(refLine.value)} x2={W - padR} y2={y(refLine.value)} stroke="#5d5f60" strokeDasharray="4 3" />
          <text x={W - padR} y={y(refLine.value) - 3} fontSize={8} textAnchor="end" fill="#5d5f60" className="font-mono">
            {refLine.label} {fmt(refLine.value)}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="#6f8fbf" strokeWidth={1.5} />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={3} fill="#6f8fbf" />
          <text x={x(i)} y={y(p.value) - 7} fontSize={9} textAnchor="middle" fill="#c9c3b4" className="font-mono">
            {fmt(p.value)}
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

/** Ideology-ordered heatmap of pairwise voting agreement. */
function AgreementMatrix({ agreement }: { agreement: (number | null)[][] }) {
  const order = IDEOLOGICAL_IDS.map((id) => SENIORITY_IDS.indexOf(id));
  const vals: number[] = [];
  for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++)
    if (a !== b && agreement[a][b] != null) vals.push(agreement[a][b] as number);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const SZ = 34;

  const cells: React.ReactNode[] = [<div key="corner" />];
  for (const si of order)
    cells.push(
      <div key={`h${si}`} title={JUSTICE_BY_ID[SENIORITY_IDS[si]].fullName}
        className="flex items-end justify-center pb-0.5 font-mono text-[9px] text-cream-faint" style={{ height: 22 }}>
        {JUSTICE_BY_ID[SENIORITY_IDS[si]].tick}
      </div>
    );
  for (const r of order) {
    cells.push(
      <div key={`r${r}`} title={JUSTICE_BY_ID[SENIORITY_IDS[r]].fullName}
        className="flex items-center justify-end pr-1.5 font-mono text-[9px] text-cream-faint" style={{ height: SZ }}>
        {JUSTICE_BY_ID[SENIORITY_IDS[r]].tick}
      </div>
    );
    for (const c of order) {
      if (r === c) { cells.push(<div key={`${r}-${c}`} className="border border-ink" style={{ background: "#1a1f28" }} />); continue; }
      const v = agreement[r][c];
      const t = v == null ? 0 : hi > lo ? (v - lo) / (hi - lo) : 0.5;
      const bg = v == null ? "transparent" : `rgba(201,165,88,${(0.08 + 0.9 * t).toFixed(2)})`;
      cells.push(
        <div key={`${r}-${c}`} title={`${JUSTICE_BY_ID[SENIORITY_IDS[r]].lastName} & ${JUSTICE_BY_ID[SENIORITY_IDS[c]].lastName}: ${v == null ? "—" : Math.round(v * 100) + "%"}`}
          className="flex items-center justify-center border border-ink font-mono text-[9px]"
          style={{ height: SZ, background: bg, color: t > 0.55 ? "#0d1015" : "#c9c3b4" }}>
          {v == null ? "—" : Math.round(v * 100)}
        </div>
      );
    }
  }
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-grid" style={{ gridTemplateColumns: `28px repeat(9, ${SZ}px)` }}>{cells}</div>
    </div>
  );
}

const MAJ_METRICS = [
  { key: "all", label: "all cases" },
  { key: "nonUnan", label: "non-unanimous" },
  { key: "close", label: "closely divided" },
] as const;
type MajMetric = (typeof MAJ_METRICS)[number]["key"];

/** Per-justice frequency in the majority coalition, with a subset toggle. */
function MajorityFrequency({ rows }: { rows: MajorityFreq[] }) {
  const [metric, setMetric] = useState<MajMetric>("all");
  const nKey = `${metric}N` as "allN" | "nonUnanN" | "closeN";
  const sorted = [...rows].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MAJ_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
              metric === m.key
                ? "border-gold bg-gold/15 text-gold-bright"
                : "border-gold/40 text-gold hover:bg-gold/10"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {sorted.map((r) => {
          const v = r[metric];
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-right font-mono text-[10px] text-cream-dim">{r.lastName}</span>
              <div className="relative h-4 flex-1 rounded-sm bg-ink-line/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: v == null ? 0 : pct(v), background: PARTY_FILL[r.party] }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-[10px] text-cream-faint">
                {v == null ? "—" : pct1(v)} <span className="opacity-60">· {r[nKey]}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Per-justice empirical Banzhaf pivotal power (bar scaled to the max share). */
function PivotalPowerChart({ rows, nClose }: { rows: PivotalPower[]; nClose: number }) {
  if (nClose === 0)
    return (
      <p className="text-[12px] text-cream-faint">
        No closely decided cases (winning margin ≤ 2) in this dataset — no pivotal votes to score.
      </p>
    );
  const sorted = [...rows].sort((a, b) => b.banzhaf - a.banzhaf);
  const max = Math.max(...rows.map((r) => r.banzhaf), 1e-9);
  return (
    <div className="space-y-1.5">
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-right font-mono text-[10px] text-cream-dim">{r.lastName}</span>
          <div className="relative h-4 flex-1 rounded-sm bg-ink-line/40">
            <div
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{ width: pct(r.banzhaf / max), background: PARTY_FILL[r.party] }}
            />
          </div>
          <span className="w-28 shrink-0 text-right font-mono text-[10px] text-cream-faint">
            {pct1(r.banzhaf)} <span className="opacity-60">· {r.pivotalCases} case{r.pivotalCases === 1 ? "" : "s"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const SPLIT_SEGMENTS: { key: keyof SplitBreakdown; label: string; color: string }[] = [
  { key: "unanimous", label: "9–0", color: "#c9a558" },
  { key: "oneDissent", label: "8–1", color: "#a98a45" },
  { key: "twoDissent", label: "7–2", color: "#8a7038" },
  { key: "threeCross", label: "6–3 cross", color: "#6f8fbf" },
  { key: "threeIdeological", label: "6–3 party-line", color: "#c0564b" },
  { key: "fourDissent", label: "5–4", color: "#8f3a32" },
  { key: "other", label: "tie", color: "#4a4f57" },
];

/** Stacked coalition-size bars, one row per dataset. */
function SplitBreakdownBars({ rows }: { rows: { label: string; b: SplitBreakdown }[] }) {
  return (
    <div>
      <div className="space-y-2">
        {rows.map((r) => {
          const tot = SPLIT_SEGMENTS.reduce((s, seg) => s + r.b[seg.key], 0) || 1;
          return (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 font-mono text-[10px] text-cream-dim">{r.label}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-ink-line/40">
                {SPLIT_SEGMENTS.map((seg) => {
                  const c = r.b[seg.key];
                  if (!c) return null;
                  const frac = c / tot;
                  return (
                    <div
                      key={seg.key}
                      title={`${seg.label}: ${c} (${(100 * frac).toFixed(0)}%)`}
                      style={{ width: pct(frac), background: seg.color, color: "#12151c" }}
                      className="flex items-center justify-center overflow-hidden font-mono text-[9px]"
                    >
                      {frac > 0.06 ? c : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {SPLIT_SEGMENTS.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1 font-mono text-[9px] text-cream-faint">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: seg.color }} /> {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Each justice's PC1 (ideology) loading traced across terms. */
function PC1Drift({ terms }: { terms: StatsResult[] }) {
  const W = 460, H = 240, padL = 24, padR = 52, padT = 18, padB = 26;
  if (terms.length < 2)
    return <p className="text-[12px] text-cream-faint">Need at least two terms to trace drift.</p>;
  const series = SENIORITY_IDS.map((id) => ({
    id,
    tick: JUSTICE_BY_ID[id].tick,
    party: PARTY_COLOR[PARTY[id]],
    vals: terms.map((t) => t.loadings.find((l) => l.id === id)?.pc[0] ?? 0),
  }));
  const all = series.flatMap((s) => s.vals);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.1 || 0.1;
  lo -= pad;
  hi += pad;
  const x = (i: number) => padL + (i / (terms.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const endY = series.map((s) => y(s.vals[s.vals.length - 1]));
  const labelY = spreadY(endY.slice(), 11, padT + 4, H - padB - 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="PC1 loading drift across terms">
      {lo < 0 && hi > 0 && (
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="#3a4453" strokeDasharray="3 3" />
      )}
      {terms.map((t, i) => (
        <text key={t.term} x={x(i)} y={H - 8} fontSize={9} textAnchor="middle" fill="#9a958a" className="font-mono">
          OT{t.term}
        </text>
      ))}
      {series.map((s, si) => {
        const path = s.vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
        const lx = W - padR + 5;
        const ly = labelY[si];
        const ey = endY[si];
        return (
          <g key={s.id}>
            <path d={path} fill="none" stroke={s.party} strokeWidth={1.4} opacity={0.85} />
            {s.vals.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2.2} fill={s.party} />
            ))}
            {Math.abs(ly - ey) > 4 && (
              <line x1={W - padR} y1={ey} x2={lx - 1} y2={ly - 3} stroke="#3a4453" strokeWidth={0.6} />
            )}
            <text x={lx} y={ly} fontSize={9} fill={s.party} className="font-mono">
              {s.tick}
            </text>
          </g>
        );
      })}
      <text x={padL} y={padT - 6} fontSize={8} fill="#5d5f60" className="font-mono">
        ↑ conservative loading · liberal below
      </text>
    </svg>
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

      {/* frequency in the majority */}
      <div className="mt-6">
        <h3 className="smallcaps mb-2 text-[10px] text-gold">
          frequency in the majority — share of participated cases in the winning coalition
        </h3>
        <MajorityFrequency rows={d.majorityFreq} />
        <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
          How often each justice landed with the Court, among the cases they took part in. Toggle the denominator:{" "}
          <span className="text-cream">all cases</span> (unanimous included), only <span className="text-cream">non-unanimous</span>{" "}
          decisions, or just the <span className="text-cream">closely divided</span> ones (6–3 / 5–4). The count after each
          bar is that justice&apos;s denominator. The Chief and the median conservatives sit at the top; the further left a
          justice, the more the number falls as the denominator narrows to contested cases.
        </p>
      </div>

      {/* agreement matrix */}
      <div className="mt-6">
        <h3 className="smallcaps mb-2 text-[10px] text-gold">
          agreement matrix — % of shared cases on the same side (ordered by ideology)
        </h3>
        <AgreementMatrix agreement={d.agreement} />
        <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
          Share of cases (in which both participated) where the two justices landed on the same side — both in the
          majority or both in dissent. Brighter = more agreement; the ideological blocs show up as bright squares.
        </p>
      </div>

      {/* pivotal power (empirical Banzhaf) */}
      <div className="mt-6">
        <h3 className="smallcaps mb-2 text-[10px] text-gold">
          pivotal power — empirical Banzhaf index ({d.nClose} closely decided case{d.nClose === 1 ? "" : "s"})
        </h3>
        <PivotalPowerChart rows={d.pivotalPower} nClose={d.nClose} />
        <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
          Among decisions won by a margin of two or fewer votes, how often a justice was a <span className="text-cream">swing
          vote</span> — one whose flip would have reversed the result. Bars show each justice&apos;s share of all such pivotal
          instances (an observed-coalition <span className="text-cream">Banzhaf index</span>); the count is their raw number of
          pivotal cases. Only majority-side votes can be pivotal, so a justice who dissented through all the term&apos;s
          knife-edge cases scores zero. This is the same vote-flip signal behind &ldquo;most / least decisive,&rdquo; spread
          across the whole bench.
        </p>
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
        <Callout label="effective # of components (participation ratio)">
          <span className="text-gold-bright">{d.effectiveComponents.toFixed(1)}</span> of 9 — the term votes like ~
          {d.effectiveComponents.toFixed(1)} independent factors
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

      {/* minimum set to infer the winner (relative encoding) */}
      {d.winnerInference && (
        <div className="mt-3 rounded border border-ink-line bg-ink-raised/40 p-3">
          <div className="smallcaps mb-1 text-[10px] text-gold/80">
            minimum set to infer the winner — {d.winnerInference.size} justices
            {d.winnerInference.majorityVote ? " · a simple majority vote" : ` · ${pct(d.winnerInference.linearity)} like a majority vote`}
          </div>
          <p className="mb-2 text-[12px] leading-snug text-cream-dim">
            Take <span className="text-gold-bright">{d.winnerInference.reference}</span> as the reference; each other
            justice is coded by whether they voted the <span className="text-cream">same</span> side or the{" "}
            <span className="text-cream">opposite</span>, and the winner is {d.winnerInference.reference}&apos;s side or
            the opposite. Knowing just these {d.winnerInference.size} determines who won in every case
            {d.winnerInference.majorityVote ? " — and it reduces to a plain majority vote of the set" : ""}
            {d.winnerInference.skipped > 0
              ? ` (excludes ${d.winnerInference.skipped} case${d.winnerInference.skipped === 1 ? "" : "s"} where ${d.winnerInference.reference} recused)`
              : ""}.
          </p>
          <div className="overflow-x-auto">
            <table className="font-mono text-[11px]">
              <thead>
                <tr className="text-cream-faint">
                  <th className="px-2 py-1 text-left font-normal">{d.winnerInference.reference} (ref)</th>
                  {d.winnerInference.others.map((n) => (
                    <th key={n} className="px-2 py-1 text-left font-normal">{n}</th>
                  ))}
                  <th className="px-2 py-1 text-left font-normal">→ winner</th>
                </tr>
              </thead>
              <tbody>
                {d.winnerInference.table.map((row, i) => (
                  <tr key={i} className="border-t border-ink-line/60">
                    <td className="px-2 py-1 text-gold/70">same</td>
                    {row.pattern.map((c, j) => (
                      <td key={j} className="px-2 py-1 text-cream-dim">
                        {c > 0 ? "same" : c < 0 ? "opp" : "—"}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-gold-bright">
                      {row.winner === "ref" ? `${d.winnerInference!.reference}’s side` : "opposite"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <h3 className="smallcaps mb-3 text-[10px] text-gold">effective # of components over time (participation ratio)</h3>
          <LineChart
            points={stats.terms.map((s) => ({ label: `OT${s.term}`, value: s.effectiveComponents }))}
            baseline={stats.overall ? { value: stats.overall.effectiveComponents, label: "all-time" } : undefined}
            log={false}
            digits={1}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-cream-dim">
            Effective components = 1 ÷ Σ(variance shareᵢ²) — the participation ratio (reciprocal of the Herfindahl index
            of variance concentration). It reads voting <span className="text-cream">dimensionality</span> directly:
            near <span className="text-cream">1</span> is a one-factor Court (everything rides the ideological axis), up
            to <span className="text-cream">9</span> when variance is spread evenly across independent blocs. So a term
            here &ldquo;behaves like ~N independent factors.&rdquo;
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
            It weights every PC by its size, so it isn&apos;t hostage to any single noisy eigenvalue — a steady read on
            how many dimensions the Court&apos;s divisions really span. <span className="text-gold">Rising</span> = more
            independent voting blocs; <span className="text-gold">falling</span> = collapsing toward a single axis.
          </p>
        </div>
      </div>

      {/* coalition split breakdown across terms */}
      <div className="mt-10 border-t border-ink-line pt-8">
        <h3 className="smallcaps mb-3 text-[10px] text-gold">
          coalition sizes by term — how the votes split
        </h3>
        <SplitBreakdownBars
          rows={[
            ...(stats.overall ? [{ label: "All", b: stats.overall.splitBreakdown }] : []),
            ...stats.terms.map((s) => ({ label: `OT${s.term}`, b: s.splitBreakdown })),
          ]}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-cream-dim">
          Every decided case placed by the size of its dissent, so a term reads as one stacked bar. The two{" "}
          <span className="text-cream">6–3</span> shades are the story of this Court: a{" "}
          <span style={{ color: "#c0564b" }}>party-line 6–3</span> (the six Republican appointees over the three
          Democratic ones, or vice-versa) versus a <span style={{ color: "#6f8fbf" }}>cross-cutting 6–3</span> where at
          least one justice breaks from their bloc. The party-line band swelling over time is the empirical face of the
          &ldquo;ideological split&rdquo; the StatPack flags.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
          Bucketed by number of dissents (recusals fold into the nearest split, so an 8-vote 6–2 counts as 7–2); ties
          and equally-divided cases fall in <span style={{ color: "#8a8f97" }}>tie</span>.
        </p>
      </div>

      {/* PC1 ideology drift across terms */}
      <div className="mt-10 grid gap-8 border-t border-ink-line pt-8 sm:grid-cols-2">
        <div>
          <h3 className="smallcaps mb-3 text-[10px] text-gold">
            ideological drift — each justice&apos;s PC1 loading across terms
          </h3>
          <PC1Drift terms={stats.terms} />
        </div>
        <div className="self-center">
          <p className="text-[12px] leading-relaxed text-cream-dim">
            PC1 is the Court&apos;s main left–right axis. Tracing each justice&apos;s loading on it term by term shows who is
            <span className="text-cream"> drifting</span> and who holds station. Each term&apos;s PC1 is its own unit
            eigenvector, oriented so a conservative vote loads positive, so the vertical scale is comparable across terms.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-cream-faint">
            Lines near the center are the swing justices; a justice crossing another signals a term where their voting
            patterns converged. Watch the spread between the blocs widen or narrow — a compact read on polarization that
            complements the participation-ratio line above.
          </p>
        </div>
      </div>
    </div>
  );
}
