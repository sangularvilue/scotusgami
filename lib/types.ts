/** A justice's side in a given case. */
export type Side = "M" | "D" | "A" | "T";
// majority | dissent | absent (took no part) | tied (equally divided court — sides unrecorded)

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
  /** Wikipedia pageviews (recent ~60 days) — fame proxy for game rarity scoring; 0 = no article */
  fame?: number;
}

export interface Meta {
  lastRefresh: string; // ISO datetime
  caseCount: number;
  terms: number[];
}

/**
 * A single argued merits case as it appears on the bingo card: its argument
 * sitting, whether it has come down yet, and (if decided) who wrote the Court's
 * opinion. Pending cases (argued, not yet decided) carry a null author.
 */
export interface BingoCase {
  term: string;
  docket: string;
  name: string;
  /** ISO date (YYYY-MM-DD) the case was argued, or null if unknown */
  argued: string | null;
  /** argument sitting label: "October" … "April", or null if off-calendar */
  sitting: string | null;
  /** ISO date decided, or null while still pending */
  decided: string | null;
  /** justice id of the majority/plurality opinion author, or null */
  majorityAuthor: string | null;
  oyezUrl: string;
}
