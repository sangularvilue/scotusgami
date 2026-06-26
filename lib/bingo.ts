import { SENIORITY_IDS } from "./justices";
import type { BingoCase } from "./types";

/** Argument sittings in calendar order. */
export const SITTINGS = [
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
  "April",
] as const;

export interface BingoCaseLite {
  name: string;
  docket: string;
  oyezUrl: string;
  decided: string | null;
}

export interface BingoSitting {
  sitting: string;
  /** justice id → the decided opinion(s) that justice authored this sitting */
  byAuthor: Record<string, BingoCaseLite[]>;
  /** argued-but-undecided cases from this sitting */
  pending: BingoCaseLite[];
  /** justice ids that have authored ≥1 majority this sitting */
  authored: string[];
  /**
   * justice ids with no majority yet this sitting — i.e. still "owed" one.
   * Only populated when the sitting still has pending cases (otherwise the
   * sitting is closed and an empty cell just means that justice was skipped).
   */
  owed: string[];
}

export interface BingoGrid {
  term: number;
  sittings: BingoSitting[];
  /** justice id → majorities authored this term */
  perJustice: Record<string, number>;
  decidedCount: number;
  pendingCount: number;
}

const lite = (c: BingoCase): BingoCaseLite => ({
  name: c.name,
  docket: c.docket,
  oyezUrl: c.oyezUrl,
  decided: c.decided,
});

/**
 * Fold a term's argued cases into the bingo card: for each sitting, who has
 * written and which cases are still out. The "owed" set is the heart of the
 * game — the justices who could still be holding a pending opinion.
 */
export function buildBingoGrid(term: number, cases: BingoCase[]): BingoGrid {
  const perJustice: Record<string, number> = {};

  const sittings: BingoSitting[] = SITTINGS.map((sitting) => {
    const inSitting = cases.filter((c) => c.sitting === sitting);
    const byAuthor: Record<string, BingoCaseLite[]> = {};
    const pending: BingoCaseLite[] = [];

    for (const c of inSitting) {
      if (c.decided && c.majorityAuthor) {
        (byAuthor[c.majorityAuthor] ??= []).push(lite(c));
        perJustice[c.majorityAuthor] = (perJustice[c.majorityAuthor] ?? 0) + 1;
      } else if (!c.decided) {
        pending.push(lite(c));
      }
      // decided with an unresolved author (rare for the current bench) is left
      // off the grid rather than guessed at.
    }

    const authored = SENIORITY_IDS.filter((id) => byAuthor[id]?.length);
    const owed = pending.length
      ? SENIORITY_IDS.filter((id) => !authored.includes(id))
      : [];

    return { sitting, byAuthor, pending, authored, owed };
  }).filter((row) => row.authored.length > 0 || row.pending.length > 0);

  return {
    term,
    sittings,
    perJustice,
    decidedCount: cases.filter((c) => c.decided).length,
    pendingCount: cases.filter((c) => !c.decided).length,
  };
}
