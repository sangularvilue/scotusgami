import type { CaseRecord } from "./types";

/** Merge a term's Oyez records with its SCDB supplement; Oyez wins per docket. */
export function mergeTerm(oyez: CaseRecord[], supplement: CaseRecord[]): CaseRecord[] {
  const covered = new Set(oyez.map((c) => c.docket));
  return [...oyez, ...supplement.filter((c) => !covered.has(c.docket))];
}
