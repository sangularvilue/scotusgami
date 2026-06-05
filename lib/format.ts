import { decodeLineup } from "./grid";
import { IDEOLOGICAL_IDS, JUSTICE_BY_ID, type Justice } from "./justices";
import type { CaseRecord } from "./types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2024-06-27" → "Jun 27, 2024" (no timezone surprises) */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export interface LineupSides {
  maj: Justice[];
  dis: Justice[];
  out: Justice[];
  tied: Justice[];
}

/** Justices on each side, in ideological order. */
export function lineupSides(key: string): LineupSides {
  const votes = decodeLineup(key);
  const sides: LineupSides = { maj: [], dis: [], out: [], tied: [] };
  for (const id of IDEOLOGICAL_IDS) {
    const j = JUSTICE_BY_ID[id];
    if (votes[id] === "M") sides.maj.push(j);
    else if (votes[id] === "D") sides.dis.push(j);
    else if (votes[id] === "T") sides.tied.push(j);
    else sides.out.push(j);
  }
  return sides;
}

export interface OpinionLine {
  label: string; // "Opinion" | "Concurring" | "Dissenting"
  text: string;  // "Sotomayor (j. Kagan, Jackson); Gorsuch"
}

const last = (id: string) => JUSTICE_BY_ID[id]?.lastName ?? id;

/** Group a case's opinions into Opinion / Concurring / Dissenting lines. */
export function opinionLines(c: CaseRecord): OpinionLine[] {
  const buckets: Record<string, string[]> = {};
  for (const op of c.opinions) {
    const t = op.type.toLowerCase();
    const label = t.includes("dissent")
      ? "Dissenting"
      : t.includes("concur")
        ? "Concurring"
        : "Opinion";
    const joined =
      op.joinedBy.length > 0 ? ` (j. ${op.joinedBy.map(last).join(", ")})` : "";
    (buckets[label] ??= []).push(`${last(op.author)}${joined}`);
  }
  const order = ["Opinion", "Concurring", "Dissenting"];
  return order
    .filter((l) => buckets[l])
    .map((l) => ({ label: l, text: buckets[l].join("; ") }));
}
