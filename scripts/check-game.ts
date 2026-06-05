/** Sanity-check Immaculate Bench puzzle generation over several dates. */
import { readFileSync, readdirSync } from "node:fs";
import { generatePuzzle, toGameCases, validAnswers } from "../lib/game";
import { JUSTICE_BY_ID } from "../lib/justices";
import type { CaseRecord } from "../lib/types";

const files = readdirSync("data").filter((f) => f.endsWith(".json"));
let all: CaseRecord[] = [];
for (const f of files)
  all = all.concat(JSON.parse(readFileSync("data/" + f, "utf8")));
const seen = new Set<string>();
const merged: CaseRecord[] = [];
for (const c of all) {
  const k = c.term + "/" + c.docket;
  if (!seen.has(k)) {
    seen.add(k);
    merged.push(c);
  }
}
const pool = toGameCases(merged);
console.log(`answer pool: ${pool.length} non-unanimous cases of ${merged.length}`);

const ln = (id: string) => JUSTICE_BY_ID[id].lastName;
for (const d of ["2026-06-05", "2026-06-06", "2026-06-07", "2026-07-01"]) {
  const p = generatePuzzle(pool, d);
  const counts = p.rows.flatMap((r) =>
    p.cols.map((c) => validAnswers(pool, r, c).length)
  );
  console.log(
    `${d}  rows ${p.rows.map(ln).join("/")}  cols ${p.cols.map(ln).join("/")}  answers/cell ${counts.join(",")}`
  );
  if (counts.some((n) => n === 0)) {
    console.error("UNSOLVABLE CELL");
    process.exit(1);
  }
}
console.log("ALL PUZZLES SOLVABLE");
