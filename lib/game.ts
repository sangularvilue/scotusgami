import { SENIORITY_IDS } from "./justices";
import type { CaseRecord, Side } from "./types";

/**
 * Immaculate Bench: daily 3×3 grid. Rows and columns are justices; a cell is
 * answered with a case where both justices were on the same side (both in the
 * majority or both in dissent). Unanimous cases (no dissents) and equally
 * divided cases are excluded from the answer pool entirely.
 */

export interface GameCase {
  name: string;
  term: string;
  docket: string;
  decided: string;
  split: string; // e.g. "6–3"
  votes: Record<string, Side>;
  oyezUrl: string;
  /** Wikipedia-pageview fame; 0 = no article (maximally obscure) */
  fame: number;
}

export const GUESSES = 9;

/** Slim, client-safe answer pool: non-unanimous, non-tied cases only. */
export function toGameCases(cases: CaseRecord[]): GameCase[] {
  return cases
    .filter(
      (c) =>
        c.minority >= 1 &&
        !Object.values(c.votes).some((s) => s === "T")
    )
    .map((c) => ({
      name: c.name,
      term: c.term,
      docket: c.docket,
      decided: c.decided,
      split: `${c.majority}–${c.minority}`,
      votes: c.votes,
      oyezUrl: c.oyezUrl,
      fame: c.fame ?? 0,
    }));
}

/**
 * Rarity points per case: scales inversely with fame on a log curve.
 * The most famous case in the pool is worth 1 point; a case with no
 * Wikipedia article is worth 100. Your score is the sum of your boxes.
 */
export function rarityPoints(cases: GameCase[]): Map<string, number> {
  const maxFame = Math.max(1, ...cases.map((c) => c.fame));
  const denom = Math.log(1 + maxFame);
  return new Map(
    cases.map((c) => [
      caseId(c),
      Math.max(1, Math.round(100 * (1 - Math.log(1 + c.fame) / denom))),
    ])
  );
}

export const caseId = (c: GameCase) => `${c.term}/${c.docket}`;

/** Both justices participated and landed on the same side. */
export function sameSide(c: GameCase, a: string, b: string): boolean {
  const sa = c.votes[a];
  const sb = c.votes[b];
  return (sa === "M" || sa === "D") && sa === sb;
}

/** Indices of all valid answers for a justice pair. */
export function validAnswers(cases: GameCase[], a: string, b: string): number[] {
  const out: number[] = [];
  cases.forEach((c, i) => {
    if (sameSide(c, a, b)) out.push(i);
  });
  return out;
}

/* ---------- deterministic daily puzzle ---------- */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Puzzle {
  date: string;
  rows: string[]; // 3 justice ids
  cols: string[]; // 3 justice ids
}

/**
 * Pick 6 distinct justices (3 rows × 3 cols) such that every pair has at
 * least `minAnswers` valid cases. Deterministic for a given date.
 */
export function generatePuzzle(cases: GameCase[], date: string): Puzzle {
  const rng = mulberry32(hashString(`immaculate-bench:${date}`));
  for (let minAnswers = 2; minAnswers >= 1; minAnswers--) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const ids = [...SENIORITY_IDS];
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      const rows = ids.slice(0, 3);
      const cols = ids.slice(3, 6);
      const ok = rows.every((r) =>
        cols.every((c) => validAnswers(cases, r, c).length >= minAnswers)
      );
      if (ok) return { date, rows, cols };
    }
  }
  // pathological fallback (tiny dataset): just take the first six
  return { date, rows: SENIORITY_IDS.slice(0, 3), cols: SENIORITY_IDS.slice(3, 6) };
}

/** Local-timezone date string YYYY-MM-DD (Wordle-style daily rollover). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
