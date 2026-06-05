/** A justice's side in a given case. */
export type Side = "M" | "D" | "A"; // majority | dissent | absent (took no part)

export interface OpinionInfo {
  /** e.g. "majority", "plurality", "concurrence", "special concurrence", "dissent" */
  type: string;
  /** Oyez justice identifier of the author (or raw name if not on the current bench) */
  author: string;
  /** Oyez justice identifiers of justices who joined this opinion */
  joinedBy: string[];
}

export interface CaseRecord {
  term: string;
  docket: string;
  name: string;
  /** ISO date (YYYY-MM-DD) the case was decided */
  decided: string;
  /** Question presented, plain text */
  question: string;
  /** Holding / conclusion, plain text */
  holding: string;
  winningParty: string;
  decisionType: string;
  /** 9-char canonical key over seniority-ordered justices, e.g. "MMMDDMMMA" */
  lineupKey: string;
  majority: number;
  minority: number;
  votes: Record<string, Side>;
  opinions: OpinionInfo[];
  oyezUrl: string;
  justiaUrl: string | null;
  /** vote-data source: Oyez (default) or SCDB supplement while Oyez catches up */
  source?: "oyez" | "scdb";
}

export interface Meta {
  lastRefresh: string; // ISO datetime
  caseCount: number;
  terms: number[];
}
