import { JUSTICE_BY_ID, SENIORITY_IDS } from "./justices";
import { pca, project, type PCAResult } from "./pca";
import type { CaseRecord } from "./types";

/**
 * Ideological / voting-bloc analysis of the current bench via PCA.
 *
 * Scoring (per Will's spec): for each case, each justice gets
 *   +1  in the majority or a (special) concurrence,
 *    0  took no part, tied court, OR concurred in part & dissented in part,
 *   -1  dissenting.
 * Justices are the variables, cases the observations. We mean-center each
 * justice's column and run plain covariance PCA (no scaling, no regularization).
 */

/** Party of the appointing president. */
export const PARTY: Record<string, "R" | "D"> = {
  john_g_roberts_jr: "R",
  clarence_thomas: "R",
  samuel_a_alito_jr: "R",
  neil_gorsuch: "R",
  brett_m_kavanaugh: "R",
  amy_coney_barrett: "R",
  sonia_sotomayor: "D",
  elena_kagan: "D",
  ketanji_brown_jackson: "D",
};

const MAJORITY_SIDE = new Set([
  "majority",
  "concurrence",
  "special concurrence",
  "coauthored special concurrence",
]);
const DISSENT_SIDE = new Set(["dissent", "coauthored dissent"]);

/** Which opinion sides each justice appears in (author or joiner). */
function opinionSides(c: CaseRecord): Record<string, { maj: boolean; dis: boolean }> {
  const out: Record<string, { maj: boolean; dis: boolean }> = {};
  for (const o of c.opinions ?? []) {
    for (const id of [o.author, ...(o.joinedBy ?? [])]) {
      const s = (out[id] ??= { maj: false, dis: false });
      if (MAJORITY_SIDE.has(o.type)) s.maj = true;
      if (DISSENT_SIDE.has(o.type)) s.dis = true;
    }
  }
  return out;
}

/** Score one justice in one case to +1 / 0 / -1. */
export function scoreJustice(c: CaseRecord, id: string, sides = opinionSides(c)): -1 | 0 | 1 {
  const v = c.votes[id];
  if (v === undefined || v === "A" || v === "T") return 0;
  // Concur-in-part-and-dissent-in-part: recorded in both a majority-side and a
  // dissenting opinion (Oyez's vote field can't express this on its own).
  const s = sides[id];
  if (s?.maj && s?.dis) return 0;
  if (v === "M") return 1;
  if (v === "D") return -1;
  return 0;
}

/** Full +1/0/-1 score vector for a case, in seniority (canonical) order. */
export function scoreCase(c: CaseRecord): number[] {
  const sides = opinionSides(c);
  return SENIORITY_IDS.map((id) => scoreJustice(c, id, sides));
}

export interface JusticeLoading {
  id: string;
  lastName: string;
  party: "R" | "D";
  /** loading on each PC (PC1, PC2, PC3, …) */
  pc: number[];
  /**
   * Maverick score: PC-importance-weighted distance of this justice's loadings
   * from the court's centroid, with PC1 (the main ideological axis) removed —
   * i.e. how far the justice stands apart from the pack on the *secondary*
   * dimensions. Higher = more maverick.
   */
  maverick: number;
}

export interface UnexpectedLineup {
  name: string;
  docket: string;
  decided: string;
  /** Mahalanobis distance in PC space — larger = less expected */
  distance: number;
  /** per-justice score in seniority order */
  scores: number[];
  /** e.g. "6–3" */
  split: string;
}

