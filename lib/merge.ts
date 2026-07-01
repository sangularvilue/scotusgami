import type { CaseRecord } from "./types";

/**
 * Combine a term's Oyez records with its SCDB supplement.
 *
 * For a COMPLETED term we generate a full, canonical SCDB dataset (see
 * scripts/build-scdb.ts) — one record per decision, votes from the Supreme
 * Court Database, which matches the SCOTUSblog StatPack. Oyez's vote matrices
 * are incomplete and occasionally miscoded for past terms, so when a full SCDB
 * supplement exists we use it as the source of truth and drop Oyez for that
 * term (this also collapses consolidated companions to one decision). Terms
 * with no supplement yet (e.g. the in-progress term, before SCDB releases)
 * fall back to Oyez.
 */
export function mergeTerm(oyez: CaseRecord[], supplement: CaseRecord[]): CaseRecord[] {
  return supplement.length ? supplement : oyez;
}
