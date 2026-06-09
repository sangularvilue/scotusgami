/** A justice's side in a case (SCDB-derived). */
export type Side = "M" | "D" | "A" | "T";
// majority | dissent | absent (took no part) | tied (equally divided)

/** One case in the modern-era game pool (1946–present), built from SCDB. */
export interface PoolCase {
  id: string; // SCDB caseId
  name: string;
  term: number;
  decided: string; // ISO
  usCite: string;
  naturalCourt: number;
  chief: string;
  votes: Record<string, Side>; // justiceName -> side
  maj: number;
  min: number;
  majWriter: string | null; // justiceName
  issueArea: number | null;
  issue?: number | null; // SCDB granular issue code
  direction: number | null; // 1 conservative, 2 liberal, 3 unspecifiable
  disposition: number | null; // SCDB caseDisposition
  petitioner: number | null;
  respondent: number | null;
  overruledPrecedent?: boolean; // this case overruled an earlier precedent (SCDB precedentAlteration)
  overruled?: boolean; // this case was itself later overruled (Wikipedia list)
  notable?: boolean;
  fame?: number;
}

/** A board axis header is either a justice or a category. */
export type Header =
  | { kind: "justice"; id: string } // id = SCDB justiceName
  | { kind: "category"; id: string }; // id = Category.id

export interface Puzzle {
  date: string;
  rows: Header[]; // 3
  cols: Header[]; // 3
}
