import { readFileSync } from "node:fs";
import { generatePuzzle } from "../lib/game";
import { CATEGORY_BY_ID } from "../lib/categories";
import type { PoolCase } from "../lib/game-types";

const pool = JSON.parse(readFileSync("data/pool.json", "utf8")) as PoolCase[];
const notable = pool.filter((c) => c.notable);
let bad = 0;
const jdist: Record<number, number> = {};
for (let d = 0; d < 300; d++) {
  const date = `seed-${d}`;
  const p = generatePuzzle(notable, date);
  const all = [...p.rows, ...p.cols];
  const nJ = all.filter((h) => h.kind === "justice").length;
  jdist[nJ] = (jdist[nJ] || 0) + 1;
  const topics = all.filter(
    (h) => h.kind === "category" && CATEGORY_BY_ID[h.id]?.group === "Topic"
  ).length;
  const rowJ = p.rows.filter((h) => h.kind === "justice").length;
  const colJ = p.cols.filter((h) => h.kind === "justice").length;
  if (nJ < 3 || topics > 1 || rowJ < 1 || colJ < 1) {
    bad++;
    if (bad < 6) console.log("BAD", date, { nJ, topics, rowJ, colJ });
  }
}
console.log("violations:", bad, "/300");
console.log("justice-count distribution:", jdist);