export interface StatsResult {
  label: string;
  term: number | null; // null = all-time
  nCases: number;
  /** true if any case is Oyez-sourced (not yet canonical SCDB) → numbers provisional */
  provisional: boolean;
  loadings: JusticeLoading[];
  eigenvalues: number[];
  varianceExplained: number[];
  pc1: number;
  pc12: number;
  /**
   * Participation ratio = 1 / Σ(variance shareᵢ²) — the effective number of
   * principal components (1 = one-factor court, up to 9 = variance spread evenly).
   * The reciprocal of the Herfindahl index of variance concentration; a robust
   * read on voting dimensionality (weights every PC by size, unlike the
   * condition number, which hinges on the noisy smallest eigenvalue).
   */
  effectiveComponents: number;
  /** justice ids ordered by PC1 loading (most liberal → most conservative) */
  pc1Order: string[];
  maverick: { id: string; lastName: string; score: number };
  /** justices whose removal would flip the fewest / most case outcomes */
  mostRedundant: { lastNames: string[]; changes: number };
  leastRedundant: { lastNames: string[]; changes: number };
  /** the closest pair of justices by the maverick distance metric */
  twins: { aName: string; bName: string; dist: number } | null;
  /** smallest set of justices whose votes determine the winner (relative encoding) */
  winnerInference: WinnerInference | null;
  /** share of decided cases with no dissent (unanimous in judgment) */
  unanimityRate: number;
  nDivided: number;
  partyLinePct: number; // over divided cases
  anyLinePct: number; // over divided cases
  mostUnexpected: UnexpectedLineup | null;
}

function splitLabel(scores: number[]): string {
  const maj = scores.filter((s) => s > 0).length;
  const dis = scores.filter((s) => s < 0).length;
  return `${maj}–${dis}`;
}

/** Is a divided case split exactly on party lines (R one side, D the other)? */
function isPartyLine(scores: number[]): boolean {
  let rSign = 0,
    dSign = 0,
    rMixed = false,
    dMixed = false;
  SENIORITY_IDS.forEach((id, j) => {
    const s = scores[j];
    if (!s) return;
    if (PARTY[id] === "R") {
      if (rSign && rSign !== s) rMixed = true;
      rSign = s;
    } else {
      if (dSign && dSign !== s) dMixed = true;
      dSign = s;
    }
  });
  return !rMixed && !dMixed && rSign !== 0 && dSign !== 0 && rSign !== dSign;
}

/** Does a single cut in the PC1 ordering separate the two sides of the case? */
function isAnyLine(scores: number[], pc1Index: number[]): boolean {
  // signs of nonzero justices, walked in PC1 (liberal→conservative) order
  const seq: number[] = [];
  for (const j of pc1Index) if (scores[j]) seq.push(scores[j]);
  if (seq.length < 2) return false;
  let changes = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
  return changes === 1; // one clean boundary along the ideological axis
}

const THOMAS_IDX = SENIORITY_IDS.indexOf("clarence_thomas");

