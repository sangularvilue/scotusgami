/**
 * One-time backfill: scrape every term of the current natural court from Oyez
 * and write data/cases-{term}.json. Load into Redis with scripts/load-redis.ts.
 *
 * Usage (from project root): npx tsx scripts/backfill.ts [startTerm]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentTerm, scrapeTerm } from "../lib/oyez";

async function main() {
  const start = Number(process.argv[2] ?? 2022);
  const end = currentTerm();
  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });

  for (let term = start; term <= end; term++) {
    const { cases, skipped } = await scrapeTerm(term, console.log);
    writeFileSync(
      join(outDir, `cases-${term}.json`),
      JSON.stringify(cases, null, 1)
    );
    for (const s of skipped) console.log(`  [skip] ${s.name}: ${s.reason}`);
  }
  console.log("backfill complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
