/** Sanity-check the modern-era generator over several dates. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generatePuzzle, headerLabel, validAnswers } from "../lib/game";
import type { PoolCase } from "../lib/game-types";

const pool = JSON.parse(
  readFileSync(join(process.cwd(), "data", "pool.json"), "utf8")
) as PoolCase[];
const notable = pool.filter((c) => c.notable);
console.log(`pool ${pool.length}, notable ${notable.length}`);

for (const d of ["2026-06-09", "2026-06-10", "2026-06-11", "2026-07-04", "2026-12-25"]) {
  const p = generatePuzzle(notable, d);
  console.log(`\n=== ${d} ===`);
  console.log("cols:", p.cols.map(headerLabel).join("  |  "));
  for (const r of p.rows) {
    const line = p.cols.map((c) => {
      const all = validAnswers(pool, r, c).length;
      const not = validAnswers(notable, r, c).length;
      return `${not}n/${all}`;
    });
    console.log(`${headerLabel(r).padEnd(22)} ${line.join("   ")}`);
  }
}