export function computeStats(
  label: string,
  term: number | null,
  cases: CaseRecord[]
): StatsResult | null {
  if (cases.length < 3) return null;
  const X = cases.map(scoreCase);

  // Orient PC1 so the most conservative anchor (Thomas) loads positive, so PC1
  // reads liberal(−) → conservative(+) consistently across terms.
  const r: PCAResult = pca(X, (loadings, k) => {
    if (k === 0) return loadings[THOMAS_IDX][0] || 1;
    // higher PCs: largest-magnitude loading positive (deterministic)
    let best = 0;
    for (let j = 1; j < loadings.length; j++)
      if (Math.abs(loadings[j][k]) > Math.abs(loadings[best][k])) best = j;
    return loadings[best][k] || 1;
  });

  // Distance in PC-loading space, weighting each axis by its importance
  // (variance explained) and dropping PC1 — so it measures how justices differ
  // on the secondary (non-left/right) dimensions, not simply on left vs right.
  const p = r.loadings.length;
  const wdist = (a: number[], b: number[]) => {
    let d2 = 0;
    for (let k = 1; k < p; k++) {
      const diff = a[k] - b[k];
      d2 += r.varianceExplained[k] * diff * diff;
    }
    return Math.sqrt(d2);
  };
  const centroid = r.eigenvalues.map(
    (_, k) => r.loadings.reduce((s, row) => s + row[k], 0) / p
  );

  // Maverick = greatest such distance from the court's center.
  const loadings: JusticeLoading[] = SENIORITY_IDS.map((id, j) => ({
    id,
    lastName: JUSTICE_BY_ID[id].lastName,
    party: PARTY[id],
    pc: r.loadings[j],
    maverick: wdist(r.loadings[j], centroid),
  }));

  // "Twins" = the closest pair by that same distance metric.
  let twins: StatsResult["twins"] = null;
  for (let a = 0; a < p; a++)
    for (let b = a + 1; b < p; b++) {
      const dist = wdist(r.loadings[a], r.loadings[b]);
      if (!twins || dist < twins.dist)
        twins = {
          aName: JUSTICE_BY_ID[SENIORITY_IDS[a]].lastName,
          bName: JUSTICE_BY_ID[SENIORITY_IDS[b]].lastName,
          dist,
        };
    }

  const pc1Order = [...loadings]
    .sort((a, b) => a.pc[0] - b.pc[0])
    .map((l) => l.id);
  const pc1Index = pc1Order.map((id) => SENIORITY_IDS.indexOf(id));

  const maverickL = [...loadings].sort((a, b) => b.maverick - a.maverick)[0];

  // party-line / any-line over divided cases; unexpected lineup via Mahalanobis
  const lamMax = r.eigenvalues[0] || 1;
  const lamFloor = lamMax * 1e-6;
  let nDivided = 0,
    partyLine = 0,
    anyLine = 0,
    unanimous = 0;
  let worst: UnexpectedLineup | null = null;
  // redundancy: for each justice, how many case outcomes would change if that
  // justice had voted the other way. Flipping a vote shifts the margin by two,
  // so it changes the result only in a one- or two-vote decision (5–4 → 4–5, or
  // 5–3 with a recusal → a 4–4 tie). Flipping a dissent only pads the majority,
  // so dissenters are never pivotal; every justice on the majority side of such
  // a close case is "decisive" there.
  const flips = new Array(p).fill(0);

  cases.forEach((c, i) => {
    const s = X[i];
    const nDis = s.filter((v) => v < 0).length;
    const nMaj = s.filter((v) => v > 0).length;
    if (nDis === 0) unanimous++;
    if (nDis > 0 && nMaj > 0) {
      nDivided++;
      if (isPartyLine(s)) partyLine++;
      if (isAnyLine(s, pc1Index)) anyLine++;
    }
    if (nMaj > nDis && nMaj - nDis <= 2) for (let j = 0; j < p; j++) if (s[j] > 0) flips[j]++;
    const z = project(s, r);
    let d2 = 0;
    for (let k = 0; k < z.length; k++)
      if (r.eigenvalues[k] > lamFloor) d2 += (z[k] * z[k]) / r.eigenvalues[k];
    const distance = Math.sqrt(d2);
    if (!worst || distance > worst.distance) {
      worst = {
        name: c.name,
        docket: c.docket,
        decided: c.decided,
        distance,
        scores: s,
        split: splitLabel(s),
      };
    }
  });

  const minFlips = Math.min(...flips);
  const maxFlips = Math.max(...flips);
  const namesAt = (v: number) =>
    SENIORITY_IDS.filter((_, j) => flips[j] === v).map((id) => JUSTICE_BY_ID[id].lastName);

  return {
    label,
    term,
    nCases: cases.length,
    provisional: cases.some((c) => c.source !== "scdb"),
    loadings,
    eigenvalues: r.eigenvalues,
    varianceExplained: r.varianceExplained,
    pc1: r.varianceExplained[0],
    pc12: r.varianceExplained[0] + (r.varianceExplained[1] ?? 0),
    effectiveComponents: 1 / r.varianceExplained.reduce((s, p) => s + p * p, 0),
    pc1Order,
    maverick: { id: maverickL.id, lastName: maverickL.lastName, score: maverickL.maverick },
    mostRedundant: { lastNames: namesAt(minFlips), changes: minFlips },
    leastRedundant: { lastNames: namesAt(maxFlips), changes: maxFlips },
    twins,
    winnerInference: computeWinnerInference(X),
    unanimityRate: unanimous / cases.length,
    nDivided,
    partyLinePct: nDivided ? partyLine / nDivided : 0,
    anyLinePct: nDivided ? anyLine / nDivided : 0,
    mostUnexpected: worst,
  };
}

export interface WinnerInference {
  /** the reference justice (A): everyone else is coded relative to their side */
  reference: string;
  /** the other justices in the minimal set, in table-column order */
  others: string[];
  size: number;
  /** cases excluded because the reference justice recused (couldn't be encoded) */
  skipped: number;
  /** fraction of cases where a plain majority vote of the set gives the winner */
  linearity: number;
  /** true when the mapping is exactly a majority vote of the set */
  majorityVote: boolean;
  /** distinct observed patterns → winner. pattern[i]: +1 same side as ref, -1 opposite, 0 abstain */
  table: { pattern: number[]; winner: "ref" | "opp" }[];
}

function combos(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

/**
 * Smallest set of justices whose votes determine who won, encoded relative to a
 * reference justice A (never-abstaining, so the table is clean): every other
 * justice is "same side as A / opposite / abstain," and the winner is "A's side
 * or the opposite." Among minimal sets we return the MOST LINEAR one — the one
 * whose mapping best matches a plain majority vote of the set.
 */
function computeWinnerInference(X: number[][]): WinnerInference | null {
  const p = SENIORITY_IDS.length;
  if (X.length < 4) return null;
  const abst = SENIORITY_IDS.map((_, j) => X.filter((v) => v[j] === 0).length);
  const minAbst = Math.min(...abst); // reference = a least-recusing justice
  for (let k = 2; k <= p; k++) {
    let best: { S: number[]; A: number; others: number[]; table: Map<string, number>; lin: number; n: number } | null = null;
    for (const S of combos(p, k)) {
      for (const A of S) {
        if (abst[A] !== minAbst) continue; // reference must be a least-abstaining justice
        const others = S.filter((i) => i !== A);
        const table = new Map<string, number>();
        let lin = 0, n = 0, ok = true;
        for (const v of X) {
          if (v[A] === 0) continue; // reference recused → outside the A-relative frame
          n++;
          const feats = others.map((m) => v[m] * v[A]);
          const label = v[A] > 0 ? 1 : -1;
          const key = feats.join(",");
          const prev = table.get(key);
          if (prev !== undefined && prev !== label) { ok = false; break; }
          table.set(key, label);
          if ((1 + feats.reduce((a, b) => a + b, 0) > 0 ? 1 : -1) === label) lin++;
        }
        if (ok && (!best || lin / n > best.lin / best.n)) best = { S, A, others, table, lin, n };
      }
    }
    if (best) {
      const rows = [...best.table.entries()]
        .map(([key, w]) => ({ pattern: key.split(",").map(Number), winner: (w > 0 ? "ref" : "opp") as "ref" | "opp" }))
        .sort((a, b) =>
          a.winner === b.winner ? a.pattern.join().localeCompare(b.pattern.join()) : a.winner === "ref" ? -1 : 1
        );
      return {
        reference: JUSTICE_BY_ID[SENIORITY_IDS[best.A]].lastName,
        others: best.others.map((i) => JUSTICE_BY_ID[SENIORITY_IDS[i]].lastName),
        size: best.S.length,
        skipped: abst[best.A],
        linearity: best.lin / best.n,
        majorityVote: best.lin / best.n >= 0.999,
        table: rows,
      };
    }
  }
  return null;
}

export interface AllStats {
  overall: StatsResult | null;
  terms: StatsResult[]; // ascending by term
}

/** Compute the all-time (current-court) analysis plus one per term. */
export function computeAllStats(cases: CaseRecord[]): AllStats {
  const byTerm = new Map<number, CaseRecord[]>();
  for (const c of cases) {
    const t = Number(c.term);
    if (!Number.isFinite(t)) continue;
    (byTerm.get(t) ?? byTerm.set(t, []).get(t)!).push(c);
  }
  const terms = [...byTerm.keys()].sort((a, b) => a - b);
  return {
    overall: computeStats("All time (current court)", null, cases),
    terms: terms
      .map((t) => computeStats(`OT${t}`, t, byTerm.get(t)!))
      .filter((s): s is StatsResult => s !== null),
  };
}
